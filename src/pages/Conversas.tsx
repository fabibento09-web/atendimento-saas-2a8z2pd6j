import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Search,
  Paperclip,
  Smile,
  Send,
  ChevronLeft,
  Tag as TagIcon,
  MessageSquare,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'

export default function Conversas() {
  const { user } = useAuth()
  const [chats, setChats] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [isMobileViewChat, setIsMobileViewChat] = useState(false)
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    if (!user) return
    try {
      const fetchedChats = await pb
        .collection('conversations')
        .getFullList({ sort: '-updated', expand: 'tags' })
      const fetchedTags = await pb.collection('categories').getFullList({ sort: '-created' })
      setChats(fetchedChats)
      setTags(fetchedTags)

      if (!activeChatId && fetchedChats.length > 0) {
        setActiveChatId(fetchedChats[0].id)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])
  useRealtime('conversations', loadData)
  useRealtime('categories', loadData)

  const activeChat = chats.find((c) => c.id === activeChatId)
  const filteredChats = chats.filter((c) =>
    (c.contact_name || '').toLowerCase().includes(search.toLowerCase()),
  )

  const handleSend = () => {
    if (!message.trim() || !activeChatId) return
    pb.collection('conversations')
      .update(activeChatId, { last_message: message })
      .then(() => {
        setMessage('')
      })
  }

  const addTagToChat = async (chatId: string, tagId: string) => {
    await pb.collection('conversations').update(chatId, { 'tags+': tagId })
  }

  const removeTagFromChat = async (chatId: string, tagId: string) => {
    await pb.collection('conversations').update(chatId, { 'tags-': tagId })
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

  if (chats.length === 0 && search === '') {
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
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum contato encontrado com "{search}".
              </div>
            ) : null}
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id)
                  setIsMobileViewChat(true)
                }}
                className={cn(
                  'p-4 cursor-pointer transition-all flex gap-3 hover:bg-muted/50 relative',
                  activeChatId === chat.id
                    ? 'bg-primary/5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary'
                    : 'bg-transparent',
                )}
              >
                <Avatar className="w-12 h-12 border border-border shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-primary font-serif">
                    {chat.contact_name?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <span className="font-medium text-sm truncate pr-2 text-foreground">
                      {chat.contact_name || 'Desconhecido'}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                      {new Date(chat.updated).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs truncate mb-2 text-muted-foreground">
                    {chat.last_message || 'Nenhuma mensagem.'}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {chat.expand?.tags?.map((tag: any) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 h-4 border-none text-white shadow-sm"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
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
        {activeChat ? (
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
                    {activeChat.contact_name?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">
                    {activeChat.contact_name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {activeChat.contact_phone || 'S/ Telefone'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="hidden sm:flex border-muted bg-background hover:bg-muted text-primary"
                    >
                      <TagIcon className="w-4 h-4 mr-2" /> Tags
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 shadow-xl border-muted bg-card">
                    <DropdownMenuLabel className="font-serif text-primary">
                      Gerenciar Tags
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-muted" />
                    {tags.map((tag) => {
                      const hasTag = activeChat.tags?.includes(tag.id)
                      return (
                        <DropdownMenuItem
                          key={tag.id}
                          className="cursor-pointer py-2 focus:bg-muted"
                          onClick={() =>
                            hasTag
                              ? removeTagFromChat(activeChat.id, tag.id)
                              : addTagToChat(activeChat.id, tag.id)
                          }
                        >
                          <div
                            className="w-3 h-3 rounded-full mr-3 shadow-sm border border-black/10"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1 font-medium">{tag.name}</span>
                          {hasTag && <span className="text-xs text-primary font-bold">✓</span>}
                        </DropdownMenuItem>
                      )
                    })}
                    {tags.length === 0 && (
                      <div className="p-2 text-xs text-muted-foreground text-center">
                        Nenhuma tag criada.
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-noise bg-opacity-30 relative"
              ref={scrollRef}
            >
              <div className="flex justify-center my-4">
                <span className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-card shadow-sm border border-muted text-muted-foreground">
                  Início da Conversa
                </span>
              </div>

              {activeChat.last_message && (
                <div className="flex w-full justify-start">
                  <div className="max-w-[85%] md:max-w-[70%] p-3.5 shadow-sm relative group bg-card text-foreground rounded-2xl rounded-tl-sm border border-muted">
                    <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed font-sans">
                      {activeChat.last_message}
                    </p>
                    <span className="text-[10px] mt-1.5 block text-right font-medium text-muted-foreground">
                      {new Date(activeChat.updated).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              )}
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
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Simular envio de mensagem..."
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
