'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, Camera, Loader2, Terminal, AlertTriangle, CheckCircle, Eye } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface VisionLogEntry {
  id: string
  timestamp: Date
  objectDetected: string
  severity: string
  confidence: number
  category: string
  description: string
  recommendedAction: string
  estimatedUrgency: string
  reportId?: string
}

export function KhotlaVision() {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [logs, setLogs] = useState<VisionLogEntry[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  async function analyzeImage(file: File) {
    setUploading(true)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result as string)
        fr.readAsDataURL(file)
      })

      const res = await fetch('/api/analyze-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      })

      const data = await res.json()

      if (data.success) {
        const entry: VisionLogEntry = {
          id: Date.now().toString(),
          timestamp: new Date(),
          objectDetected: data.report.objectDetected,
          severity: data.report.severity,
          confidence: data.report.confidence,
          category: data.report.category,
          description: data.report.description,
          recommendedAction: data.report.recommendedAction,
          estimatedUrgency: data.report.estimatedUrgency,
          reportId: data.report.id,
        }
        setLogs(prev => [entry, ...prev])

        toast({
          title: 'Vision Analysis Complete',
          description: `Detected: ${entry.objectDetected} (${entry.severity})`,
        })
      } else {
        toast({
          title: 'Analysis Failed',
          description: 'Could not analyze the image',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to Vision AI',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) analyzeImage(file)
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      analyzeImage(file)
    }
  }

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      CRITICAL: 'text-red-600 dark:text-red-400',
      HIGH: 'text-orange-600 dark:text-orange-400',
      MEDIUM: 'text-yellow-600 dark:text-yellow-400',
      LOW: 'text-green-600 dark:text-green-400',
    }
    return colors[severity] || 'text-muted-foreground'
  }

  const getUrgencyIcon = (urgency: string) => {
    if (urgency === 'IMMEDIATE') return <AlertTriangle className="w-3 h-3 text-red-500 dark:text-red-400" />
    if (urgency === '24HOURS') return <AlertTriangle className="w-3 h-3 text-orange-500 dark:text-orange-400" />
    return <CheckCircle className="w-3 h-3 text-green-500 dark:text-green-400" />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Upload Zone */}
      <Card className="bg-content-card border-content-border rounded">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Camera className="w-4 h-4 text-gold" />
            Live Edge Monitor — Upload
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Upload infrastructure images for AI-powered damage detection
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-gold bg-gold/10'
                : 'border-content-border hover:border-gold/50 hover:bg-content-card-hover'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-gold animate-spin" />
                <p className="text-sm text-muted-foreground">Analyzing with Sovereign Vision AI...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop an image here or click to upload
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Supports: PNG, JPEG, WebP, GIF
                </p>
              </div>
            )}
          </div>

          {/* Image Preview */}
          {preview && (
            <div className="rounded overflow-hidden border border-content-border">
              <img
                src={preview}
                alt="Uploaded"
                className="w-full h-48 object-cover"
              />
            </div>
          )}

          <div className="bg-secondary rounded p-3 border border-content-border">
            <h4 className="text-xs font-medium text-gold mb-2">Detection Capabilities</h4>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                'Pothole Detection',
                'Water Leak ID',
                'Structural Damage',
                'Electrical Hazard',
                'Flood Assessment',
                'Erosion Detection',
              ].map(cap => (
                <div key={cap} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Eye className="w-3 h-3 text-gold/60" />
                  {cap}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terminal Log */}
      <Card className="bg-content-card border-content-border rounded">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gold" />
            Vision Analysis Log
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {logs.length} analyses performed
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Terminal className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p>No vision analyses yet.</p>
                <p className="text-[10px] mt-1">Upload an image to begin detection.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="border-b border-table-row-border p-3 hover:bg-table-row-hover">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-muted-foreground">
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>
                    <div className="flex items-center gap-1.5">
                      {getUrgencyIcon(log.estimatedUrgency)}
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${
                          log.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30' :
                          log.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30' :
                          log.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30' :
                          'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30'
                        }`}
                      >
                        {log.severity}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-0.5 text-[11px]">
                    <div>
                      <span className="text-gold">OBJECT:</span>{' '}
                      <span className="text-foreground">{log.objectDetected}</span>
                    </div>
                    <div>
                      <span className="text-gold">CATEGORY:</span>{' '}
                      <span className={getSeverityColor(log.severity)}>{log.category}</span>
                    </div>
                    <div>
                      <span className="text-gold">CONFIDENCE:</span>{' '}
                      <span className="text-foreground">{(log.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-gold">DESC:</span>{' '}
                      <span className="text-muted-foreground">{log.description}</span>
                    </div>
                    <div>
                      <span className="text-gold">ACTION:</span>{' '}
                      <span className="text-cyan-600 dark:text-cyan-400">{log.recommendedAction}</span>
                    </div>
                    <div>
                      <span className="text-gold">URGENCY:</span>{' '}
                      <span className={log.estimatedUrgency === 'IMMEDIATE' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}>
                        {log.estimatedUrgency}
                      </span>
                    </div>
                  </div>
                  {log.reportId && (
                    <div className="mt-1 text-[9px] text-muted-foreground">
                      Report ID: {log.reportId}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
