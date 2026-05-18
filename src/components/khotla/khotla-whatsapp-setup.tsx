'use client'

import { useState, useEffect, useCallback } from 'react'
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
  ArrowRight,
  User,
  Send,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WhatsAppStatus {
  online: boolean
  state: string
  instance: string | null
  qrCode: string | null
  message: string
}

export function KhotlaWhatsappSetup() {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  const { toast } = useToast()

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

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp-status')
      if (res.ok) {
        const data: WhatsAppStatus = await res.json()
        setStatus(data)
        if (data.qrCode) setQrCode(data.qrCode)
        if (data.online) setQrCode(null)
      }
    } catch {
      // Silent fail on poll
    } finally {
      setLoadingStatus(false)
    }
  }, [])

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
          })
        }
        // Immediately poll for latest status
        checkStatus()
      } else {
        toast({
          title: 'Connection Issue',
          description: 'Unable to connect WhatsApp right now. Please try again.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Connection Issue',
        description: 'Could not reach the server. Please try again.',
        variant: 'destructive',
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
          message: 'WhatsApp disconnected.',
        })
        toast({
          title: 'Disconnected',
          description: 'WhatsApp has been disconnected.',
        })
      } else {
        toast({
          title: 'Disconnect Issue',
          description: 'Could not disconnect. Please try again.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Connection Issue',
        description: 'Could not reach the server. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setDisconnecting(false)
    }
  }

  const isOnline = status?.online === true
  const isConfigured = status?.state !== 'not_configured'

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
        <span className="ml-2 text-muted-foreground text-sm">Checking WhatsApp status...</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Column: Connection */}
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
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={`text-[10px] px-2 py-0.5 ${
                  isOnline
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30'
                }`}
              >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Status Message */}
            {status?.message && (
              <div className={`flex items-start gap-2 text-xs p-2 rounded ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
              }`}>
                {isOnline ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                ) : (
                  <Wifi className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                )}
                {isOnline ? 'WhatsApp is connected and receiving citizen messages.' : 'Connect your WhatsApp number to start receiving citizen reports.'}
              </div>
            )}

            {/* QR Code Display */}
            {qrCode && !isOnline && (
              <div className="flex flex-col items-center gap-2 p-3 bg-white rounded border border-content-border">
                <QrCode className="w-4 h-4 text-navy" />
                <span className="text-[10px] text-navy font-medium">Scan with WhatsApp</span>
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
                  disabled={connecting}
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

      {/* Right Column: How It Works */}
      <div className="space-y-4">
        {/* How to Connect */}
        <Card className="bg-content-card border-content-border rounded">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <QrCode className="w-4 h-4 text-gold" />
              How to Connect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2.5">
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gold">1</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Click &quot;Connect WhatsApp&quot;</p>
                  <p className="text-[10px] text-muted-foreground">A QR code will appear on screen.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gold">2</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Scan the QR code with WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground">Open WhatsApp on your phone, go to Settings → Linked Devices → Link a Device.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gold">3</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Citizens can now text this number</p>
                  <p className="text-[10px] text-muted-foreground">All incoming messages are automatically processed by KHOTLA AI.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Citizen Report Flow */}
        <Card className="bg-content-card border-content-border rounded">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-gold" />
              Citizen Report Flow
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              How citizen reports travel through the KHOTLA AI system.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/20 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Citizen</p>
                  <p className="text-[9px] text-muted-foreground">Reports issue via WhatsApp</p>
                </div>
              </div>

              <div className="flex items-center justify-center pl-4">
                <ArrowRight className="w-4 h-4 text-gold rotate-90" />
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">AI Analysis</p>
                  <p className="text-[9px] text-muted-foreground">Categorizes, prioritizes & summarizes</p>
                </div>
              </div>

              <div className="flex items-center justify-center pl-4">
                <ArrowRight className="w-4 h-4 text-gold rotate-90" />
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">National Dashboard</p>
                  <p className="text-[9px] text-muted-foreground">Report appears for officials to triage</p>
                </div>
              </div>

              <div className="flex items-center justify-center pl-4">
                <ArrowRight className="w-4 h-4 text-gold rotate-90" />
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Official Resolves</p>
                  <p className="text-[9px] text-muted-foreground">Status updated to Resolved</p>
                </div>
              </div>

              <div className="flex items-center justify-center pl-4">
                <ArrowRight className="w-4 h-4 text-gold rotate-90" />
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gold/20 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Citizen Notified</p>
                  <p className="text-[9px] text-muted-foreground">WhatsApp message sent with update</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
