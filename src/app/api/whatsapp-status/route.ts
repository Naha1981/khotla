import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_EVOLUTION_URL || ''
    const apiKey = process.env.EVOLUTION_API_KEY || ''
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'Khotla_Main'

    if (!apiBaseUrl || !apiKey) {
      return NextResponse.json({
        online: false,
        state: 'not_configured',
        instance: null,
        qrCode: null,
        phoneNumber: null,
        message: 'WhatsApp not configured yet.',
      })
    }

    // Check the database record first (fast, no external calls)
    const config = await db.whatsAppConfig.findFirst()

    if (config?.isConnected) {
      // Verify with Evolution API (with generous timeout for Render free tier)
      try {
        const response = await fetch(
          `${apiBaseUrl}/instance/connectionState/${instanceName}`,
          {
            method: 'GET',
            headers: { apikey: apiKey },
            signal: AbortSignal.timeout(15000),
          }
        )

        if (response.ok) {
          const data = await response.json()
          const state = data?.instance?.state || data?.state || 'unknown'
          const isOnline = state === 'open' || state === 'connected'

          // Try to extract phone number from connection state data
          let phoneNumber: string | null = config.phoneNumber
          const instanceData = data?.instance
          if (instanceData?.phone) {
            phoneNumber = instanceData.phone
          }

          await db.whatsAppConfig.update({
            where: { id: config.id },
            data: {
              isConnected: isOnline,
              ...(isOnline && { lastConnectedAt: new Date() }),
              ...(phoneNumber && phoneNumber !== config.phoneNumber && { phoneNumber }),
            },
          })

          return NextResponse.json({
            online: isOnline,
            state,
            instance: instanceName,
            qrCode: null,
            phoneNumber,
            message: isOnline
              ? 'WhatsApp is connected and operational.'
              : 'WhatsApp is offline. Click Connect to link your number.',
          })
        }
      } catch {
        // Evolution API unreachable - return last known state from DB
        return NextResponse.json({
          online: config.isConnected,
          state: config.isConnected ? 'open' : 'api_unreachable',
          instance: instanceName,
          qrCode: null,
          phoneNumber: config.phoneNumber,
          message: config.isConnected
            ? 'WhatsApp is connected.'
            : 'WhatsApp service is starting up, please wait...',
        })
      }
    }

    // Not connected - try a check with generous timeout
    try {
      const response = await fetch(
        `${apiBaseUrl}/instance/connectionState/${instanceName}`,
        {
          method: 'GET',
          headers: { apikey: apiKey },
          signal: AbortSignal.timeout(15000),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const state = data?.instance?.state || data?.state || 'unknown'
        const isOnline = state === 'open' || state === 'connected'

        // Try to extract phone number
        let phoneNumber: string | null = null
        const instanceData = data?.instance
        if (instanceData?.phone) {
          phoneNumber = instanceData.phone
        } else if (config?.phoneNumber) {
          phoneNumber = config.phoneNumber
        }

        // Try to get QR code if not connected
        let qrCode: string | null = null
        if (!isOnline) {
          try {
            const qrRes = await fetch(`${apiBaseUrl}/instance/connect/${instanceName}`, {
              headers: { apikey: apiKey },
              signal: AbortSignal.timeout(15000),
            })
            if (qrRes.ok) {
              const qrData = await qrRes.json()
              qrCode = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.code || null
            }
          } catch {
            // QR fetch failed
          }
        }

        // Update DB with phone number if we got one
        if (phoneNumber && config) {
          await db.whatsAppConfig.update({
            where: { id: config.id },
            data: { phoneNumber },
          })
        }

        return NextResponse.json({
          online: isOnline,
          state,
          instance: instanceName,
          qrCode,
          phoneNumber,
          message: isOnline
            ? 'WhatsApp is connected and operational.'
            : 'WhatsApp is offline. Click Connect to link your number.',
        })
      }
    } catch {
      // API unreachable
    }

    return NextResponse.json({
      online: false,
      state: 'api_unreachable',
      instance: instanceName,
      qrCode: null,
      phoneNumber: config?.phoneNumber || null,
      message: 'WhatsApp service is starting up, please wait...',
    })
  } catch (error) {
    console.error('WhatsApp status check error:', error)
    return NextResponse.json({
      online: false,
      state: 'offline',
      instance: null,
      qrCode: null,
      phoneNumber: null,
      message: 'Unable to check WhatsApp status.',
    })
  }
}
