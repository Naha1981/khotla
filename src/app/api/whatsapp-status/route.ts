import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Read WhatsAppConfig from the database
    const config = await db.whatsAppConfig.findFirst()

    // If no config exists yet, return not_configured
    if (!config) {
      return NextResponse.json({
        online: false,
        state: 'not_configured',
        instance: null,
        qrCode: null,
        message: 'WhatsApp not configured yet. Go to WhatsApp Setup to connect.',
      })
    }

    // If config exists but no apiKey, we can't check the API
    if (!config.apiKey) {
      return NextResponse.json({
        online: false,
        state: 'not_configured',
        instance: config.instanceName,
        qrCode: config.qrCode || null,
        message: 'WhatsApp not configured yet. Go to WhatsApp Setup to connect.',
      })
    }

    // Check the real connection state from Evolution API
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/instance/connectionState/${config.instanceName}`,
        {
          method: 'GET',
          headers: {
            apikey: config.apiKey,
          },
          signal: AbortSignal.timeout(8000),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const state = data?.instance?.state || data?.state || 'unknown'
        const isOnline = state === 'open' || state === 'connected'

        // Update the isConnected field in the database
        await db.whatsAppConfig.update({
          where: { id: config.id },
          data: {
            isConnected: isOnline,
            ...(isOnline && { lastConnectedAt: new Date() }),
          },
        })

        // Determine a human-readable message
        let message: string
        if (isOnline) {
          message = 'WhatsApp is connected and operational.'
        } else if (state === 'connecting') {
          message = 'WhatsApp is connecting...'
        } else if (state === 'close' || state === 'disconnected') {
          message = 'WhatsApp is disconnected. Please reconnect.'
        } else if (state === 'qr') {
          message = 'Scan the QR code to connect your WhatsApp instance.'
        } else {
          message = `WhatsApp state: ${state}`
        }

        return NextResponse.json({
          online: isOnline,
          state: state,
          instance: config.instanceName,
          qrCode: config.qrCode || data?.qrcode || data?.qrCode || null,
          message,
        })
      }

      // API responded but not OK
      const isConnected = false
      await db.whatsAppConfig.update({
        where: { id: config.id },
        data: { isConnected },
      })

      return NextResponse.json({
        online: false,
        state: 'unreachable',
        instance: config.instanceName,
        qrCode: config.qrCode || null,
        message: 'Evolution API is unreachable. Check your API URL and try again.',
      })
    } catch (fetchError) {
      // Network error contacting Evolution API
      console.error('Error checking WhatsApp connection state:', fetchError)

      await db.whatsAppConfig.update({
        where: { id: config.id },
        data: { isConnected: false },
      })

      return NextResponse.json({
        online: false,
        state: 'error',
        instance: config.instanceName,
        qrCode: config.qrCode || null,
        message: 'Could not reach Evolution API. Please verify the service is running.',
      })
    }
  } catch (error) {
    console.error('WhatsApp status check error:', error)
    return NextResponse.json({
      online: false,
      state: 'error',
      instance: null,
      qrCode: null,
      message: 'An unexpected error occurred while checking WhatsApp status.',
    })
  }
}
