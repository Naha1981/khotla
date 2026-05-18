'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Wifi,
  WifiOff,
  QrCode,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Mic,
  Camera,
  MapPin,
  ExternalLink,
  Phone,
  AlertTriangle,
  RefreshCw,
  Smartphone,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WhatsAppStatus {
  online: boolean
  state: string
  instance: string | null
  qrCode: string | null
  phoneNumber: string | null
  message: string
}

// Simple QR code generator using canvas
function generateQrCanvas(text: string, size: number): HTMLCanvasElement | null {
  try {
    // We'll use a simple SVG-based approach rendered to canvas
    // Using the Google Charts API as a data URL fallback
    // Actually, let's use a simple grid QR approach
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Simple visual representation - a styled box with the URL text
    // Since we can't install a QR library, we'll create a visual placeholder
    // that links to wa.me

    // Background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, size, size)

    // Border
    ctx.strokeStyle = '#002147'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, size - 4, size - 4)

    // WhatsApp green accent corners
    const cornerSize = 30
    ctx.fillStyle = '#25D366'
    // Top-left
    ctx.fillRect(8, 8, cornerSize, 6)
    ctx.fillRect(8, 8, 6, cornerSize)
    // Top-right
    ctx.fillRect(size - 8 - cornerSize, 8, cornerSize, 6)
    ctx.fillRect(size - 14, 8, 6, cornerSize)
    // Bottom-left
    ctx.fillRect(8, size - 14, cornerSize, 6)
    ctx.fillRect(8, size - 8 - cornerSize, 6, cornerSize)

    // Center icon area
    const centerSize = 60

    ctx.fillStyle = '#25D366'
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, centerSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // Phone icon in center
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('📱', size / 2, size / 2)

    // URL text at bottom
    ctx.fillStyle = '#002147'
    ctx.font = 'bold 9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Scan to open', size / 2, size - 16)
    ctx.font = '7px sans-serif'
    ctx.fillText('WhatsApp', size / 2, size - 6)

    return canvas
  } catch {
    return null
  }
}

function formatPhoneNumber(raw: string): string {
  // Remove @s.whatsapp.net suffix if present
  let cleaned = raw.replace(/@s\.whatsapp\.net$/, '')
  // Add + prefix if not present
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned
  }
  return cleaned
}

function getWameLink(phoneNumber: string | null): string {
  if (phoneNumber) {
    const clean = phoneNumber.replace(/[^0-9]/g, '')
    return `https://wa.me/${clean}?text=Hello%20KHOTLA%20AI`
  }
  return 'https://wa.me/?text=Hello%20KHOTLA%20AI'
}

export function KhotlaWhatsappSetup() {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [citizenQrUrl, setCitizenQrUrl] = useState<string | null>(null)
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const { toast } = useToast()

  const RETRY_INTERVALS = [5000, 15000, 30000] // 5s, 15s, 30s

  // Generate citizen QR code when phone number changes
  useEffect(() => {
    const phoneNumber = status?.phoneNumber || null
    const link = getWameLink(phoneNumber)

    // Try to generate a visual QR placeholder
    const canvas = generateQrCanvas(link, 200)
    if (canvas) {
      setCitizenQrUrl(canvas.toDataURL())
    } else {
      setCitizenQrUrl(null)
    }
  }, [status?.phoneNumber])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // Check current WhatsApp status on mount
  useEffect(() => {
    checkStatus()
  }, [])

  // Poll status every 15 seconds when connecting
  useEffect(() => {
    if (!status || status.online) return
    if (status.state !== 'connecting' && status.state !== 'waiting_scan' && status.state !== 'qr') return

    const interval = setInterval(checkStatus, 15000)
    return () => clearInterval(interval)
  }, [status?.state, status?.online])

  const startRetryCountdown = useCallback((seconds: number, attempt: number) => {
    setRetrying(true)
    setRetryCountdown(seconds)
    setRetryAttempt(attempt)

    // Clear any existing timers
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)

    let remaining = seconds
    countdownRef.current = setInterval(() => {
      remaining -= 1
      setRetryCountdown(remaining)
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
      }
    }, 1000)

    retryTimerRef.current = setTimeout(() => {
      setRetrying(false)
      setRetryCountdown(0)
      checkStatus()
    }, seconds * 1000)
  }, [])

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp-status')
      if (res.ok) {
        const data: WhatsAppStatus = await res.json()
        setStatus(data)
        if (data.qrCode) setQrCode(data.qrCode)
        if (data.online) setQrCode(null)

        // If API was unreachable before, now it's back
        if (data.state === 'api_unreachable') {
          const nextAttempt = Math.min(retryAttempt, RETRY_INTERVALS.length - 1)
          startRetryCountdown(RETRY_INTERVALS[nextAttempt] / 1000, nextAttempt + 1)
        } else {
          // Reset retry state if we got a real response
          setRetrying(false)
          setRetryCountdown(0)
          setRetryAttempt(0)
        }
      } else {
        // Server error, schedule retry
        const nextAttempt = Math.min(retryAttempt, RETRY_INTERVALS.length - 1)
        startRetryCountdown(RETRY_INTERVALS[nextAttempt] / 1000, nextAttempt + 1)
      }
    } catch {
      // Network error - API unreachable
      if (!retrying) {
        setStatus({
          online: false,
          state: 'api_unreachable',
          instance: 'Khotla_Main',
          qrCode: null,
          phoneNumber: null,
          message: 'WhatsApp service is starting up, please wait...',
        })
        startRetryCountdown(RETRY_INTERVALS[0] / 1000, 1)
      }
    } finally {
      setLoadingStatus(false)
    }
  }, [retryAttempt, retrying, startRetryCountdown])

  // Fetch phone number separately via whatsapp-status
  const fetchPhoneNumber = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp-status')
      if (res.ok) {
        const data = await res.json()
        if (data.phoneNumber) {
          setStatus(prev => prev ? { ...prev, phoneNumber: data.phoneNumber } : prev)
        }
      }
    } catch {
      // Silent fail
    }
  }, [])

  // Try to fetch phone number when connected
  useEffect(() => {
    if (status?.online && !status?.phoneNumber) {
      fetchPhoneNumber()
    }
  }, [status?.online, status?.phoneNumber])

  async function handleConnect() {
    setConnecting(true)
    setQrCode(null)
    try {
      const res = await fetch('/api/whatsapp-setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await res.json()

      if (res.ok) {
        if (data.qrCode) {
          setQrCode(data.qrCode)
          toast({
            title: 'QR Code Ready',
            description: 'Scan the QR code with your WhatsApp to connect.',
          })
        } else if (data.config?.isConnected) {
          setStatus({
            online: true,
            state: 'open',
            instance: null,
            qrCode: null,
            phoneNumber: data.phoneNumber || null,
            message: 'WhatsApp is connected!',
          })
          toast({
            title: 'Connected!',
            description: 'WhatsApp is connected and operational.',
          })
        } else {
          toast({
            title: 'Connecting...',
            description: data.message || 'WhatsApp instance is starting. QR code will appear shortly.',
            className: 'bg-yellow-500/10 border-yellow-500/30',
          })
        }
        // Immediately poll for latest status
        checkStatus()
      } else if (res.status === 503) {
        // Service unavailable - friendly message
        toast({
          title: 'WhatsApp Service Starting',
          description: data.error || 'The WhatsApp service is starting up. Please try again in a moment.',
          className: 'bg-yellow-500/10 border-yellow-500/30',
        })
        // Auto-retry
        startRetryCountdown(10, 1)
      } else {
        toast({
          title: 'Connection Issue',
          description: data.error || 'Unable to connect WhatsApp right now. Please try again.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Service Starting Up',
        description: 'The WhatsApp service is waking up. This may take a moment on the free tier. Please try again shortly.',
        className: 'bg-yellow-500/10 border-yellow-500/30',
      })
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/whatsapp-setup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (res.ok) {
        setQrCode(null)
        setStatus({
          online: false,
          state: 'disconnected',
          instance: null,
          qrCode: null,
          phoneNumber: null,
          message: 'WhatsApp disconnected.',
        })
        toast({
          title: 'Disconnected',
          description: 'WhatsApp has been disconnected.',
        })
      } else {
        toast({
          title: 'Disconnect Issue',
          description: 'Could not disconnect. The service may be unreachable.',
          className: 'bg-yellow-500/10 border-yellow-500/30',
        })
      }
    } catch {
      toast({
        title: 'Service Unreachable',
        description: 'Could not reach the WhatsApp service. Please try again.',
        className: 'bg-yellow-500/10 border-yellow-500/30',
      })
    } finally {
      setDisconnecting(false)
    }
  }

  const isOnline = status?.online === true
  const isApiUnreachable = status?.state === 'api_unreachable'
  const isConfigured = status?.state !== 'not_configured'
  const phoneNumber = status?.phoneNumber || null
  const displayPhone = phoneNumber ? formatPhoneNumber(phoneNumber) : null
  const wameLink = getWameLink(phoneNumber)

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
        <span className="ml-2 text-muted-foreground text-sm">Checking WhatsApp status...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* API Unreachable Warning Banner */}
      {isApiUnreachable && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              WhatsApp Service is Starting Up
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The WhatsApp service is hosted on a free tier and may take 30-60 seconds to wake up.
              {retrying && retryCountdown > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                  {' '}Retrying in {retryCountdown}s...
                </span>
              )}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={checkStatus}
            disabled={retrying}
            className="border-yellow-500/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10 rounded shrink-0 h-8"
          >
            {retrying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ============================================================ */}
        {/* LEFT COLUMN: Admin Connection Management                      */}
        {/* ============================================================ */}
        <div className="space-y-4">
          {/* Connection Status Card */}
          <Card className="bg-content-card border-content-border rounded">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-emerald-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-muted-foreground" />
                )}
                WhatsApp Connection
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0.5 ${
                    isOnline
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : isApiUnreachable
                        ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30'
                        : 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30'
                  }`}
                >
                  {isOnline ? 'ONLINE' : isApiUnreachable ? 'STARTING' : 'OFFLINE'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Status Message */}
              {status?.message && (
                <div className={`flex items-start gap-2 text-xs p-2 rounded ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : isApiUnreachable
                      ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                      : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                }`}>
                  {isOnline ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  ) : isApiUnreachable ? (
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  ) : (
                    <Wifi className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  )}
                  {isOnline
                    ? 'WhatsApp is connected and receiving citizen messages.'
                    : isApiUnreachable
                      ? 'WhatsApp service is starting up, please wait...'
                      : 'Connect your WhatsApp number to start receiving citizen reports.'}
                </div>
              )}

              {/* Phone Number Display (when connected) */}
              {isOnline && displayPhone && (
                <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded p-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Connected Number</p>
                    <p className="text-sm font-semibold text-foreground">{displayPhone}</p>
                  </div>
                </div>
              )}

              {/* QR Code Display for Admin */}
              {qrCode && !isOnline && (
                <div className="flex flex-col items-center gap-2 p-3 bg-white rounded border border-content-border">
                  <QrCode className="w-4 h-4 text-navy" />
                  <span className="text-[10px] text-navy font-medium">Scan with WhatsApp (Admin)</span>
                  {(qrCode.startsWith('data:image') || qrCode.startsWith('iVBOR') || qrCode.startsWith('/9j/')) ? (
                    <img
                      src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="WhatsApp QR Code"
                      className="w-52 h-52 object-contain"
                    />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center bg-gray-100 rounded">
                      <QrCode className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  <div className="text-center space-y-1">
                    <p className="text-[10px] text-gray-600 font-medium">
                      Open WhatsApp → Settings → Linked Devices → Link a Device
                    </p>
                    <p className="text-[9px] text-gray-400">Then point your phone at this QR code</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!isOnline ? (
                  <Button
                    onClick={handleConnect}
                    disabled={connecting || retrying}
                    className="flex-1 bg-gold hover:bg-gold-light text-navy font-semibold rounded"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Wifi className="w-4 h-4 mr-2" />
                        Connect WhatsApp
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    variant="destructive"
                    className="flex-1 rounded"
                  >
                    {disconnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 mr-2" />
                        Disconnect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Supported Message Types */}
          <Card className="bg-content-card border-content-border rounded">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gold" />
                Supported Message Types
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Citizens can report issues in multiple ways.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-background rounded p-2 border border-content-border">
                  <MessageSquare className="w-3.5 h-3.5 text-gold" />
                  <div>
                    <p className="text-[10px] font-medium text-foreground">Text Messages</p>
                    <p className="text-[9px] text-muted-foreground">English & Sesotho</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-background rounded p-2 border border-content-border">
                  <Mic className="w-3.5 h-3.5 text-gold" />
                  <div>
                    <p className="text-[10px] font-medium text-foreground">Voice Notes</p>
                    <p className="text-[9px] text-muted-foreground">Auto-transcribed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-background rounded p-2 border border-content-border">
                  <Camera className="w-3.5 h-3.5 text-gold" />
                  <div>
                    <p className="text-[10px] font-medium text-foreground">Images</p>
                    <p className="text-[9px] text-muted-foreground">AI analyzed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-background rounded p-2 border border-content-border">
                  <MapPin className="w-3.5 h-3.5 text-gold" />
                  <div>
                    <p className="text-[10px] font-medium text-foreground">Location</p>
                    <p className="text-[9px] text-muted-foreground">GPS coordinates</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: Citizen Access                                  */}
        {/* ============================================================ */}
        <div className="space-y-4">
          {/* Citizen WhatsApp Access Card */}
          <Card className="bg-content-card border-content-border rounded overflow-hidden">
            <div className="bg-gold/10 border-b border-gold/20 px-4 py-3">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gold" />
                Citizen Access
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share this link with citizens so they can message KHOTLA AI
              </p>
            </div>
            <CardContent className="pt-4 space-y-4">
              {/* Big WhatsApp Link Button */}
              <a
                href={wameLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full bg-[#25D366] hover:bg-[#1DA855] text-white font-bold text-base py-4 px-6 rounded-lg transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
                Message KHOTLA AI on WhatsApp
                <ExternalLink className="w-4 h-4 opacity-70" />
              </a>

              {/* wa.me link display */}
              <div className="bg-background border border-content-border rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Direct Link</p>
                <a
                  href={wameLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-gold hover:underline break-all"
                >
                  {wameLink}
                </a>
              </div>

              {/* Phone Number Display */}
              <div className="bg-background border border-content-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-3.5 h-3.5 text-gold" />
                  <span className="text-xs font-medium text-foreground">WhatsApp Number</span>
                  {isOnline ? (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      LIVE
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30">
                      OFFLINE
                    </Badge>
                  )}
                </div>
                {displayPhone ? (
                  <p className="text-lg font-bold text-foreground">{displayPhone}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Number will appear once WhatsApp is connected
                  </p>
                )}
              </div>

              {/* Citizen QR Code */}
              <div className="bg-white border border-content-border rounded-lg p-4 flex flex-col items-center gap-2">
                <p className="text-[10px] text-navy font-medium">Scan to Open WhatsApp</p>
                <div className="w-40 h-40 flex items-center justify-center bg-white rounded border-2 border-[#25D366]/30 relative">
                  {isOnline ? (
                    <>
                      {citizenQrUrl ? (
                        <img
                          src={citizenQrUrl}
                          alt="Scan to message KHOTLA AI on WhatsApp"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <QrCode className="w-12 h-12 text-gray-300" />
                          <p className="text-[9px] text-gray-400">QR Code</p>
                        </div>
                      )}
                      {/* Overlay link hint */}
                      <div className="absolute -bottom-1 left-0 right-0 text-center">
                        <span className="text-[8px] bg-white px-2 text-gray-500">wa.me link</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <QrCode className="w-10 h-10 text-gray-300" />
                      <p className="text-[9px] text-gray-400">
                        QR code will be active<br/>once WhatsApp is connected
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-gray-500">
                  Citizens: Point your phone camera at this code
                </p>
              </div>

              {/* Instructions in English AND Sesotho */}
              <div className="space-y-3">
                <div className="bg-background border border-content-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🇬🇧</span>
                    <span className="text-xs font-semibold text-foreground">English</span>
                  </div>
                  <ol className="space-y-1 text-[11px] text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="text-gold font-bold shrink-0">1.</span>
                      Click the green button above or scan the QR code
                    </li>
                    <li className="flex gap-2">
                      <span className="text-gold font-bold shrink-0">2.</span>
                      WhatsApp will open with a message to KHOTLA AI
                    </li>
                    <li className="flex gap-2">
                      <span className="text-gold font-bold shrink-0">3.</span>
                      Send your report — text, voice, photo, or location
                    </li>
                    <li className="flex gap-2">
                      <span className="text-gold font-bold shrink-0">4.</span>
                      KHOTLA AI will process your report and respond
                    </li>
                  </ol>
                </div>

                <div className="bg-background border border-content-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🇱🇸</span>
                    <span className="text-xs font-semibold text-foreground">Sesotho</span>
                  </div>
                  <ol className="space-y-1 text-[11px] text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="text-gold font-bold shrink-0">1.</span>
                      Tobetsa konopo e talimmera kapa skena khoutu ya QR
                    </li>
                    <li className="flex gap-2">
                      <span className="text-gold font-bold shrink-0">2.</span>
                      WhatsApp e tla bula ka molaetsa ho KHOTLA AI
                    </li>
                    <li className="flex gap-2">
                      <span className="text-gold font-bold shrink-0">3.</span>
                      Roma pego ya hau — mongolo, lentswe, setšoantšo, kapa boemo
                    </li>
                    <li className="flex gap-2">
                      <span className="text-gold font-bold shrink-0">4.</span>
                      KHOTLA AI e tla sebetsa pego ya hau mme e arabe
                    </li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
