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

    // Check the database record first (fast, no external calls)
    const config = await db.whatsAppConfig.findFirst()

    if (config?.isConnected) {
      // Verify with Evolution API (short timeout)
      try {
        const response = await fetch(
          `${apiBaseUrl}/instance/connectionState/${instanceName}`,
          {
            method: 'GET',
            headers: { apikey: apiKey },
            signal: AbortSignal.timeout(3000),
          }
        )

        if (response.ok) {
          const data = await response.json()
          const state = data?.instance?.state || data?.state || 'unknown'
          const isOnline = state === 'open' || state === 'connected'

          await db.whatsAppConfig.update({
            where: { id: config.id },
            data: {
              isConnected: isOnline,
              ...(isOnline && { lastConnectedAt: new Date() }),
            },
          })

          return NextResponse.json({
            online: isOnline,
            state,
            instance: instanceName,
            qrCode: null,
            message: isOnline
              ? 'WhatsApp is connected and operational.'
              : 'WhatsApp is offline. Click Connect to link your number.',
          })
        }
      } catch {
        // Evolution API unreachable - return last known state from DB
        return NextResponse.json({
          online: config.isConnected,
          state: config.isConnected ? 'open' : 'offline',
          instance: instanceName,
          qrCode: null,
          message: config.isConnected
            ? 'WhatsApp is connected.'
            : 'WhatsApp is offline. Click Connect to link your number.',
        })
      }
    }

    // Not connected - try a quick check with very short timeout
    try {
      const response = await fetch(
        `${apiBaseUrl}/instance/connectionState/${instanceName}`,
        {
          method: 'GET',
          headers: { apikey: apiKey },
          signal: AbortSignal.timeout(3000),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const state = data?.instance?.state || data?.state || 'unknown'
        const isOnline = state === 'open' || state === 'connected'

        // Try to get QR code if not connected
        let qrCode: string | null = null
        if (!isOnline) {
          try {
            const qrRes = await fetch(`${apiBaseUrl}/instance/connect/${instanceName}`, {
              headers: { apikey: apiKey },
              signal: AbortSignal.timeout(3000),
            })
            if (qrRes.ok) {
              const qrData = await qrRes.json()
              qrCode = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.code || null
            }
          } catch {
            // QR fetch failed
          }
        }

        return NextResponse.json({
          online: isOnline,
          state,
          instance: instanceName,
          qrCode,
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
      state: 'offline',
      instance: instanceName,
      qrCode: null,
      message: 'WhatsApp is offline. Click Connect to link your number.',
    })
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
