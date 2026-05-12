import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip markdown code fences from AI JSON responses */
function stripMarkdown(raw: string): string {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  return cleaned
}

/** Format a phone number like "26656001234" into "+266 5600 1234" */
function formatPhone(jid: string): string {
  const digits = jid.split('@')[0]
  if (digits.length >= 10) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`
  }
  return `+${digits}`
}

/** Download media from a URL (optionally adding the Evolution API key header) and return as base64 */
async function downloadMediaAsBase64(url: string, apiKey?: string): Promise<string> {
  const headers: Record<string, string> = {}
  if (apiKey) {
    headers['apikey'] = apiKey
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
  if (!res.ok) {
    throw new Error(`Media download failed: ${res.status} ${res.statusText}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return base64
}

/** Read WhatsApp config from database, fall back to env vars */
async function getWhatsAppConfig() {
  const configs = await db.whatsAppConfig.findMany({ orderBy: { updatedAt: 'desc' } })
  const config = configs[0]
  return {
    apiKey: config?.apiKey || process.env.EVOLUTION_API_KEY || '',
    instanceName: config?.instanceName || process.env.EVOLUTION_INSTANCE_NAME || 'Khotla_Main',
    apiBaseUrl: config?.apiBaseUrl || process.env.EVOLUTION_API_URL || 'https://my-evolution-api-capsule.onrender.com',
  }
}

/** Send a text reply to a citizen via Evolution API */
async function sendWhatsAppReply(jid: string, text: string): Promise<void> {
  try {
    const config = await getWhatsAppConfig()
    if (!config.apiKey) {
      console.warn('WhatsApp reply skipped: no API key configured')
      return
    }

    const number = jid.split('@')[0]
    const url = `${config.apiBaseUrl}/message/sendText/${config.instanceName}`

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.apiKey,
      },
      body: JSON.stringify({ number, text }),
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    console.error('Failed to send WhatsApp reply:', err)
  }
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

/** Categorise a text report with the KHOTLA AI prompt */
async function analyzeText(
  text: string,
): Promise<{ category: string; priority: string; summary: string; replyInSesotho: string }> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content: `You are KHOTLA AI, the sovereign AI assistant for the Kingdom of Lesotho. You analyze citizen reports from WhatsApp in English and Sesotho.

Your job is to:
1. Understand the citizen's issue (can be in English or Sesotho)
2. Categorize it into one of: WATER, ROADS, CORRUPTION, HEALTH, EDUCATION, ELECTRICITY, SANITATION, OTHER
3. Assign a priority: HIGH (life-threatening, critical infrastructure failure, corruption), MEDIUM (significant but not critical), LOW (minor inconvenience, suggestions)
4. Provide a brief summary in English
5. Write a brief acknowledgment reply in Sesotho

You MUST respond with ONLY a valid JSON object:
{
  "category": "CATEGORY",
  "priority": "PRIORITY",
  "summary": "Brief summary",
  "replyInSesotho": "A brief acknowledgment reply in Sesotho"
}

Do NOT include any text outside the JSON object.`,
      },
      { role: 'user', content: text },
    ],
    thinking: { type: 'disabled' },
  })

  const raw = completion.choices[0]?.message?.content || ''
  try {
    return JSON.parse(stripMarkdown(raw))
  } catch {
    return {
      category: 'OTHER',
      priority: 'MEDIUM',
      summary: raw || 'Unable to analyze',
      replyInSesotho: 'Re amohetse pako ea hau. Re tla sheba bothata bona.',
    }
  }
}

/** Analyse an image with the KHOTLA Edge Vision prompt */
async function analyzeImage(
  base64: string,
): Promise<{
  objectDetected: string
  severity: string
  confidence: number
  category: string
  description: string
  recommendedAction: string
  estimatedUrgency: string
}> {
  const zai = await ZAI.create()
  const response = await zai.chat.completions.createVision({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are KHOTLA AI Edge Vision Module for the Kingdom of Lesotho. Analyze this image for infrastructure damage, public safety issues, or civic problems.

Look for: potholes, broken roads, water leaks, electrical hazards, structural damage, sanitation issues, flooding, erosion, or any other civic infrastructure problems.

You MUST respond with ONLY a valid JSON object in this exact format:
{
  "objectDetected": "What you see in the image",
  "severity": "CRITICAL/HIGH/MEDIUM/LOW",
  "confidence": 0.00-1.00,
  "category": "ROADS/WATER/ELECTRICITY/SANITATION/STRUCTURAL/OTHER",
  "description": "Detailed description of the issue",
  "recommendedAction": "Immediate action recommended",
  "estimatedUrgency": "IMMEDIATE/24HOURS/WEEK/MONTH"
}

If no civic issue is found, set severity to LOW and category to OTHER.`,
          },
          {
            type: 'image_url',
            image_url: { url: base64 },
          },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })

  const raw = response.choices[0]?.message?.content || ''
  try {
    return JSON.parse(stripMarkdown(raw))
  } catch {
    return {
      objectDetected: 'Unable to analyze',
      severity: 'LOW',
      confidence: 0,
      category: 'OTHER',
      description: raw || 'Vision analysis failed',
      recommendedAction: 'Manual review required',
      estimatedUrgency: 'WEEK',
    }
  }
}

/** Transcribe an audio file using z-ai ASR */
async function transcribeAudio(base64: string): Promise<string> {
  const zai = await ZAI.create()
  const result = await zai.audio.asr.create({ file_base64: base64 })
  // The ASR response shape can vary – try common fields
  const text =
    result?.text ||
    result?.transcription ||
    result?.content ||
    (typeof result === 'string' ? result : '')
  return text || ''
}

// ---------------------------------------------------------------------------
// Message-type handlers
// ---------------------------------------------------------------------------

/** Handle text / extendedTextMessage */
async function handleTextMessage(
  text: string,
  jid: string,
  pushName: string,
): Promise<NextResponse> {
  const phoneNumber = formatPhone(jid)
  const analysis = await analyzeText(text)

  await db.report.create({
    data: {
      category: analysis.category,
      priority: analysis.priority,
      description: text,
      aiSummary: analysis.summary,
      citizenName: pushName || phoneNumber,
      status: 'Pending',
      source: 'whatsapp',
      whatsappJid: jid,
      phoneNumber,
      messageType: 'text',
    },
  })

  await sendWhatsAppReply(
    jid,
    analysis.replyInSesotho || 'Re amohetse pako ea hau. KHOTLA AI e tla sheba bothata bona.',
  )

  return NextResponse.json({ status: 'processed', type: 'text', category: analysis.category })
}

/** Handle audioMessage (voice note) */
async function handleAudioMessage(
  audioUrl: string,
  jid: string,
  pushName: string,
  apiKey?: string,
): Promise<NextResponse> {
  const phoneNumber = formatPhone(jid)

  // Download & transcribe
  let transcription = ''
  try {
    const base64Audio = await downloadMediaAsBase64(audioUrl, apiKey)
    transcription = await transcribeAudio(base64Audio)
  } catch (err) {
    console.error('Audio transcription failed:', err)
    transcription = '[Audio transcription failed]'
  }

  // Process transcription like a text message
  const analysis = transcription && transcription !== '[Audio transcription failed]'
    ? await analyzeText(transcription)
    : {
        category: 'OTHER',
        priority: 'MEDIUM',
        summary: 'Voice note received – transcription unavailable',
        replyInSesotho: 'Re amohetse molaetsa oa hau oa lentswe. Ha re khone ho oa qala hantle joale, empa re tla sheba bothata bona.',
      }

  await db.report.create({
    data: {
      category: analysis.category,
      priority: analysis.priority,
      description: transcription || '[Voice note]',
      aiSummary: analysis.summary,
      citizenName: pushName || phoneNumber,
      status: 'Pending',
      source: 'whatsapp',
      whatsappJid: jid,
      phoneNumber,
      messageType: 'audio',
      audioUrl,
    },
  })

  const reply = `Re amohetse molaetsa oa hau oa lentswe. ${transcription && transcription !== '[Audio transcription failed]' ? transcription.slice(0, 200) : ''}. Re tla sheba bothata bona.`
  await sendWhatsAppReply(jid, reply)

  return NextResponse.json({ status: 'processed', type: 'audio', category: analysis.category })
}

/** Handle imageMessage */
async function handleImageMessage(
  imageUrl: string,
  caption: string | undefined,
  jid: string,
  pushName: string,
  apiKey?: string,
): Promise<NextResponse> {
  const phoneNumber = formatPhone(jid)

  // Download & analyse with VLM
  let visionResult: Awaited<ReturnType<typeof analyzeImage>>
  try {
    const base64Image = await downloadMediaAsBase64(imageUrl, apiKey)
    visionResult = await analyzeImage(base64Image)
  } catch (err) {
    console.error('Image analysis failed:', err)
    visionResult = {
      objectDetected: 'Unable to analyze',
      severity: 'LOW',
      confidence: 0,
      category: 'OTHER',
      description: caption || 'Image analysis failed',
      recommendedAction: 'Manual review required',
      estimatedUrgency: 'WEEK',
    }
  }

  const priority = visionResult.severity === 'CRITICAL' ? 'HIGH' : visionResult.severity

  await db.report.create({
    data: {
      category: visionResult.category,
      priority,
      description: `[VISION] ${visionResult.objectDetected}: ${visionResult.description}`,
      aiSummary: `Confidence: ${(visionResult.confidence * 100).toFixed(1)}% | Urgency: ${visionResult.estimatedUrgency} | Action: ${visionResult.recommendedAction}`,
      citizenName: pushName || phoneNumber,
      status: 'Pending',
      source: 'whatsapp',
      whatsappJid: jid,
      phoneNumber,
      messageType: 'image',
      imageUrl,
    },
  })

  // Reply in Sesotho with the analysis summary
  const reply = `Re amohetse setšoantšo sa hau. Re bonile: ${visionResult.objectDetected}. Bohlokoa: ${visionResult.severity}. ${visionResult.recommendedAction}. Re tla sebetsa ho bothata bona.`
  await sendWhatsAppReply(jid, reply)

  return NextResponse.json({
    status: 'processed',
    type: 'image',
    category: visionResult.category,
  })
}

/** Handle locationMessage */
async function handleLocationMessage(
  lat: number,
  lng: number,
  locationName: string | undefined,
  jid: string,
  pushName: string,
): Promise<NextResponse> {
  const phoneNumber = formatPhone(jid)

  // Check for a recent pending report from the same user (within 10 min)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  const recentReport = await db.report.findFirst({
    where: {
      whatsappJid: jid,
      status: 'Pending',
      createdAt: { gte: tenMinutesAgo },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (recentReport) {
    // Update the existing report with location
    await db.report.update({
      where: { id: recentReport.id },
      data: { lat, lng },
    })

    await sendWhatsAppReply(
      jid,
      'Re amohetse sebaka sa hau. Re se re sebelisa ho lokisa pako ea hau.',
    )

    return NextResponse.json({
      status: 'processed',
      type: 'location',
      action: 'updated_report',
      reportId: recentReport.id,
    })
  }

  // No recent report – create a new one
  await db.report.create({
    data: {
      category: 'OTHER',
      priority: 'MEDIUM',
      description: locationName ? `Location shared: ${locationName}` : 'Location shared',
      aiSummary: 'Citizen shared their location without a prior text report',
      citizenName: pushName || phoneNumber,
      status: 'Pending',
      source: 'whatsapp',
      whatsappJid: jid,
      phoneNumber,
      messageType: 'location',
      lat,
      lng,
    },
  })

  await sendWhatsAppReply(
    jid,
    'Re amohetse sebaka sa hau. Re se re sebelisa ho lokisa pako ea hau.',
  )

  return NextResponse.json({ status: 'processed', type: 'location', action: 'new_report' })
}

// ---------------------------------------------------------------------------
// Main POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[WhatsApp Webhook] Received:', JSON.stringify(body, null, 2))

    // Only handle messages.upsert events
    const event = body.event
    if (event && event !== 'messages.upsert') {
      console.log(`[WhatsApp Webhook] Ignoring event: ${event}`)
      return NextResponse.json({ status: 'ignored', event })
    }

    // Extract data from Evolution API v2.3.7 format
    const data = body.data || body
    const key = data.key || {}
    const fromMe = key.fromMe === true
    const jid: string = key.remoteJid || ''
    const pushName: string = data.pushName || ''

    // Ignore messages sent by us
    if (fromMe || !jid) {
      return NextResponse.json({ status: 'ignored', reason: fromMe ? 'fromMe' : 'no_jid' })
    }

    // Ignore group messages (group JIDs contain @g.us)
    if (jid.endsWith('@g.us')) {
      return NextResponse.json({ status: 'ignored', reason: 'group_message' })
    }

    const message = data.message || {}
    const declaredType: string = data.messageType || ''

    // Determine actual message type
    const messageType = declaredType || detectMessageType(message)

    if (!messageType) {
      console.log('[WhatsApp Webhook] No recognisable message type found')
      return NextResponse.json({ status: 'no_message_type' })
    }

    // Get WhatsApp config for media downloads (API key)
    const config = await getWhatsAppConfig()

    console.log(`[WhatsApp Webhook] Processing ${messageType} from ${jid} (${pushName})`)

    // Dispatch to the correct handler
    switch (messageType) {
      case 'conversation':
      case 'extendedTextMessage': {
        const text =
          messageType === 'conversation'
            ? message.conversation
            : message.extendedTextMessage?.text || ''
        if (!text) {
          return NextResponse.json({ status: 'empty_text' })
        }
        return await handleTextMessage(text, jid, pushName)
      }

      case 'imageMessage': {
        const img = message.imageMessage || {}
        const imageUrl = img.url || ''
        const caption = img.caption || ''
        if (!imageUrl) {
          return NextResponse.json({ status: 'no_image_url' })
        }
        return await handleImageMessage(imageUrl, caption, jid, pushName, config.apiKey)
      }

      case 'audioMessage': {
        const audio = message.audioMessage || {}
        const audioUrl = audio.url || ''
        if (!audioUrl) {
          return NextResponse.json({ status: 'no_audio_url' })
        }
        return await handleAudioMessage(audioUrl, jid, pushName, config.apiKey)
      }

      case 'locationMessage': {
        const loc = message.locationMessage || {}
        const lat = loc.degreesLatitude
        const lng = loc.degreesLongitude
        const locationName = loc.name || undefined
        if (lat == null || lng == null) {
          return NextResponse.json({ status: 'no_coordinates' })
        }
        return await handleLocationMessage(lat, lng, locationName, jid, pushName)
      }

      default:
        console.log(`[WhatsApp Webhook] Unsupported message type: ${messageType}`)
        // Acknowledge receipt even for unsupported types
        await sendWhatsAppReply(jid, 'Re amohetse molaetsa oa hau. Mofuta ona oa molaetsa ha o so tšehetse joale.')
        return NextResponse.json({ status: 'unsupported_type', type: messageType })
    }
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error)
    // Never crash the webhook – return 200 so Evolution API doesn't retry endlessly
    return NextResponse.json({
      status: 'error',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// ---------------------------------------------------------------------------
// GET handler – webhook verification / health check
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    status: 'KHOTLA AI WhatsApp Webhook Active',
    version: '2.0',
    supportedTypes: ['text', 'audio', 'image', 'location'],
  })
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Detect message type by inspecting the message object keys */
function detectMessageType(message: Record<string, unknown>): string {
  const supportedTypes = ['conversation', 'extendedTextMessage', 'imageMessage', 'audioMessage', 'locationMessage']
  for (const type of supportedTypes) {
    if (message[type] != null) {
      return type
    }
  }
  // Fall back to first non-system key
  const keys = Object.keys(message).filter(
    (k) => !k.startsWith('senderKey') && !k.startsWith('messageContext'),
  )
  return keys[0] || ''
}
