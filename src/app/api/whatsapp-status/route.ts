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

        // Update the DB
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
          message = 'WhatsApp is offline. Click Connect to link your number.'
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
    console.error('WhatsApp status check error:', error)
    return NextResponse.json({
      online: false,
      state: 'offline',
      instance: null,
      qrCode: null,
      message: 'Unable to check WhatsApp status.',
    })
  }
}
