import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    // Seed sample projects (Lesotho coordinates)
    const existingProjects = await db.project.count()
    if (existingProjects === 0) {
      await db.project.createMany({
        data: [
          { title: 'Maseru Road Rehabilitation', budget: 'M 45,000,000', progress: 72, lat: -29.3101, lng: 27.4868, category: 'ROADS', status: 'Active' },
          { title: 'Mafeteng Water Supply Upgrade', budget: 'M 12,500,000', progress: 45, lat: -29.7750, lng: 27.2350, category: 'WATER', status: 'Active' },
          { title: 'Teyateyaneng Clinic Construction', budget: 'M 8,200,000', progress: 88, lat: -29.1426, lng: 27.7366, category: 'HEALTH', status: 'Active' },
          { title: 'Leribe Bridge Repair', budget: 'M 22,000,000', progress: 30, lat: -28.8794, lng: 27.7597, category: 'ROADS', status: 'Active' },
          { title: 'Mohale Dam Maintenance', budget: 'M 65,000,000', progress: 95, lat: -29.4167, lng: 28.0500, category: 'WATER', status: 'Active' },
          { title: "Qacha's Nek School Building", budget: 'M 5,800,000', progress: 60, lat: -30.1167, lng: 28.6833, category: 'EDUCATION', status: 'Active' },
          { title: 'Mokhotlong Electrification', budget: 'M 18,500,000', progress: 15, lat: -29.2833, lng: 29.0667, category: 'ELECTRICITY', status: 'Active' },
          { title: 'Butha-Buthe Sanitation Project', budget: 'M 7,300,000', progress: 55, lat: -28.7667, lng: 28.2500, category: 'SANITATION', status: 'Active' },
          { title: 'Thaba-Tseka Agricultural Road', budget: 'M 14,000,000', progress: 40, lat: -29.5167, lng: 28.6167, category: 'ROADS', status: 'Active' },
          { title: 'Quthing Health Center', budget: 'M 9,600,000', progress: 100, lat: -30.4000, lng: 27.7000, category: 'HEALTH', status: 'Completed' },
        ]
      })
    }

    // Seed sample reports
    const existingReports = await db.report.count()
    if (existingReports === 0) {
      await db.report.createMany({
        data: [
          { category: 'ROADS', priority: 'HIGH', description: 'Massive potholes on Main North 1 road near Maseru, causing accidents', citizenName: '+266 5600 1234', status: 'Pending', source: 'whatsapp', aiSummary: 'Critical road damage on Main North 1 near Maseru causing safety hazards' },
          { category: 'WATER', priority: 'HIGH', description: 'No water supply in Ha Abia for 3 days. Pipes burst during freeze.', citizenName: '+266 5600 5678', status: 'In Progress', source: 'whatsapp', aiSummary: 'Water supply disruption in Ha Abia due to burst pipes from freezing temperatures' },
          { category: 'CORRUPTION', priority: 'HIGH', description: 'Road construction funds missing. Contractor not paid but project marked complete.', citizenName: 'Anonymous', status: 'Pending', source: 'web', aiSummary: 'Alleged misappropriation of road construction funds' },
          { category: 'ELECTRICITY', priority: 'MEDIUM', description: 'Power outages every evening in Maputsoe. Industry affected.', citizenName: '+266 5600 9012', status: 'Pending', source: 'whatsapp', aiSummary: 'Recurring evening power outages in Maputsoe affecting industrial operations' },
          { category: 'HEALTH', priority: 'MEDIUM', description: 'Clinic in Qacha Nek has no medicines for 2 weeks', citizenName: '+266 5600 3456', status: 'In Progress', source: 'whatsapp', aiSummary: 'Medicine shortage at Qacha Nek clinic for extended period' },
          { category: 'EDUCATION', priority: 'LOW', description: 'School roof leaking, needs repair before winter', citizenName: '+266 5600 7890', status: 'Pending', source: 'web', aiSummary: 'School building maintenance needed - roof leak requiring repair' },
          { category: 'SANITATION', priority: 'MEDIUM', description: 'Sewage overflow in Ha Thetsane residential area', citizenName: '+266 5600 2345', status: 'Resolved', source: 'whatsapp', aiSummary: 'Sewage overflow in Ha Thetsane residential area resolved' },
          { category: 'ROADS', priority: 'MEDIUM', description: 'Street lights not working on Kingsway road', citizenName: '+266 5600 6789', status: 'Pending', source: 'web', aiSummary: 'Non-functioning street lights on Kingsway road' },
        ]
      })
    }

    return NextResponse.json({
      success: true,
      projectsCreated: existingProjects === 0 ? 10 : 0,
      reportsCreated: existingReports === 0 ? 8 : 0,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Failed to seed data' }, { status: 500 })
  }
}
