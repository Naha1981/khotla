import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { message, citizenName } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const zai = await ZAI.create()

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are KHOTLA AI, the sovereign AI assistant for the Kingdom of Lesotho's government dashboard. You analyze citizen reports and complaints in English and Sesotho.

Your job is to:
1. Understand the citizen's issue (can be in English or Sesotho)
2. Categorize it into one of: WATER, ROADS, CORRUPTION, HEALTH, EDUCATION, ELECTRICITY, SANITATION, OTHER
3. Assign a priority: HIGH (life-threatening, critical infrastructure failure, corruption), MEDIUM (significant but not critical), LOW (minor inconvenience, suggestions)
4. Provide a brief summary of the issue in English

You MUST respond with ONLY a valid JSON object in this exact format:
{
  "category": "CATEGORY_HERE",
  "priority": "PRIORITY_HERE",
  "summary": "Brief summary of the issue",
  "suggestedAction": "Brief suggested action for the government"
}

Do NOT include any text outside the JSON object.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      thinking: { type: 'disabled' }
    })

    const aiResponse = completion.choices[0]?.message?.content

    let parsed: { category: string; priority: string; summary: string; suggestedAction: string }
    try {
      // Strip markdown code blocks if present
      let cleaned = (aiResponse || '').trim()
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {
        category: 'OTHER',
        priority: 'MEDIUM',
        summary: aiResponse || 'Unable to analyze message',
        suggestedAction: 'Review manually'
      }
    }

    // Save to database
    const report = await db.report.create({
      data: {
        category: parsed.category,
        priority: parsed.priority,
        description: message,
        aiSummary: parsed.summary + ' | Suggested Action: ' + parsed.suggestedAction,
        citizenName: citizenName || 'Anonymous',
        status: 'Pending',
        source: 'web',
      }
    })

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        category: parsed.category,
        priority: parsed.priority,
        summary: parsed.summary,
        suggestedAction: parsed.suggestedAction,
      }
    })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
