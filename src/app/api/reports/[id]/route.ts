import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await req.json()

    // Build update data preserving existing PATCH functionality
    const updateData: Record<string, unknown> = {}
    if (data.status) updateData.status = data.status
    if (data.category) updateData.category = data.category
    if (data.priority) updateData.priority = data.priority

    const report = await db.report.update({
      where: { id },
      data: updateData,
    })

    // If status changed to Resolved AND the source is whatsapp, notify the citizen
    if (
      data.status === 'Resolved' &&
      report.source === 'whatsapp' &&
      report.whatsappJid &&
      !report.resolutionNotified
    ) {
      try {
        // Read WhatsAppConfig from the database
        const whatsappConfig = await db.whatsAppConfig.findFirst()

        if (whatsappConfig?.apiKey) {
          const { apiBaseUrl, instanceName, apiKey } = whatsappConfig
          const category = report.category || 'issue'
          const message = `KHOTLA AI: Bothata ba hau ba ${category} bo hodutse! Re leboha pako ea hau. (Your ${category} issue has been resolved! Thank you for your report.)`

          // Send WhatsApp message using the Evolution API
          const sendResponse = await fetch(
            `${apiBaseUrl}/message/sendText/${instanceName}`,
            {
              method: 'POST',
              headers: {
                apikey: apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                number: report.whatsappJid.split('@')[0],
                text: message,
              }),
              signal: AbortSignal.timeout(10000),
            }
          )

          if (sendResponse.ok) {
            // Mark the report as notified
            await db.report.update({
              where: { id: report.id },
              data: { resolutionNotified: true },
            })
          } else {
            const errorBody = await sendResponse.text().catch(() => 'unknown')
            console.error(
              'Failed to send resolution WhatsApp, API responded with:',
              sendResponse.status,
              errorBody
            )
          }
        } else {
          console.warn(
            'WhatsApp config not found or missing apiKey — skipping resolution notification'
          )
        }
      } catch (whatsappError) {
        // Fallback gracefully — do not fail the PATCH request
        console.error('Failed to send resolution WhatsApp notification:', whatsappError)
      }
    }

    // Re-fetch to include any resolutionNotified update
    const finalReport = await db.report.findUnique({ where: { id } })

    return NextResponse.json({ report: finalReport || report })
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
