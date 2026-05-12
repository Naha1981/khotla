'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Settings,
  QrCode,
  Wifi,
  WifiOff,
  Link2,
  MessageSquare,
  Mic,
  Camera,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  Monitor,
  Send,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WhatsAppConfig {
  id: string
  instanceName: string
  apiBaseUrl: string
  apiKey: string | null
  webhookUrl: string | null
  isConnected: boolean
  liveState?: string
  qrCode?: string | null
  lastConnectedAt: string | null
}

interface WhatsAppStatus {
  online: boolean
  state: string
  instance: string | null
  qrCode: string | null
  message: string
}

export function KhotlaWhatsappSetup() {
  // Configuration form state
  const [apiBaseUrl, setApiBaseUrl] = useState('https://my-evolution-api-capsule.onrender.com')
  const [apiKey, setApiKey] = useState('')
  const [instanceName, setInstanceName] = useState('Khotla_Main')
  const [showApiKey, setShowApiKey] = useState(false)

  // UI state
  const [configSaved, setConfigSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<WhatsAppStatus | null>(null)
  const [webhookActive, setWebhookActive] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)

  const { toast } = useToast()

  // Load existing config on mount
  useEffect(() => {
    loadConfig()
  }, [])

  // Poll WhatsApp status every 15 seconds when config is saved
  useEffect(() => {
    if (!configSaved) return

    pollStatus()
    const interval = setInterval(pollStatus, 15000)
    return () => clearInterval(interval)
  }, [configSaved])

  async function loadConfig() {
    try {
      const res = await fetch('/api/whatsapp-setup')
      if (res.ok) {
        const data = await res.json()
        const configs: WhatsAppConfig[] = data.configs || []
        if (configs.length > 0) {
          const config = configs[0]
          setApiBaseUrl(config.apiBaseUrl || 'https://my-evolution-api-capsule.onrender.com')
          setInstanceName(config.instanceName || 'Khotla_Main')
          if (config.apiKey) setApiKey(config.apiKey)
          setConfigSaved(true)
          if (config.qrCode) setQrCode(config.qrCode)
          if (config.isConnected) {
            setConnectionStatus({
              online: true,
              state: 'open',
              instance: config.instanceName,
              qrCode: config.qrCode,
              message: 'WhatsApp is connected and operational.',
            })
          }
          if (config.webhookUrl) setWebhookActive(true)
        }
      }
    } catch {
      // Silently fail on load
    } finally {
      setLoadingConfig(false)
    }
  }

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp-status')
      if (res.ok) {
        const data: WhatsAppStatus = await res.json()
        setConnectionStatus(data)
        if (data.qrCode) setQrCode(data.qrCode)
      }
    } catch {
      // Polling fails silently
    }
  }, [])

  async function handleSaveConfig() {
    if (!apiBaseUrl.trim() || !apiKey.trim() || !instanceName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required. Please fill in the API Base URL, API Key, and Instance Name.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/whatsapp-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceName: instanceName.trim(),
          apiKey: apiKey.trim(),
          apiBaseUrl: apiBaseUrl.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setConfigSaved(true)
        setWebhookActive(!!data.config?.webhookUrl)
        toast({
          title: 'Configuration Saved',
          description: 'Evolution API credentials have been validated and saved. You can now connect WhatsApp.',
        })
      } else {
        toast({
          title: 'Save Failed',
          description: data.error || 'Failed to save configuration. Please check your credentials.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Could not reach the server. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleConnect() {
    setConnecting(true)
    setQrCode(null)
    try {
      const res = await fetch('/api/whatsapp-setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: instanceName.trim() }),
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
          setConnectionStatus({
            online: true,
            state: 'open',
            instance: instanceName,
            qrCode: null,
            message: 'WhatsApp is connected!',
          })
          toast({
            title: 'Connected!',
            description: 'WhatsApp instance is already connected and operational.',
          })
        } else {
          toast({
            title: 'Instance Created',
            description: data.message || 'Instance created. QR code may take a moment to generate.',
          })
        }
        // Immediately poll for latest status
        pollStatus()
      } else {
        toast({
          title: 'Connection Failed',
          description: data.error || 'Failed to create/connect WhatsApp instance.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Connection Error',
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
        body: JSON.stringify({ instanceName: instanceName.trim() }),
      })

      const data = await res.json()

      if (res.ok) {
        setQrCode(null)
        setConnectionStatus({
          online: false,
          state: 'disconnected',
          instance: instanceName,
          qrCode: null,
          message: 'Disconnected successfully.',
        })
        toast({
          title: 'Disconnected',
          description: data.message || 'WhatsApp instance has been disconnected.',
        })
      } else {
        toast({
          title: 'Disconnect Failed',
          description: data.error || 'Failed to disconnect WhatsApp instance.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Could not reach the server. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleTestWebhook() {
    setTestingWebhook(true)
    try {
      const res = await fetch('/api/whatsapp-webhook')
      if (res.ok) {
        const data = await res.json()
        setWebhookActive(true)
        toast({
          title: 'Webhook Active',
          description: `Webhook is running. Supported types: ${data.supportedTypes?.join(', ') || 'text, audio, image, location'}`,
        })
      } else {
        setWebhookActive(false)
        toast({
          title: 'Webhook Inactive',
          description: 'The webhook endpoint did not respond correctly.',
          variant: 'destructive',
        })
      }
    } catch {
      setWebhookActive(false)
      toast({
        title: 'Webhook Test Failed',
        description: 'Could not reach the webhook endpoint.',
        variant: 'destructive',
      })
    } finally {
      setTestingWebhook(false)
    }
  }

  const isOnline = connectionStatus?.online === true

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
        <span className="ml-2 text-muted-foreground text-sm">Loading configuration...</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Column: Configuration & Connection */}
      <div className="space-y-4">
        {/* Configuration Form */}
        <Card className="bg-content-card border-content-border rounded">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-gold" />
              Evolution API Configuration
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Enter your Evolution API credentials to enable WhatsApp integration.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">API Base URL</label>
              <Input
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://your-evolution-api.example.com"
                className="bg-background border-content-border text-foreground placeholder:text-muted-foreground rounded h-9 text-sm"
                disabled={saving}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Evolution API key"
                  className="bg-background border-content-border text-foreground placeholder:text-muted-foreground rounded h-9 text-sm pr-10"
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Instance Name</label>
              <Input
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="Khotla_Main"
                className="bg-background border-content-border text-foreground placeholder:text-muted-foreground rounded h-9 text-sm"
                disabled={saving}
              />
            </div>
            <Button
              onClick={handleSaveConfig}
              disabled={saving || !apiBaseUrl.trim() || !apiKey.trim() || !instanceName.trim()}
              className="w-full bg-gold hover:bg-gold-light text-navy font-semibold rounded"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving & Validating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Connection Section */}
        {configSaved && (
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
                      : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
                  }`}
                >
                  {isOnline ? 'ONLINE' : (connectionStatus?.state === 'not_configured' ? 'NOT CONFIGURED' : 'OFFLINE')}
                </Badge>
                {connectionStatus?.instance && (
                  <span className="text-[10px] text-muted-foreground">
                    Instance: {connectionStatus.instance}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {connectionStatus?.message && (
                <div className={`flex items-start gap-2 text-xs p-2 rounded ${
                  isOnline
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                }`}>
                  {isOnline ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  )}
                  {connectionStatus.message}
                </div>
              )}

              {/* QR Code Display */}
              {qrCode && !isOnline && (
                <div className="flex flex-col items-center gap-2 p-3 bg-white rounded border border-content-border">
                  <QrCode className="w-4 h-4 text-navy" />
                  <span className="text-[10px] text-navy font-medium">Scan with WhatsApp</span>
                  {qrCode.startsWith('data:image') || qrCode.startsWith('iVBOR') || qrCode.startsWith('/9j/') ? (
                    <img
                      src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded">
                      <QrCode className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  <p className="text-[9px] text-gray-500 text-center">
                    Open WhatsApp → Linked Devices → Link a Device → Scan this code
                  </p>
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
        )}

        {/* Webhook Status */}
        {configSaved && (
          <Card className="bg-content-card border-content-border rounded">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <Link2 className="w-4 h-4 text-gold" />
                Webhook Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Webhook URL</label>
                <div className="flex items-center gap-2 bg-background border border-content-border rounded px-3 py-2">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground truncate font-mono">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/api/whatsapp-webhook`
                      : '/api/whatsapp-webhook'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 ${
                      webhookActive
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
                    }`}
                  >
                    {webhookActive ? 'ACTIVE' : 'NOT TESTED'}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook}
                  className="border-content-border text-foreground hover:bg-gold/10 rounded h-7 text-xs"
                >
                  {testingWebhook ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Send className="w-3 h-3 mr-1" />
                  )}
                  Test
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column: Help & Flow */}
      <div className="space-y-4">
        {/* Setup Instructions */}
        <Card className="bg-content-card border-content-border rounded">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-gold" />
              Setup Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2.5">
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gold">1</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Enter your Evolution API credentials</p>
                  <p className="text-[10px] text-muted-foreground">Provide the base URL, API key, and instance name for your Evolution API server.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gold">2</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Click Connect and scan the QR code with WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground">Open WhatsApp on your phone, go to Linked Devices, and scan the QR code.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-gold">3</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Citizens can now text this WhatsApp number to report issues</p>
                  <p className="text-[10px] text-muted-foreground">All incoming messages are automatically processed by KHOTLA AI.</p>
                </div>
              </div>
            </div>

            <Separator className="bg-content-border" />

            <div>
              <h4 className="text-xs font-medium text-gold mb-2">Supported Message Types</h4>
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
            </div>
          </CardContent>
        </Card>

        {/* Flow Diagram */}
        <Card className="bg-content-card border-content-border rounded">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <QrCode className="w-4 h-4 text-gold" />
              Citizen Report Flow
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              How citizen reports travel through the KHOTLA AI system.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Flow Step 1: Citizen */}
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

              {/* Flow Step 2: WhatsApp */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">WhatsApp Gateway</p>
                  <p className="text-[9px] text-muted-foreground">Evolution API receives message</p>
                </div>
              </div>

              <div className="flex items-center justify-center pl-4">
                <ArrowRight className="w-4 h-4 text-gold rotate-90" />
              </div>

              {/* Flow Step 3: AI Analysis */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Monitor className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Sovereign AI Analysis</p>
                  <p className="text-[9px] text-muted-foreground">Categorizes, prioritizes & summarizes</p>
                </div>
              </div>

              <div className="flex items-center justify-center pl-4">
                <ArrowRight className="w-4 h-4 text-gold rotate-90" />
              </div>

              {/* Flow Step 4: Dashboard */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Settings className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">National Dashboard</p>
                  <p className="text-[9px] text-muted-foreground">Report appears for officials to triage</p>
                </div>
              </div>

              <div className="flex items-center justify-center pl-4">
                <ArrowRight className="w-4 h-4 text-gold rotate-90" />
              </div>

              {/* Flow Step 5: Official Resolves */}
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

              {/* Flow Step 6: Citizen Notified */}
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

        {/* Connection Info */}
        {connectionStatus && (
          <Card className="bg-content-card border-content-border rounded">
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background rounded p-3 border border-content-border">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">State</p>
                  <p className="text-xs font-medium text-foreground mt-0.5">{connectionStatus.state || 'Unknown'}</p>
                </div>
                <div className="bg-background rounded p-3 border border-content-border">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Instance</p>
                  <p className="text-xs font-medium text-foreground mt-0.5">{connectionStatus.instance || 'None'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
