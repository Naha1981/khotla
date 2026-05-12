'use client'

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Shield, Wifi, WifiOff, Activity, Sun, Moon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const emptySubscribe = () => () => {}
function useHasMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

export function KhotlaHeader() {
  const [whatsappStatus, setWhatsappStatus] = useState<'online' | 'offline' | 'checking'>('checking')
  const [lastChecked, setLastChecked] = useState<string>('')
  const mounted = useHasMounted()
  const hasChecked = useRef(false)
  const { theme, setTheme } = useTheme()

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
    <header className="bg-header-bg border-b border-header-border px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded bg-gold">
            <Shield className="w-6 h-6 text-navy" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              KHOTLA AI
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-300 tracking-widest uppercase">
              Sechaba se Bua — The People Speak
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-300">
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
            <span className="hidden lg:inline text-[10px] text-gray-400">
              Last check: {lastChecked}
            </span>
          )}

          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8 p-0 rounded text-gray-300 hover:text-white hover:bg-white/10"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
