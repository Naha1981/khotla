'use client'

// KHOTLA AI - Sovereign Governance Platform
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { KhotlaHeader } from '@/components/khotla/khotla-header'
import { KhotlaFooter } from '@/components/khotla/khotla-footer'
import { KhotlaDashboard } from '@/components/khotla/khotla-dashboard'
import { KhotlaMap } from '@/components/khotla/khotla-map'
import { KhotlaChat } from '@/components/khotla/khotla-chat'
import { KhotlaVision } from '@/components/khotla/khotla-vision'
import { KhotlaWhatsappSetup } from '@/components/khotla/khotla-whatsapp-setup'
import {
  LayoutDashboard,
  Map,
  MessageSquare,
  ScanEye,
  Phone,
  Database,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

export default function Home() {
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    // Auto-seed on first load
    seedDatabase()
  }, [])

  async function seedDatabase() {
    if (seeded) return
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSeeded(true)
      }
    } catch {
      // Silently fail
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <KhotlaHeader />

      <main className="flex-1 px-4 sm:px-6 py-4 max-w-[1600px] mx-auto w-full">
        {/* Data seeding indicator */}
        {seeding && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground bg-seed-bg rounded px-3 py-2">
            <Loader2 className="w-3 h-3 animate-spin text-gold" />
            Initializing database with sample data...
          </div>
        )}
        {seeded && (
          <div className="mb-4 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-3 py-2">
            <CheckCircle2 className="w-3 h-3" />
            Database initialized. Demo data loaded.
          </div>
        )}

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="bg-tab-bg border border-tab-border rounded p-1 h-auto flex-wrap gap-1">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-gold data-[state=active]:text-navy rounded text-xs sm:text-sm gap-1.5 px-3 py-1.5"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Board</span>
            </TabsTrigger>
            <TabsTrigger
              value="map"
              className="data-[state=active]:bg-gold data-[state=active]:text-navy rounded text-xs sm:text-sm gap-1.5 px-3 py-1.5"
            >
              <Map className="w-4 h-4" />
              <span className="hidden sm:inline">Transparency Map</span>
              <span className="sm:hidden">Map</span>
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className="data-[state=active]:bg-gold data-[state=active]:text-navy rounded text-xs sm:text-sm gap-1.5 px-3 py-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Citizen Chat</span>
              <span className="sm:hidden">Chat</span>
            </TabsTrigger>
            <TabsTrigger
              value="vision"
              className="data-[state=active]:bg-gold data-[state=active]:text-navy rounded text-xs sm:text-sm gap-1.5 px-3 py-1.5"
            >
              <ScanEye className="w-4 h-4" />
              <span className="hidden sm:inline">Edge Vision</span>
              <span className="sm:hidden">Vision</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="data-[state=active]:bg-gold data-[state=active]:text-navy rounded text-xs sm:text-sm gap-1.5 px-3 py-1.5">
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp Setup</span>
              <span className="sm:hidden">WA</span>
            </TabsTrigger>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground text-xs gap-1.5 h-8 px-2 ml-1"
              onClick={seedDatabase}
              disabled={seeding}
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Reset Demo Data</span>
            </Button>
          </TabsList>

          <TabsContent value="dashboard">
            <KhotlaDashboard />
          </TabsContent>
          <TabsContent value="map">
            <KhotlaMap />
          </TabsContent>
          <TabsContent value="chat">
            <KhotlaChat />
          </TabsContent>
          <TabsContent value="vision">
            <KhotlaVision />
          </TabsContent>
          <TabsContent value="whatsapp">
            <KhotlaWhatsappSetup />
          </TabsContent>
        </Tabs>
      </main>

      <KhotlaFooter />
    </div>
  )
}
