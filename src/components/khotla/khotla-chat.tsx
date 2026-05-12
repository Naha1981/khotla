'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  category?: string
  priority?: string
  reportId?: string
}

export function KhotlaChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Khotso! Welcome to KHOTLA AI Citizen Report Portal. You can report infrastructure issues, water problems, road damage, corruption, or any civic concern in English or Sesotho. Your report will be automatically categorized and prioritized by our Sovereign AI.',
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [citizenName, setCitizenName] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleSend() {
    if (!input.trim() || sending) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setSending(true)

    setTimeout(scrollToBottom, 100)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          citizenName: citizenName || 'Web User',
        }),
      })

      const data = await res.json()

      if (data.success) {
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: `✅ Report received and analyzed!\n\n📋 **Category**: ${data.report.category}\n⚡ **Priority**: ${data.report.priority}\n📝 **Summary**: ${data.report.summary}\n🔧 **Suggested Action**: ${data.report.suggestedAction}\n\nYour report has been logged in the national dashboard and is now visible to government officials.`,
          timestamp: new Date(),
          category: data.report.category,
          priority: data.report.priority,
          reportId: data.report.id,
        }
        setMessages(prev => [...prev, aiMessage])
      } else {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: '❌ Sorry, there was an error processing your report. Please try again.',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to Sovereign AI. Please try again.',
        variant: 'destructive',
      })
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '❌ Connection error. The Sovereign AI service is temporarily unavailable.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setSending(false)
      setTimeout(scrollToBottom, 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
      {/* Chat Interface */}
      <Card className="lg:col-span-3 bg-content-card border-content-border rounded flex flex-col">
        <CardHeader className="pb-2 shrink-0">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            Citizen Report Portal — AI-Powered
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Report issues in English or Sesotho. AI auto-categorizes and prioritizes.
          </p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-3 pt-0 min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded bg-gold/20 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-gold" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded p-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-user-bubble text-user-bubble-fg'
                      : 'bg-ai-bubble text-ai-bubble-fg'
                  }`}
                >
                  {msg.content.split('\n').map((line, j) => (
                    <p key={j} className={j > 0 ? 'mt-1' : ''}>
                      {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </p>
                  ))}
                  {msg.category && (
                    <div className="flex gap-1.5 mt-2">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-gold/20 text-gold border-gold/30">
                        {msg.category}
                      </Badge>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                        msg.priority === 'HIGH' ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30' :
                        msg.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30' :
                        'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30'
                      }`}>
                        {msg.priority}
                      </Badge>
                    </div>
                  )}
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded bg-user-bubble flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-user-bubble-fg" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-content-border pt-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the issue... (English or Sesotho)"
                className="min-h-[60px] max-h-[120px] bg-background border-content-border text-foreground placeholder:text-muted-foreground resize-none rounded text-sm"
                disabled={sending}
              />
              <Button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="bg-gold hover:bg-gold-light text-navy font-semibold rounded px-4 shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Panel */}
      <Card className="lg:col-span-1 bg-content-card border-content-border rounded">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-sm">Report Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Your Name / Phone</label>
            <Input
              value={citizenName}
              onChange={(e) => setCitizenName(e.target.value)}
              placeholder="+266 5600 XXXX"
              className="bg-background border-content-border text-foreground placeholder:text-muted-foreground rounded h-8 text-sm"
            />
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gold">Supported Categories</h4>
            {['WATER 💧', 'ROADS 🛣️', 'CORRUPTION ⚖️', 'HEALTH 🏥', 'EDUCATION 📚', 'ELECTRICITY ⚡', 'SANITATION 🚰'].map(cat => (
              <div key={cat} className="text-xs text-muted-foreground py-0.5">{cat}</div>
            ))}
          </div>
          <div className="pt-2 border-t border-content-border">
            <h4 className="text-xs font-medium text-gold mb-1">How It Works</h4>
            <ol className="text-[10px] text-muted-foreground space-y-1 list-decimal pl-3">
              <li>Type your issue in English or Sesotho</li>
              <li>Sovereign AI categorizes and prioritizes</li>
              <li>Report appears on the Dashboard instantly</li>
              <li>Officials can triage and resolve</li>
              <li>You get notified via WhatsApp</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
