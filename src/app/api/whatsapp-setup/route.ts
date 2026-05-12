import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Helper: build the webhook URL that points back to our app
// ---------------------------------------------------------------------------
function buildWebhookUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return `${envUrl}/api/whatsapp-webhook`

  // Fallback: derive from the incoming request headers
  const host = req.headers.get('host')
  const protocol = req.headers.get('x-forwarded-proto') ?? 'https'
  if (host) return `${protocol}://${host}/api/whatsapp-webhook`

  return ''
}

// ---------------------------------------------------------------------------
// GET – Fetch current WhatsApp configuration and connection status
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const configs = await db.whatsAppConfig.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // For each config, try to fetch the live connection state from Evolution API
    const enrichedConfigs = await Promise.all(
      configs.map(async (config) => {
        if (!config.apiBaseUrl || !config.apiKey || !config.instanceName) {
          return { ...config, liveState: 'unconfigured' }
        }

        try {
          const stateRes = await fetch(
            `${config.apiBaseUrl}/instance/connectionState/${config.instanceName}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                apikey: config.apiKey,
              },
              signal: AbortSignal.timeout(5000),
            }
          )

          if (stateRes.ok) {
            const stateData = await stateRes.json()
            const state =
              stateData?.instance?.state || stateData?.state || 'unknown'
            const isConnected = state === 'open' || state === 'connected'

            // Sync DB with live state
            if (config.isConnected !== isConnected) {
              await db.whatsAppConfig.update({
                where: { id: config.id },
                data: {
                  isConnected,
                  lastConnectedAt: isConnected ? new Date() : config.lastConnectedAt,
                },
              })
            }

            return { ...config, isConnected, liveState: state }
          }

          return { ...config, liveState: 'unreachable' }
        } catch {
          return { ...config, liveState: 'error' }
        }
      })
    )

    return NextResponse.json({ configs: enrichedConfigs })
  } catch (error) {
    console.error('WhatsApp setup GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch WhatsApp configuration' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST – Save Evolution API configuration (apiKey, apiBaseUrl, instanceName)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { instanceName, apiKey, apiBaseUrl } = body

    if (!instanceName || !apiKey || !apiBaseUrl) {
      return NextResponse.json(
        { error: 'instanceName, apiKey, and apiBaseUrl are required' },
        { status: 400 }
      )
    }

    // Validate that the apiBaseUrl is reachable (basic check)
    try {
      const healthCheck = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        signal: AbortSignal.timeout(8000),
      })

      if (!healthCheck.ok) {
        return NextResponse.json(
          { error: 'Evolution API returned an error. Please check your API key and base URL.' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Cannot reach Evolution API at the provided base URL' },
        { status: 400 }
      )
    }

    const webhookUrl = buildWebhookUrl(req)
    const cleanBaseUrl = apiBaseUrl.replace(/\/$/, '')

    // Upsert the config – only one active config per instanceName
    const config = await db.whatsAppConfig.upsert({
      where: { instanceName },
      create: {
        instanceName,
        apiKey,
        apiBaseUrl: cleanBaseUrl,
        webhookUrl,
        isConnected: false,
      },
      update: {
        apiKey,
        apiBaseUrl: cleanBaseUrl,
        webhookUrl,
      },
    })

    return NextResponse.json({
      message: 'Configuration saved successfully',
      config: {
        id: config.id,
        instanceName: config.instanceName,
        apiBaseUrl: config.apiBaseUrl,
        webhookUrl: config.webhookUrl,
        isConnected: config.isConnected,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    })
  } catch (error) {
    console.error('WhatsApp setup POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save WhatsApp configuration' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PUT – Create a WhatsApp instance on Evolution API and connect it
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { instanceName } = body

    if (!instanceName) {
      return NextResponse.json(
        { error: 'instanceName is required' },
        { status: 400 }
      )
    }

    const config = await db.whatsAppConfig.findUnique({
      where: { instanceName },
    })

    if (!config || !config.apiKey || !config.apiBaseUrl) {
      return NextResponse.json(
        { error: 'No configuration found. Please save your Evolution API configuration first.' },
        { status: 404 }
      )
    }

    const { apiBaseUrl, apiKey } = config
    const webhookUrl = config.webhookUrl || buildWebhookUrl(req)

    // 1. Create the instance on Evolution API
    try {
      const createRes = await fetch(`${apiBaseUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => 'Unknown error')
        // Instance may already exist – continue to connect
        console.warn(
          `Instance create returned ${createRes.status}: ${errText}. Proceeding to connect...`
        )
      } else {
        const createData = await createRes.json()
        // Store the instance token if returned
        const instanceToken =
          createData?.instance?.token ||
          createData?.token ||
          createData?.hash?.apiToken ||
          null

        if (instanceToken) {
          await db.whatsAppConfig.update({
            where: { instanceName },
            data: { instanceToken },
          })
        }
      }
    } catch (err) {
      console.error('Instance create error:', err)
      return NextResponse.json(
        { error: 'Failed to create instance on Evolution API. Please check connectivity.' },
        { status: 502 }
      )
    }

    // 2. Set the webhook
    try {
      await fetch(`${apiBaseUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          webhookByEvents: true,
          events: ['MESSAGES_UPSERT'],
        }),
        signal: AbortSignal.timeout(10000),
      })
    } catch (err) {
      console.warn('Webhook set failed (non-fatal):', err)
    }

    // 3. Connect and fetch QR code
    let qrCode: string | null = null
    let connectionState = 'unknown'

    try {
      const connectRes = await fetch(
        `${apiBaseUrl}/instance/connect/${instanceName}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
          },
          signal: AbortSignal.timeout(15000),
        }
      )

      if (connectRes.ok) {
        const connectData = await connectRes.json()

        // QR code can come in different formats from Evolution API
        qrCode =
          connectData?.base64 ||
          connectData?.qrcode?.base64 ||
          connectData?.code ||
          null

        connectionState =
          connectData?.instance?.state ||
          connectData?.state ||
          (qrCode ? 'waiting_scan' : 'unknown')
      } else {
        const errText = await connectRes.text().catch(() => '')
        console.warn(`Connect returned ${connectRes.status}: ${errText}`)
        connectionState = 'connect_failed'
      }
    } catch (err) {
      console.error('Instance connect error:', err)
      connectionState = 'connect_timeout'
    }

    // 4. Update the database with QR code and state
    const isConnected = connectionState === 'open' || connectionState === 'connected'
    const updatedConfig = await db.whatsAppConfig.update({
      where: { instanceName },
      data: {
        qrCode,
        isConnected,
        webhookUrl,
        lastConnectedAt: isConnected ? new Date() : undefined,
      },
    })

    return NextResponse.json({
      message: isConnected
        ? 'WhatsApp instance is connected!'
        : qrCode
          ? 'Instance created. Scan the QR code to connect.'
          : 'Instance created but QR code is not available yet. Try connecting again.',
      config: {
        id: updatedConfig.id,
        instanceName: updatedConfig.instanceName,
        apiBaseUrl: updatedConfig.apiBaseUrl,
        webhookUrl: updatedConfig.webhookUrl,
        isConnected: updatedConfig.isConnected,
        liveState: connectionState,
      },
      qrCode,
    })
  } catch (error) {
    console.error('WhatsApp setup PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to create/connect WhatsApp instance' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE – Disconnect/logout the WhatsApp instance
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { instanceName } = body

    if (!instanceName) {
      return NextResponse.json(
        { error: 'instanceName is required' },
        { status: 400 }
      )
    }

    const config = await db.whatsAppConfig.findUnique({
      where: { instanceName },
    })

    if (!config || !config.apiKey || !config.apiBaseUrl) {
      return NextResponse.json(
        { error: 'No configuration found for this instance' },
        { status: 404 }
      )
    }

    // 1. Logout from Evolution API
    try {
      const logoutRes = await fetch(
        `${config.apiBaseUrl}/instance/logout/${instanceName}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.apiKey,
          },
          signal: AbortSignal.timeout(10000),
        }
      )

      if (!logoutRes.ok) {
        const errText = await logoutRes.text().catch(() => 'Unknown error')
        console.warn(`Logout returned ${logoutRes.status}: ${errText}`)
      }
    } catch (err) {
      console.warn('Logout request failed (instance may already be disconnected):', err)
    }

    // 2. Update the database – mark as disconnected, clear QR code
    await db.whatsAppConfig.update({
      where: { instanceName },
      data: {
        isConnected: false,
        qrCode: null,
        instanceToken: null,
      },
    })

    return NextResponse.json({
      message: `WhatsApp instance "${instanceName}" has been disconnected successfully`,
    })
  } catch (error) {
    console.error('WhatsApp setup DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect WhatsApp instance' },
      { status: 500 }
    )
  }
}
