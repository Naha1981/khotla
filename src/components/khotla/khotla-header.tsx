'use client'

import { useState, useEffect, useRef } from 'react'
import { Shield, Wifi, WifiOff, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function KhotlaHeader() {
  const [whatsappStatus, setWhatsappStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [lastChecked, setLastChecked] = useState<string>('')
  const hasChecked = useRef(false)

  useEffect(() => {
    if (hasChecked.current) return
    hasChecked.current = true

    async function initialCheck() {
      try {
        const res = await fetch('/api/whatsapp-status')
        const data = await res.json()
        setWhatsappStatus(data.online ? 'online' : 'offline')
        setLastChecked(new Date().toLocaleTimeString())
      } catch {
        setWhatsappStatus('offline')
      }
    }

    initialCheck()
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp-status')
        const data = await res.json()
        setWhatsappStatus(data.online ? 'online' : 'offline')
        setLastChecked(new Date().toLocaleTimeString())
      } catch {
        setWhatsappStatus('offline')
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <header className="bg-navy-dark border-b border-white/10 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded bg-gold">
            <Shield className="w-6 h-6 text-navy" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              KHOTLA AI
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground tracking-widest uppercase">
              Sechaba se Bua — The People Speak
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="w-3.5 h-3.5 text-gold" />
            <span>Sovereign AI Active</span>
          </div>
          <Badge
            variant="outline"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border-0 ${
              whatsappStatus === 'online'
                ? 'bg-emerald-500/20 text-emerald-400'
                : whatsappStatus === 'offline'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}
          >
            {whatsappStatus === 'online' ? (
              <Wifi className="w-3 h-3" />
            ) : whatsappStatus === 'offline' ? (
              <WifiOff className="w-3 h-3" />
            ) : (
              <Activity className="w-3 h-3 animate-pulse" />
            )}
            <span className="hidden sm:inline">
              WhatsApp Gateway: {whatsappStatus === 'online' ? 'Online' : whatsappStatus === 'offline' ? 'Offline' : 'Checking...'}
            </span>
            <span className="sm:hidden">
              WA: {whatsappStatus === 'online' ? 'On' : whatsappStatus === 'offline' ? 'Off' : '...'}
            </span>
          </Badge>
          {lastChecked && (
            <span className="hidden lg:inline text-[10px] text-muted-foreground">
              Last check: {lastChecked}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
