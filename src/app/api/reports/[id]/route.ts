import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await req.json()

    const report = await db.report.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.category && { category: data.category }),
        ...(data.priority && { priority: data.priority }),
      }
    })

    // If status changed to Resolved, try to send WhatsApp notification
    if (data.status === 'Resolved' && report.citizenName && report.source === 'whatsapp') {
      try {
        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://my-evolution-api-capsule.onrender.com'
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
        const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'Khotla_Main'
        const EVOLUTION_INSTANCE_TOKEN = process.env.EVOLUTION_INSTANCE_TOKEN || ''

        if (EVOLUTION_API_KEY) {
          await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY,
              'Authorization': `Bearer ${EVOLUTION_INSTANCE_TOKEN}`,
            },
            body: JSON.stringify({
              number: report.citizenName,
              text: `KHOTLA AI: Re hodutse bothata ba hau. Re leboha pako ea hau. (Your issue has been resolved. Thank you for your report.)`,
            }),
          })
        }
      } catch (e) {
        console.error('Failed to send resolution WhatsApp:', e)
      }
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Update report error:', error)
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.report.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete report error:', error)
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
  }
}
