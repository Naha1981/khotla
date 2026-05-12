import { NextResponse } from 'next/server'

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://my-evolution-api-capsule.onrender.com'
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'Khotla_Main'

export async function GET() {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        signal: AbortSignal.timeout(5000),
      }
    )

    if (response.ok) {
      const data = await response.json()
      const state = data?.instance?.state || data?.state || 'unknown'
      return NextResponse.json({
        online: state === 'open' || state === 'connected',
        state: state,
        instance: EVOLUTION_INSTANCE_NAME,
      })
    }

    return NextResponse.json({
      online: false,
      state: 'unreachable',
      instance: EVOLUTION_INSTANCE_NAME,
    })
  } catch {
    return NextResponse.json({
      online: false,
      state: 'error',
      instance: EVOLUTION_INSTANCE_NAME,
    })
  }
}
