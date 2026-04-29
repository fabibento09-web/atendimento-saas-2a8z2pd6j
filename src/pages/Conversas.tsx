import { useState, useRef, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Search,
  Paperclip,
  Smile,
  Send,
  ChevronLeft,
  MessageSquare,
  Smartphone,
  Loader2,
  LogOut,
  AlertCircle,
  Users,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { sendWhatsAppMessage } from '@/services/whatsapp_messages'
import {
  createWhatsAppInstanceApi,
  checkWhatsAppInstanceStatus,
  disconnectWhatsAppInstanceApi,
} from '@/services/whatsapp_instances'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export default function Conversas() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [conversationsMeta, setConversationsMeta] = useState<any[]>([])
  const [instances, setInstances] = useState<any[]>([])
  const [activeJid, setActiveJid] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [isMobileViewChat, setIsMobileViewChat] = useState(false)
  const [search, setSearch] = useState('')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoConnectAttempted = useRef(false)

  const activeInstance = useMemo(() => {
    return (
      instances.find((i) => i.status === 'connected') ||
      instances.find((i) => i.status === 'qrcode') ||
      instances.find((i) => i.status === 'creating') ||
      instances[0]
    )
  }, [instances])

  const connectionStatus = isCreating ? 'creating' : activeInstance?.status || 'disconnected'

  const loadInstances = async () => {
    if (!user) return []
    try {
      const fetchedInstances = await pb.collection('whatsapp_instances').getFullList()
      setInstances(fetchedInstances)
      return fetchedInstances
    } catch (err) {
      console.error(err)
      return []
    }
  }

  const loadMessages = async () => {
    if (!activeInstance || activeInstance.status !== 'connected') return
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

  const loadConversationsMeta = async () => {
    if (!activeInstance || activeInstance.status !== 'connected') return
    try {
      const fetchedMeta = await pb.collection('conversations').getFullList({
        filter: `instance_name = "${activeInstance.instance_name}"`,
      })
      setConversationsMeta(fetchedMeta)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (!user) return
    loadInstances().then((insts) => {
      if (!autoConnectAttempted.current) {
        autoConnectAttempted.current = true
        const connected = insts.find(
          (i) => i.status === 'connected' || i.status === 'qrcode' || i.status === 'creating',
        )
        if (!connected) {
          const disconnected = insts.find((i) => i.status === 'disconnected')
          handleConnect(disconnected?.instance_name)
        }
      }
    })
  }, [user])

  useEffect(() => {
    if (activeInstance && activeInstance.status === 'connected') {
      loadMessages()
      loadConversationsMeta()
    }
  }, [activeInstance?.instance_name, activeInstance?.status])

  useRealtime('whatsapp_instances', (e) => {
    if (e.record.user_id === user?.id) {
      loadInstances()
    }
  })

  useRealtime('whatsapp_messages', (e) => {
    if (!activeInstance || activeInstance.status !== 'connected') return
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

  useRealtime('conversations', (e) => {
    if (!activeInstance || activeInstance.status !== 'connected') return
    if (e.record.instance_name === activeInstance.instance_name) {
      if (e.action === 'create' || e.action === 'update') {
        setConversationsMeta((prev) => {
          const exists = prev.find((m) => m.id === e.record.id)
          if (exists) return prev.map((m) => (m.id === e.record.id ? e.record : m))
          return [...prev, e.record]
        })
      } else if (e.action === 'delete') {
        setConversationsMeta((prev) => prev.filter((m) => m.id !== e.record.id))
      }
    }
  })

  useEffect(() => {
    let interval: any
    if (
      activeInstance &&
      (activeInstance.status === 'qrcode' || activeInstance.status === 'creating')
    ) {
      const checkStatus = async () => {
        try {
          const res = await checkWhatsAppInstanceStatus(activeInstance.instance_name)
          if (res.status === 'qrcode' && res.qrcodeBase64) {
            setQrCode(res.qrcodeBase64)
          } else if (res.status === 'connected') {
            setQrCode(null)
          }
        } catch (err) {
          console.error(err)
        }
      }

      checkStatus()
      interval = setInterval(checkStatus, 5000)
    } else if (activeInstance?.status === 'connected') {
      setQrCode(null)
    }
    return () => clearInterval(interval)
  }, [activeInstance?.status, activeInstance?.instance_name])

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

    return Array.from(map.values())
      .map((c) => {
        const meta = conversationsMeta.find((meta) => meta.remote_jid === c.remote_jid)
        const isGroup = meta
          ? meta.type === 'group' || meta.is_group
          : c.remote_jid.includes('@g.us')

        let avatarUrl = null
        if (meta && meta.avatar) {
          avatarUrl = pb.files.getUrl(meta, meta.avatar)
        } else if (meta?.avatar_url && meta.avatar_url !== 'none') {
          avatarUrl = meta.avatar_url
        }

        return {
          ...c,
          is_group: isGroup,
          type: meta?.type || (isGroup ? 'group' : 'individual'),
          avatar_url: avatarUrl,
          contact_name: meta?.contact_name || c.push_name || c.remote_jid,
          unread_count: meta?.unread_count || 0,
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [messages, conversationsMeta])

  useEffect(() => {
    if (!activeJid && conversations.length > 0) {
      setActiveJid(conversations[0].remote_jid)
    }
  }, [conversations, activeJid])

  const filteredConversations = conversations.filter((c) => {
    const name = c.contact_name || c.remote_jid || ''
    return name.toLowerCase().includes(search.toLowerCase())
  })

  const activeChatMessages = useMemo(() => {
    if (!activeJid) return []
    return messages
      .filter((m) => m.remote_jid === activeJid)
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [messages, activeJid])

  const activeConversation = conversations.find((c) => c.remote_jid === activeJid)

  useEffect(() => {
    if (activeJid) {
      const meta = conversationsMeta.find((m) => m.remote_jid === activeJid)
      if (meta && meta.unread_count > 0) {
        pb.collection('conversations').update(meta.id, { unread_count: 0 }).catch(console.error)
      }
    }
  }, [activeJid, conversationsMeta])

  const handleSend = async () => {
    if (!inputText.trim() || !activeJid || !activeInstance || activeInstance.status !== 'connected')
      return

    const number = activeJid.replace('@s.whatsapp.net', '')

    try {
      await sendWhatsAppMessage(activeInstance.instance_name, number, inputText)
      setInputText('')
    } catch (err: any) {
      console.error(err)
      toast.error('Falha ao enviar mensagem', { description: getErrorMessage(err) })
    }
  }

  const handleConnect = async (existingName?: string) => {
    setCreateError(null)
    setIsCreating(true)
    try {
      let instanceName =
        typeof existingName === 'string' ? existingName : activeInstance?.instance_name
      if (!instanceName || activeInstance?.status === 'disconnected') {
        instanceName = `wapp_${user?.id}_${Date.now()}`
      }
      await createWhatsAppInstanceApi(instanceName)
      await loadInstances()
    } catch (err: any) {
      console.error(err)
      setCreateError(
        getErrorMessage(err) ||
          'Erro ao comunicar com a Evolution API. Por favor, tente novamente.',
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleDisconnect = async () => {
    if (!activeInstance) return
    if (!window.confirm('Tem certeza que deseja desconectar este número de WhatsApp?')) return
    try {
      setCreateError(null)
      await disconnectWhatsAppInstanceApi(activeInstance.instance_name)
      setQrCode(null)
      await loadInstances()
      toast.success('WhatsApp desconectado com sucesso.')
    } catch (err: any) {
      toast.error('Erro ao desconectar WhatsApp', { description: getErrorMessage(err) })
    }
  }

  if (connectionStatus !== 'connected') {
    return (
      <div className="flex h-[calc(100vh-6.5rem)] items-center justify-center rounded-xl border border-muted bg-card shadow-sm animate-fade-in p-4">
        <div className="max-w-md w-full bg-background border border-muted rounded-xl p-8 flex flex-col items-center text-center shadow-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>

          {createError ? (
            <div className="w-full">
              <Alert variant="destructive" className="mb-6 text-left">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro na Conexão</AlertTitle>
                <AlertDescription className="mt-2 text-sm leading-relaxed">
                  {createError}
                </AlertDescription>
              </Alert>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleConnect()}
                  className="flex-1 h-12 text-base font-medium"
                >
                  Tentar Novamente
                </Button>
                {activeInstance && (
                  <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    className="flex-1 h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    Desconectar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {connectionStatus === 'disconnected' && (
                <>
                  <h2 className="font-serif text-2xl font-bold text-foreground mb-3">
                    Conecte seu WhatsApp
                  </h2>
                  <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                    Para começar a gerenciar seus atendimentos, você precisa conectar seu número de
                    WhatsApp lendo o QR Code.
                  </p>
                  <Button
                    onClick={() => handleConnect()}
                    className="w-full h-12 text-base font-medium"
                  >
                    Gerar QR Code
                  </Button>
                </>
              )}

              {connectionStatus === 'creating' && (
                <>
                  <h2 className="font-serif text-xl font-bold text-foreground mb-3">
                    Preparando conexão...
                  </h2>
                  <p className="text-sm text-muted-foreground mb-8">
                    Estamos gerando sua instância segura no servidor. Isso leva apenas alguns
                    segundos.
                  </p>
                  <div className="animate-spin text-primary">
                    <Loader2 className="w-8 h-8" />
                  </div>
                </>
              )}

              {connectionStatus === 'qrcode' && (
                <>
                  <h2 className="font-serif text-xl font-bold text-foreground mb-3">
                    Escaneie o QR Code
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Abra o WhatsApp no seu celular, vá em <strong>Aparelhos Conectados</strong> e
                    aponte a câmera para o código abaixo.
                  </p>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-muted/50 mb-6 flex items-center justify-center min-h-[250px] min-w-[250px]">
                    {qrCode ? (
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-xs font-medium">Carregando código...</span>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" onClick={handleDisconnect} className="w-full">
                    Desconectar
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  const emptyState = (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 bg-background h-full text-center">
      <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6 shadow-sm border border-primary/10">
        <MessageSquare className="w-10 h-10 text-primary" />
      </div>
      <h3 className="font-serif text-2xl font-bold text-primary">Nenhuma conversa</h3>
      <p className="text-sm mt-3 max-w-sm leading-relaxed">
        Sua caixa de entrada está vazia. Quando você receber novas mensagens, elas aparecerão aqui.
      </p>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-6.5rem)] overflow-hidden rounded-xl border border-muted bg-card shadow-sm animate-fade-in">
      <div
        className={cn(
          'w-full md:w-80 lg:w-[380px] border-r border-muted flex flex-col bg-sidebar shrink-0',
          isMobileViewChat ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="p-4 border-b border-muted bg-card z-10 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-bold text-primary">Conversas</h2>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              <span className="text-xs font-medium text-muted-foreground mr-1">Conectado</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={handleDisconnect}
                title="Desconectar WhatsApp"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
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
            {conversations.length === 0 && search === '' ? emptyState : null}
            {filteredConversations.length === 0 && search !== '' ? (
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
                  {chat.avatar_url && <AvatarImage src={chat.avatar_url} alt={chat.contact_name} />}
                  <AvatarFallback className="bg-primary/10 text-primary font-serif">
                    {chat.is_group ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      chat.contact_name?.charAt(0).toUpperCase() || '?'
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <div className="flex items-center gap-1.5 truncate pr-2">
                      <span
                        className={cn(
                          'text-sm truncate text-foreground',
                          chat.unread_count > 0 && activeJid !== chat.remote_jid
                            ? 'font-bold'
                            : 'font-medium',
                        )}
                      >
                        {chat.contact_name}
                      </span>
                      {chat.is_group && (
                        <span className="shrink-0 bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Grupo
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] shrink-0 mt-0.5',
                        chat.unread_count > 0 && activeJid !== chat.remote_jid
                          ? 'text-primary font-bold'
                          : 'text-muted-foreground',
                      )}
                    >
                      {new Date(chat.timestamp * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 mt-0.5">
                    <p
                      className={cn(
                        'text-xs truncate flex-1',
                        chat.unread_count > 0 && activeJid !== chat.remote_jid
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground',
                      )}
                    >
                      {chat.content || 'Nenhuma mensagem.'}
                    </p>
                    {chat.unread_count > 0 && activeJid !== chat.remote_jid && (
                      <div className="shrink-0 bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center shadow-sm">
                        {chat.unread_count > 99 ? '99+' : chat.unread_count}
                      </div>
                    )}
                  </div>
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
                  {activeConversation.avatar_url && (
                    <AvatarImage src={activeConversation.avatar_url} />
                  )}
                  <AvatarFallback className="font-serif bg-primary/10 text-primary">
                    {activeConversation.is_group ? (
                      <Users className="w-4 h-4" />
                    ) : (
                      activeConversation.contact_name?.charAt(0).toUpperCase() || '?'
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-foreground">
                      {activeConversation.contact_name}
                    </h3>
                    {activeConversation.is_group && (
                      <span className="bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Grupo
                      </span>
                    )}
                  </div>
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
                        ? 'bg-[#2d4635] text-white rounded-tr-sm border-[#2d4635]'
                        : 'bg-card text-foreground rounded-tl-sm border-muted',
                    )}
                  >
                    <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed font-sans">
                      {msg.content}
                    </p>
                    <span
                      className={cn(
                        'text-[10px] mt-1.5 block text-right font-medium',
                        msg.from_me ? 'text-white/70' : 'text-muted-foreground',
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
