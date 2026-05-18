import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Server-side Evolution API configuration from environment variables
function getEvolutionConfig() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_EVOLUTION_URL || ''
  const apiKey = process.env.EVOLUTION_API_KEY || ''
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'Khotla_Main'
  return { apiBaseUrl, apiKey, instanceName }
}

function buildWebhookUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL
  if (envUrl) return `${envUrl}/api/whatsapp-webhook`

  const host = req.headers.get('host')
  const protocol = req.headers.get('x-forwarded-proto') ?? 'https'
  if (host) return `${protocol}://${host}/api/whatsapp-webhook`

  return ''
}

// ---------------------------------------------------------------------------
// GET – Fetch current WhatsApp connection status
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const { apiBaseUrl, apiKey, instanceName } = getEvolutionConfig()

    if (!apiBaseUrl || !apiKey) {
      return NextResponse.json({
        online: false,
        state: 'not_configured',
        instance: null,
        qrCode: null,
        message: 'WhatsApp not configured yet.',
      })
    }

    // Check the real connection state from Evolution API
    try {
      const response = await fetch(
        `${apiBaseUrl}/instance/connectionState/${instanceName}`,
        {
          method: 'GET',
          headers: { apikey: apiKey },
          signal: AbortSignal.timeout(8000),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const state = data?.instance?.state || data?.state || 'unknown'
        const isOnline = state === 'open' || state === 'connected'

        // Update the DB record if it exists
        const config = await db.whatsAppConfig.findFirst()
        if (config) {
          await db.whatsAppConfig.update({
            where: { id: config.id },
            data: {
              isConnected: isOnline,
              ...(isOnline && { lastConnectedAt: new Date() }),
            },
          })
        }

        let message: string
        if (isOnline) {
          message = 'WhatsApp is connected and operational.'
        } else if (state === 'connecting') {
          message = 'WhatsApp is connecting...'
        } else if (state === 'close' || state === 'disconnected') {
          message = 'WhatsApp is disconnected. Please reconnect.'
        } else if (state === 'qr') {
          message = 'Scan the QR code to connect your WhatsApp.'
        } else {
          message = 'WhatsApp is disconnected. Click Connect to link your number.'
        }

        // Try to fetch QR code if not connected
        let qrCode: string | null = null
        if (!isOnline) {
          try {
            const qrRes = await fetch(`${apiBaseUrl}/instance/connect/${instanceName}`, {
              headers: { apikey: apiKey },
              signal: AbortSignal.timeout(8000),
            })
            if (qrRes.ok) {
              const qrData = await qrRes.json()
              qrCode = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.code || null
            }
          } catch {
            // QR fetch failed, that's OK
          }
        }

        return NextResponse.json({
          online: isOnline,
          state,
          instance: instanceName,
          qrCode,
          message,
        })
      }

      return NextResponse.json({
        online: false,
        state: 'offline',
        instance: instanceName,
        qrCode: null,
        message: 'WhatsApp is offline. Click Connect to link your number.',
      })
    } catch {
      return NextResponse.json({
        online: false,
        state: 'offline',
        instance: instanceName,
        qrCode: null,
        message: 'WhatsApp is offline. Click Connect to link your number.',
      })
    }
  } catch (error) {
    console.error('WhatsApp setup GET error:', error)
    return NextResponse.json({
      online: false,
      state: 'offline',
      instance: null,
      qrCode: null,
      message: 'Unable to check WhatsApp status.',
    })
  }
}

// ---------------------------------------------------------------------------
// PUT – Create a WhatsApp instance and connect it (one-click)
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  try {
    const { apiBaseUrl, apiKey, instanceName } = getEvolutionConfig()

    if (!apiBaseUrl || !apiKey) {
      return NextResponse.json(
        { error: 'WhatsApp service is not configured on the server.' },
        { status: 500 }
      )
    }

    const webhookUrl = buildWebhookUrl(req)

    // Save/update config in database
    const existing = await db.whatsAppConfig.findFirst()
    if (existing) {
      await db.whatsAppConfig.update({
        where: { id: existing.id },
        data: { apiBaseUrl, apiKey, instanceName, webhookUrl },
      })
    } else {
      await db.whatsAppConfig.create({
        data: {
          instanceName,
          apiKey,
          apiBaseUrl,
          webhookUrl,
          isConnected: false,
        },
      })
    }

    // 1. Create the instance on Evolution API
    try {
      await fetch(`${apiBaseUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      // Instance may already exist – continue
    }

    // 2. Set the webhook
    try {
      await fetch(`${apiBaseUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          webhookByEvents: true,
          events: ['MESSAGES_UPSERT'],
        }),
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      // Webhook setup failure is non-fatal
    }

    // 3. Connect and fetch QR code (with retries)
    let qrCode: string | null = null
    let connectionState = 'unknown'

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const connectRes = await fetch(
          `${apiBaseUrl}/instance/connect/${instanceName}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', apikey: apiKey },
            signal: AbortSignal.timeout(15000),
          }
        )

        if (connectRes.ok) {
          const connectData = await connectRes.json()
          qrCode = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.code || null
          connectionState = connectData?.instance?.state || connectData?.state || (qrCode ? 'waiting_scan' : 'unknown')

          if (qrCode) break
        }

        // Wait before retry
        if (attempt < 2) await new Promise(r => setTimeout(r, 3000))
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 3000))
      }
    }

    // 4. Update the database
    const isConnected = connectionState === 'open' || connectionState === 'connected'
    await db.whatsAppConfig.updateMany({
      data: {
        qrCode,
        isConnected,
        webhookUrl,
        lastConnectedAt: isConnected ? new Date() : undefined,
      },
    })

    return NextResponse.json({
      message: isConnected
        ? 'WhatsApp is connected!'
        : qrCode
          ? 'Scan the QR code to connect.'
          : 'Instance created. QR code will appear shortly.',
      qrCode,
      config: { isConnected, liveState: connectionState },
    })
  } catch (error) {
    console.error('WhatsApp setup PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to connect WhatsApp. Please try again.' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE – Disconnect the WhatsApp instance
// ---------------------------------------------------------------------------
export async function DELETE() {
  try {
    const { apiBaseUrl, apiKey, instanceName } = getEvolutionConfig()

    if (!apiBaseUrl || !apiKey) {
      return NextResponse.json(
        { error: 'WhatsApp service is not configured.' },
        { status: 500 }
      )
    }

    // Logout from Evolution API
    try {
      await fetch(`${apiBaseUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        signal: AbortSignal.timeout(10000),
      })
    } catch {
      // Instance may already be disconnected
    }

    // Update database
    await db.whatsAppConfig.updateMany({
      data: {
        isConnected: false,
        qrCode: null,
        instanceToken: null,
      },
    })

    return NextResponse.json({
      message: 'WhatsApp has been disconnected.',
    })
  } catch (error) {
    console.error('WhatsApp setup DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect WhatsApp.' },
      { status: 500 }
    )
  }
}
