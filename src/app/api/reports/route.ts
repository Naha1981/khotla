import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const reports = await db.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Fetch reports error:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const report = await db.report.create({
      data: {
        category: data.category || 'OTHER',
        priority: data.priority || 'MEDIUM',
        description: data.description || '',
        aiSummary: data.aiSummary || null,
        citizenName: data.citizenName || 'Anonymous',
        status: data.status || 'Pending',
        source: data.source || 'web',
        lat: data.lat || null,
        lng: data.lng || null,
        imageUrl: data.imageUrl || null,
      }
    })
    return NextResponse.json({ report })
  } catch (error) {
    console.error('Create report error:', error)
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }
}
