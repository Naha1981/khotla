'use client'

import { useTheme } from 'next-themes'
import { Shield, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}
function useHasMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

export function KhotlaHeader() {
  const mounted = useHasMounted()
  const { theme, setTheme } = useTheme()

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
              Sechaba sea Bua — The People Speak
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>System Active</span>
          </div>

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
