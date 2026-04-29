import { useState, useRef, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Paperclip, Smile, Send, ChevronLeft, MessageSquare } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { sendWhatsAppMessage } from '@/services/whatsapp_messages'
import { toast } from 'sonner'

export default function Conversas() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [instances, setInstances] = useState<any[]>([])
  const [activeJid, setActiveJid] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [isMobileViewChat, setIsMobileViewChat] = useState(false)
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeInstance = useMemo(() => {
    return instances.find((i) => i.status === 'connected') || instances[0]
  }, [instances])

  const loadInstances = async () => {
    if (!user) return
    try {
      const fetchedInstances = await pb.collection('whatsapp_instances').getFullList()
      setInstances(fetchedInstances)
    } catch (err) {
      console.error(err)
    }
  }

  const loadMessages = async () => {
    if (!activeInstance) return
    try {
      const fetchedMessages = await pb.collection('whatsapp_messages').getFullList({
        filter: `instance_name = "${activeInstance.instance_name}"`,
        sort: 'timestamp',
      })
      setMessages(fetchedMessages)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadInstances()
  }, [user])

  useEffect(() => {
    if (activeInstance) {
      loadMessages()
    }
  }, [activeInstance])

  useRealtime('whatsapp_messages', (e) => {
    if (!activeInstance) return
    if (e.action === 'create') {
      const newMsg = e.record
      if (newMsg.instance_name === activeInstance.instance_name) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
      }
    } else {
      loadMessages()
    }
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, activeJid])

  const conversations = useMemo(() => {
    const map = new Map<string, any>()
    messages.forEach((m) => {
      const existing = map.get(m.remote_jid)
      if (!existing || m.timestamp >= existing.timestamp) {
        map.set(m.remote_jid, m)
      }
    })
    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp)
  }, [messages])

  useEffect(() => {
    if (!activeJid && conversations.length > 0) {
      setActiveJid(conversations[0].remote_jid)
    }
  }, [conversations, activeJid])

  const filteredConversations = conversations.filter((c) => {
    const name = c.push_name || c.remote_jid || ''
    return name.toLowerCase().includes(search.toLowerCase())
  })

  const activeChatMessages = useMemo(() => {
    if (!activeJid) return []
    return messages
      .filter((m) => m.remote_jid === activeJid)
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [messages, activeJid])

  const activeConversation = conversations.find((c) => c.remote_jid === activeJid)

  const handleSend = async () => {
    if (!inputText.trim() || !activeJid || !activeInstance) return

    const number = activeJid.replace('@s.whatsapp.net', '')

    try {
      await sendWhatsAppMessage(activeInstance.instance_name, number, inputText)
      setInputText('')
    } catch (err: any) {
      console.error(err)
      toast.error('Falha ao enviar mensagem', { description: err.message })
    }
  }

  const emptyState = (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 bg-background h-full text-center">
      <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6 shadow-sm border border-primary/10">
        <MessageSquare className="w-10 h-10 text-primary" />
      </div>
      <h3 className="font-serif text-2xl font-bold text-primary">Nenhuma conversa</h3>
      <p className="text-sm mt-3 max-w-sm leading-relaxed">
        Sua caixa de entrada está vazia. Quando a sincronização do WhatsApp for configurada, suas
        mensagens aparecerão aqui.
      </p>
    </div>
  )

  if (conversations.length === 0 && search === '') {
    return (
      <div className="flex h-[calc(100vh-6.5rem)] overflow-hidden rounded-xl border border-muted bg-card shadow-sm animate-fade-in justify-center items-center">
        {emptyState}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] overflow-hidden rounded-xl border border-muted bg-card shadow-sm animate-fade-in">
      <div
        className={cn(
          'w-full md:w-80 lg:w-[380px] border-r border-muted flex flex-col bg-sidebar shrink-0',
          isMobileViewChat ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="p-4 border-b border-muted bg-card z-10 shadow-sm">
          <h2 className="font-serif text-xl font-bold mb-4 text-primary">Conversas</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contatos..."
              className="pl-9 bg-background border-muted focus-visible:ring-primary shadow-sm"
            />
          </div>
        </div>
        <ScrollArea className="flex-1 bg-card">
          <div className="divide-y divide-muted">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum contato encontrado com "{search}".
              </div>
            ) : null}
            {filteredConversations.map((chat) => (
              <div
                key={chat.remote_jid}
                onClick={() => {
                  setActiveJid(chat.remote_jid)
                  setIsMobileViewChat(true)
                }}
                className={cn(
                  'p-4 cursor-pointer transition-all flex gap-3 hover:bg-muted/50 relative',
                  activeJid === chat.remote_jid
                    ? 'bg-primary/5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary'
                    : 'bg-transparent',
                )}
              >
                <Avatar className="w-12 h-12 border border-border shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-primary font-serif">
                    {(chat.push_name || chat.remote_jid)?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <span className="font-medium text-sm truncate pr-2 text-foreground">
                      {chat.push_name || chat.remote_jid}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                      {new Date(chat.timestamp * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs truncate text-muted-foreground">
                    {chat.content || 'Nenhuma mensagem.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div
        className={cn(
          'flex-1 flex flex-col bg-background',
          !isMobileViewChat ? 'hidden md:flex' : 'flex',
        )}
      >
        {activeConversation ? (
          <>
            <div className="h-16 border-b border-muted bg-card flex items-center px-4 justify-between shrink-0 z-10 shadow-sm">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden -ml-2 text-muted-foreground"
                  onClick={() => setIsMobileViewChat(false)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-10 h-10 border border-border shadow-sm">
                  <AvatarFallback className="font-serif bg-primary/10 text-primary">
                    {(activeConversation.push_name || activeConversation.remote_jid)
                      ?.charAt(0)
                      .toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">
                    {activeConversation.push_name || activeConversation.remote_jid}
                  </h3>
                  <p className="text-xs text-muted-foreground">{activeConversation.remote_jid}</p>
                </div>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-noise bg-opacity-30 relative"
              ref={scrollRef}
            >
              <div className="flex justify-center my-4">
                <span className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-card shadow-sm border border-muted text-muted-foreground">
                  Início da Conversa
                </span>
              </div>

              {activeChatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex w-full', msg.from_me ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] md:max-w-[70%] p-3.5 shadow-sm relative group rounded-2xl border',
                      msg.from_me
                        ? 'bg-primary text-primary-foreground rounded-tr-sm border-primary/20'
                        : 'bg-card text-foreground rounded-tl-sm border-muted',
                    )}
                  >
                    <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed font-sans">
                      {msg.content}
                    </p>
                    <span
                      className={cn(
                        'text-[10px] mt-1.5 block text-right font-medium',
                        msg.from_me ? 'text-primary-foreground/70' : 'text-muted-foreground',
                      )}
                    >
                      {new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 md:p-4 bg-card border-t border-muted shrink-0 flex items-end gap-2 shadow-sm z-10">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-primary hidden sm:flex"
              >
                <Smile className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-primary hidden sm:flex"
              >
                <Paperclip className="w-5 h-5" />
              </Button>
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-background border-muted focus-visible:ring-primary shadow-sm h-11"
              />
              <Button
                onClick={handleSend}
                className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm h-11 px-4"
              >
                <span className="hidden sm:inline mr-2 font-medium">Enviar</span>
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-noise bg-opacity-20 p-6 h-full">
            <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mb-6 shadow-md border border-muted">
              <MessageSquare className="w-12 h-12 text-primary/40" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-primary">Selecione uma Conversa</h3>
            <p className="text-sm mt-3 max-w-sm text-center leading-relaxed">
              Clique em um contato na lateral para visualizar o histórico de mensagens e responder.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
