import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Clock, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import useAppStore from '@/stores/use-app-store'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function Home() {
  const { chats, tags } = useAppStore()

  const activeChats = chats.length
  const unanswered = chats.reduce((acc, chat) => acc + chat.unread, 0)
  const avgTime = '5m 23s'

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe o desempenho do seu atendimento em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversas Ativas
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-full">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-serif font-bold text-foreground">{activeChats}</div>
            <p className="text-xs text-green-600 flex items-center mt-2 font-medium">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +12% desde ontem
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Não Respondidas
            </CardTitle>
            <div className="p-2 bg-red-500/10 rounded-full">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-serif font-bold text-foreground">{unanswered}</div>
            <p className="text-xs text-red-500 flex items-center mt-2 font-medium">
              <ArrowUpRight className="w-3 h-3 mr-1" /> 4 aguardando
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo Médio (Resposta)
            </CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-full">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-serif font-bold text-foreground">{avgTime}</div>
            <p className="text-xs text-green-600 flex items-center mt-2 font-medium">
              <ArrowDownRight className="w-3 h-3 mr-1" /> -1m 12s melhoria
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-muted shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="font-serif">Conversas Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {chats.slice(0, 4).map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold font-serif shadow-sm">
                      {chat.contactName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground">{chat.contactName}</p>
                        {chat.unread > 0 && (
                          <span className="w-2 h-2 rounded-full bg-primary inline-block animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-[300px] mt-0.5">
                        {chat.lastMessage}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    asChild
                    className="hover:bg-primary hover:text-primary-foreground"
                  >
                    <Link to="/conversas">Visualizar</Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="font-serif">Categorias Populares</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {tags.map((tag) => {
              const count = chats.filter((c) => c.tags.includes(tag.id)).length
              const maxCount = chats.length || 1
              const percent = Math.round((count / maxCount) * 100)
              return (
                <div key={tag.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="font-medium text-sm">{tag.name}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${percent}%`, backgroundColor: tag.color }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
