'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  MessageSquare,
  Eye,
  Wifi,
  Phone,
  ExternalLink,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Report {
  id: string
  createdAt: string
  category: string
  description: string
  priority: string
  status: string
  citizenName: string
  source: string
  aiSummary: string | null
  imageUrl: string | null
  whatsappJid: string | null
  phoneNumber: string | null
  messageType: string | null
  resolutionNotified: boolean
}

export function KhotlaDashboard() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, pending: 0, high: 0, resolved: 0, whatsapp: 0 })
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null)
  const { toast } = useToast()

  // Fetch WhatsApp phone number for citizen banner
  useEffect(() => {
    async function fetchPhone() {
      try {
        const res = await fetch('/api/whatsapp-status')
        if (res.ok) {
          const data = await res.json()
          if (data.phoneNumber) {
            setWhatsappPhone(data.phoneNumber)
          }
        }
      } catch {
        // Silent fail
      }
    }
    fetchPhone()
  }, [])

  const wameLink = whatsappPhone
    ? `https://wa.me/${whatsappPhone.replace(/[^0-9]/g, '')}?text=Hello%20KHOTLA%20AI`
    : 'https://wa.me/?text=Hello%20KHOTLA%20AI'

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('/api/reports')
      const data = await res.json()
      setReports(data.reports || [])
      const r = data.reports || []
      setStats({
        total: r.length,
        pending: r.filter((x: Report) => x.status === 'Pending').length,
        high: r.filter((x: Report) => x.priority === 'HIGH').length,
        resolved: r.filter((x: Report) => x.status === 'Resolved').length,
        whatsapp: r.filter((x: Report) => x.source === 'whatsapp').length,
      })
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch reports', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchReports()
    const interval = setInterval(fetchReports, 60000)
    return () => clearInterval(interval)
  }, [fetchReports])

  async function updateStatus(id: string, status: string) {
    try {
      await fetch(`/api/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      toast({
        title: 'Status Updated',
        description: `Report marked as ${status}`,
      })
      fetchReports()
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
    }
  }

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      HIGH: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
      MEDIUM: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
      LOW: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
    }
    return styles[priority] || styles.MEDIUM
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Pending: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30',
      'In Progress': 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
      Resolved: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    }
    return styles[status] || styles.Pending
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      WATER: '💧',
      ROADS: '🛣️',
      CORRUPTION: '⚖️',
      HEALTH: '🏥',
      EDUCATION: '📚',
      ELECTRICITY: '⚡',
      SANITATION: '🚰',
      OTHER: '📋',
    }
    return icons[category] || '📋'
  }

  const statCards = [
    { label: 'Total Reports', value: stats.total, icon: MessageSquare, color: 'text-gold' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-orange-500 dark:text-orange-400' },
    { label: 'High Priority', value: stats.high, icon: AlertTriangle, color: 'text-red-500 dark:text-red-400' },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'text-emerald-500 dark:text-emerald-400' },
    { label: 'Via WhatsApp', value: stats.whatsapp, icon: Wifi, color: 'text-blue-500 dark:text-blue-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Citizen WhatsApp Banner */}
      <a
        href={wameLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 bg-gold hover:bg-gold-light transition-colors rounded-lg px-4 py-3 group"
      >
        <div className="flex items-center justify-center w-10 h-10 bg-navy rounded-lg shrink-0">
          <Phone className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-navy">
            📱 Report via WhatsApp — Send a message to KHOTLA AI on WhatsApp
          </p>
          <p className="text-xs text-navy/70">
            Roma pego ka WhatsApp · Text, voice, photo, or location
          </p>
        </div>
        <ExternalLink className="w-4 h-4 text-navy/50 group-hover:text-navy shrink-0" />
      </a>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-content-card border-content-border rounded">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                </div>
                <s.icon className={`w-8 h-8 ${s.color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reports Table */}
      <Card className="bg-content-card border-content-border rounded">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gold" />
              Citizen Reports — Real-Time Feed
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchReports}
              className="border-content-border text-foreground hover:bg-content-card-hover rounded h-8"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-content-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground text-xs">Category</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Priority</TableHead>
                  <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Description</TableHead>
                  <TableHead className="text-muted-foreground text-xs hidden lg:table-cell">Source</TableHead>
                  <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">Citizen</TableHead>
                  <TableHead className="text-muted-foreground text-xs hidden xl:table-cell">AI Summary</TableHead>
                  <TableHead className="text-muted-foreground text-xs text-right">Triage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading reports...
                    </TableCell>
                  </TableRow>
                ) : reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No reports yet. Messages from citizens will appear here in real-time.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => (
                    <TableRow key={report.id} className="border-table-row-border hover:bg-table-row-hover">
                      <TableCell className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <span>{getCategoryIcon(report.category || '')}</span>
                          <span className="font-medium text-foreground">{report.category}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getPriorityBadge(report.priority || '')}`}>
                          {report.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getStatusBadge(report.status)}`}>
                          {report.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                        {report.description}
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 w-fit ${report.source === 'whatsapp' ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30' : report.source === 'vision' ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'}`}>
                            {report.source === 'whatsapp' ? 'WhatsApp' : report.source === 'vision' ? 'Vision AI' : 'Web'}
                          </Badge>
                          {report.source === 'whatsapp' && report.messageType && report.messageType !== 'text' && (
                            <span className="text-[9px] text-muted-foreground">
                              {report.messageType === 'audio' ? '🎤 Voice' : report.messageType === 'image' ? '📷 Image' : report.messageType === 'location' ? '📍 Location' : report.messageType}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{report.citizenName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate hidden xl:table-cell">{report.aiSummary}</TableCell>
                      <TableCell className="text-xs text-right">
                        {report.status === 'Pending' && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded"
                              onClick={() => updateStatus(report.id, 'In Progress')}
                            >
                              <Eye className="w-3 h-3 mr-0.5" />
                              Triage
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded"
                              onClick={() => updateStatus(report.id, 'Resolved')}
                            >
                              <CheckCircle className="w-3 h-3 mr-0.5" />
                              Resolve
                            </Button>
                          </div>
                        )}
                        {report.status === 'In Progress' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded"
                            onClick={() => updateStatus(report.id, 'Resolved')}
                          >
                            <CheckCircle className="w-3 h-3 mr-0.5" />
                            Resolve
                          </Button>
                        )}
                        {report.status === 'Resolved' && (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">✓ Closed</span>
                            {report.source === 'whatsapp' && report.resolutionNotified && (
                              <span className="text-[9px] text-green-500 dark:text-green-400">📱 Citizen notified</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
