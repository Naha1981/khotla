import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, imageUrl } = await req.json()

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json({ error: 'Image is required (base64 or URL)' }, { status: 400 })
    }

    const zai = await ZAI.create()

    const imageSource = imageBase64
      ? { url: imageBase64 }
      : { url: imageUrl }

    const response = await zai.chat.completions.createVision({
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

If no civic issue is found, set severity to LOW and category to OTHER.`
            },
            {
              type: 'image_url',
              image_url: imageSource
            }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    })

    const aiContent = response.choices[0]?.message?.content

    let parsed: {
      objectDetected: string
      severity: string
      confidence: number
      category: string
      description: string
      recommendedAction: string
      estimatedUrgency: string
    }

    try {
      let cleaned = (aiContent || '').trim()
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {
        objectDetected: 'Unable to analyze',
        severity: 'LOW',
        confidence: 0,
        category: 'OTHER',
        description: aiContent || 'Vision analysis failed',
        recommendedAction: 'Manual review required',
        estimatedUrgency: 'WEEK'
      }
    }

    // Save to database
    const report = await db.report.create({
      data: {
        category: parsed.category,
        priority: parsed.severity === 'CRITICAL' ? 'HIGH' : parsed.severity,
        description: `[VISION] ${parsed.objectDetected}: ${parsed.description}`,
        aiSummary: `Confidence: ${(parsed.confidence * 100).toFixed(1)}% | Urgency: ${parsed.estimatedUrgency} | Action: ${parsed.recommendedAction}`,
        citizenName: 'Edge Vision Module',
        status: 'Pending',
        source: 'vision',
        imageUrl: imageUrl || null,
      }
    })

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        ...parsed,
        confidence: parsed.confidence
      }
    })
  } catch (error) {
    console.error('Vision analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
