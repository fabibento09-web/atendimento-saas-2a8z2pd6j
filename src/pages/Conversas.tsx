import { useState, useRef, useEffect } from 'react'
import useAppStore from '@/stores/use-app-store'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Search,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  ChevronLeft,
  Tag as TagIcon,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function Conversas() {
  const { chats, tags, addTagToChat, removeTagFromChat, sendMessage } = useAppStore()
  const [activeChatId, setActiveChatId] = useState<string | null>(chats[0]?.id || null)
  const [message, setMessage] = useState('')
  const [isMobileViewChat, setIsMobileViewChat] = useState(false)
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeChat = chats.find((c) => c.id === activeChatId)
  const filteredChats = chats.filter((c) =>
    c.contactName.toLowerCase().includes(search.toLowerCase()),
  )

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeChat?.messages])

  const handleSend = () => {
    if (!message.trim() || !activeChatId) return
    sendMessage(activeChatId, message)
    setMessage('')
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] overflow-hidden rounded-xl border border-muted bg-card shadow-sm animate-fade-in">
      {/* Left List */}
      <div
        className={cn(
          'w-full md:w-80 lg:w-[380px] border-r border-muted flex flex-col bg-sidebar shrink-0',
          isMobileViewChat ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="p-4 border-b border-muted bg-card z-10 shadow-sm">
          <h2 className="font-serif text-xl font-bold mb-4">Conversas</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversas..."
              className="pl-9 bg-muted/40 border-none focus-visible:ring-1"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y divide-muted">
            {filteredChats.length === 0 ? (
              <p className="text-center p-8 text-sm text-muted-foreground">
                Nenhuma conversa encontrada.
              </p>
            ) : null}
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id)
                  setIsMobileViewChat(true)
                }}
                className={cn(
                  'p-4 cursor-pointer transition-all flex gap-3 hover:bg-muted/60 relative',
                  activeChatId === chat.id
                    ? 'bg-muted/80 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary'
                    : 'bg-transparent',
                )}
              >
                <Avatar className="w-12 h-12 border border-border shadow-sm">
                  {chat.avatar ? <AvatarImage src={chat.avatar} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary font-serif">
                    {chat.contactName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <span className="font-medium text-sm truncate pr-2 text-foreground">
                      {chat.contactName}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                      {chat.timestamp}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'text-xs truncate mb-2',
                      chat.unread > 0 ? 'font-medium text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {chat.lastMessage}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {chat.tags.map((tId) => {
                      const tag = tags.find((t) => t.id === tId)
                      return tag ? (
                        <Badge
                          key={tId}
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-4 border-none text-white shadow-sm"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ) : null
                    })}
                  </div>
                </div>
                {chat.unread > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold self-center shrink-0 shadow-sm animate-pulse">
                    {chat.unread}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Active Chat */}
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
                  {activeChat.avatar ? <AvatarImage src={activeChat.avatar} /> : null}
                  <AvatarFallback className="font-serif">
                    {activeChat.contactName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">
                    {activeChat.contactName}
                  </h3>
                  <p className="text-xs text-green-600 font-medium">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="hidden sm:flex border-muted bg-background hover:bg-muted"
                    >
                      <TagIcon className="w-4 h-4 mr-2" /> Tags
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 shadow-xl">
                    <DropdownMenuLabel className="font-serif">Gerenciar Tags</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {tags.map((tag) => {
                      const hasTag = activeChat.tags.includes(tag.id)
                      return (
                        <DropdownMenuItem
                          key={tag.id}
                          className="cursor-pointer py-2"
                          onClick={() =>
                            hasTag
                              ? removeTagFromChat(activeChat.id, tag.id)
                              : addTagToChat(activeChat.id, tag.id)
                          }
                        >
                          <div
                            className="w-3 h-3 rounded-full mr-3 shadow-sm"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1 font-medium">{tag.name}</span>
                          {hasTag && <span className="text-xs text-primary font-bold">✓</span>}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-noise bg-opacity-30 relative"
              ref={scrollRef}
            >
              {/* Optional Date separator */}
              <div className="flex justify-center my-4">
                <span className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-muted text-muted-foreground">
                  Hoje
                </span>
              </div>

              {activeChat.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex w-full',
                    msg.sender === 'me' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] md:max-w-[70%] p-3.5 shadow-sm relative group',
                      msg.sender === 'me'
                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                        : 'bg-card text-foreground rounded-2xl rounded-tl-sm border border-border',
                    )}
                  >
                    <p className="text-[15px] whitespace-pre-wrap break-words leading-relaxed font-sans">
                      {msg.text}
                    </p>
                    <span
                      className={cn(
                        'text-[10px] mt-1.5 block text-right font-medium',
                        msg.sender === 'me'
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground',
                      )}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 md:p-4 bg-card border-t border-muted shrink-0 flex items-end gap-2 shadow-sm z-10">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-foreground hidden sm:flex"
              >
                <Smile className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-foreground hidden sm:flex"
              >
                <Paperclip className="w-5 h-5" />
              </Button>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-muted/40 border-border focus-visible:ring-1 shadow-inner h-11"
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
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-noise bg-opacity-20 p-6">
            <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mb-6 shadow-md border border-border">
              <MessageSquare className="w-12 h-12 text-primary/40" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-foreground">Suas Mensagens</h3>
            <p className="text-sm mt-3 max-w-sm text-center leading-relaxed">
              Selecione uma conversa ao lado para visualizar o histórico e interagir com seu cliente
              de forma rápida.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
