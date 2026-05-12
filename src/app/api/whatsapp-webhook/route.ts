import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://my-evolution-api-capsule.onrender.com'
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'Khotla_Main'
const EVOLUTION_INSTANCE_TOKEN = process.env.EVOLUTION_INSTANCE_TOKEN || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('WhatsApp Webhook received:', JSON.stringify(body, null, 2))

    // Extract message data from Evolution API webhook
    const data = body.data || body
    const messageData = data.message || data
    const key = messageData?.key || data.key
    const pushName = data.pushName || key?.remoteJid?.split('@')[0] || 'Unknown'
    const from = key?.remoteJid || data.from || ''
    const messageType = Object.keys(messageData?.message || {}).find(
      (k) => !k.startsWith('senderKey') && !k.startsWith('messageContext')
    )

    if (!messageType) {
      return NextResponse.json({ status: 'no_message' })
    }

    // Extract text content
    let textContent = ''
    if (messageType === 'conversation') {
      textContent = messageData.message.conversation
    } else if (messageType === 'extendedTextMessage') {
      textContent = messageData.message.extendedTextMessage?.text || ''
    } else if (messageType === 'imageMessage') {
      textContent = messageData.message.imageMessage?.caption || '[Image received]'
    } else {
      textContent = `[${messageType} received]`
    }

    if (!textContent) {
      return NextResponse.json({ status: 'empty_message' })
    }

    // Analyze with AI
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are KHOTLA AI, the sovereign AI assistant for the Kingdom of Lesotho. You analyze citizen reports from WhatsApp in English and Sesotho.

Your job is to:
1. Understand the citizen's issue (can be in English or Sesotho)
2. Categorize it into one of: WATER, ROADS, CORRUPTION, HEALTH, EDUCATION, ELECTRICITY, SANITATION, OTHER
3. Assign a priority: HIGH, MEDIUM, LOW
4. Provide a brief summary

You MUST respond with ONLY a valid JSON object:
{
  "category": "CATEGORY",
  "priority": "PRIORITY",
  "summary": "Brief summary",
  "replyInSesotho": "A brief acknowledgment reply in Sesotho"
}

Do NOT include any text outside the JSON object.`
        },
        {
          role: 'user',
          content: textContent
        }
      ],
      thinking: { type: 'disabled' }
    })

    const aiResponse = completion.choices[0]?.message?.content
    let parsed: { category: string; priority: string; summary: string; replyInSesotho: string }
    try {
      let cleaned = (aiResponse || '').trim()
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {
        category: 'OTHER',
        priority: 'MEDIUM',
        summary: aiResponse || 'Unable to analyze',
        replyInSesotho: 'Re amohetse pako ea hau. Re tla sheba bothata bona.'
      }
    }

    // Save to database
    await db.report.create({
      data: {
        category: parsed.category,
        priority: parsed.priority,
        description: textContent,
        aiSummary: parsed.summary,
        citizenName: pushName,
        status: 'Pending',
        source: 'whatsapp',
      }
    })

    // Send WhatsApp reply via Evolution API
    if (from && EVOLUTION_API_KEY) {
      try {
        const replyText = parsed.replyInSesotho || 'Re amohetse pako ea hau. KHOTLA AI e tla sheba bothata bona.'
        await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
            'Authorization': `Bearer ${EVOLUTION_INSTANCE_TOKEN}`,
          },
          body: JSON.stringify({
            number: from.split('@')[0],
            text: replyText,
          }),
        })
      } catch (replyError) {
        console.error('Failed to send WhatsApp reply:', replyError)
      }
    }

    return NextResponse.json({ status: 'processed', category: parsed.category })
  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET for webhook verification
export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'KHOTLA AI WhatsApp Webhook Active' })
}
