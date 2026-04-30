import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { RecordModel } from 'pocketbase'

export default function Home() {
  const { user } = useAuth()
  const [activeChats, setActiveChats] = useState(0)
  const [unanswered, setUnanswered] = useState(0)
  const [recentChats, setRecentChats] = useState<RecordModel[]>([])
  const [categories, setCategories] = useState<RecordModel[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})

  const loadData = async () => {
    try {
      const [activeRes, unreadRes, recentRes, catsRes, allConvsRes] = await Promise.all([
        pb.collection('conversations').getList(1, 1),
        pb.collection('conversations').getList(1, 1, { filter: 'unread_count > 0' }),
        pb.collection('conversations').getList(1, 5, { sort: '-updated' }),
        pb.collection('categories').getFullList({ sort: '-created' }),
        pb.collection('conversations').getFullList({ fields: 'tags' }),
      ])

      setActiveChats(activeRes.totalItems)
      setUnanswered(unreadRes.totalItems)
      setRecentChats(recentRes.items)
      setCategories(catsRes)

      const counts: Record<string, number> = {}
      allConvsRes.forEach((conv) => {
        const tags = Array.isArray(conv.tags) ? conv.tags : conv.tags ? [conv.tags] : []
        tags.forEach((t: string) => {
          counts[t] = (counts[t] || 0) + 1
        })
      })
      setCategoryCounts(counts)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  useRealtime(
    'conversations',
    () => {
      loadData()
    },
    !!user,
  )
  useRealtime(
    'categories',
    () => {
      loadData()
    },
    !!user,
  )

  const sortedCategories = [...categories]
    .sort((a, b) => (categoryCounts[b.id] || 0) - (categoryCounts[a.id] || 0))
    .slice(0, 8)

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-serif font-bold text-brand-primary">Visão Geral</h1>
        <p className="text-brand-muted mt-1">
          Acompanhe o desempenho do seu atendimento em tempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-muted">Conversas Ativas</CardTitle>
            <div className="p-2 bg-brand-primary/10 rounded-full">
              <MessageSquare className="h-4 w-4 text-brand-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-serif font-bold text-brand-deep">{activeChats}</div>
            <p className="text-xs text-brand-muted flex items-center mt-2 font-medium">
              Total de conversas na base
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-brand-muted">Não Respondidas</CardTitle>
            <div className="p-2 bg-red-500/10 rounded-full">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-serif font-bold text-brand-deep">{unanswered}</div>
            <p className="text-xs text-brand-muted flex items-center mt-2 font-medium">
              Aguardando sua resposta
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader className="border-b border-brand-cream-dark bg-brand-cream/30">
            <CardTitle className="font-serif text-brand-primary">Conversas Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {recentChats.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma conversa recente encontrada.
              </div>
            ) : (
              <div className="divide-y divide-brand-cream-dark">
                {recentChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="flex items-center justify-between p-4 hover:bg-brand-cream/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <Avatar className="w-10 h-10 shadow-sm border border-brand-cream-dark flex-shrink-0">
                        <AvatarImage
                          src={
                            chat.avatar_url ||
                            (chat.avatar ? pb.files.getURL(chat, chat.avatar) : '')
                          }
                        />
                        <AvatarFallback className="bg-brand-primary/10 text-brand-primary font-bold font-serif">
                          {chat.contact_name?.charAt(0)?.toUpperCase() ||
                            chat.remote_jid?.charAt(0)?.toUpperCase() ||
                            'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-brand-deep truncate">
                            {chat.contact_name || chat.remote_jid || 'Desconhecido'}
                          </p>
                          {chat.unread_count > 0 && (
                            <span className="w-2 h-2 rounded-full bg-brand-primary inline-block animate-pulse flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-brand-muted truncate mt-0.5">
                          {chat.last_message || 'Nenhuma mensagem...'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="ml-4 flex-shrink-0 border-brand-sage text-brand-secondary hover:bg-brand-primary hover:text-white"
                    >
                      <Link
                        to={`/conversas?jid=${encodeURIComponent(chat.remote_jid)}&instance=${encodeURIComponent(chat.instance_name)}`}
                      >
                        Visualizar
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="border-b border-brand-cream-dark bg-brand-cream/30">
            <CardTitle className="font-serif text-brand-primary">Categorias Populares</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4 flex-1">
            {sortedCategories.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                Nenhuma categoria cadastrada.
              </div>
            ) : (
              sortedCategories.map((tag) => {
                const count = categoryCounts[tag.id] || 0
                const maxCount = activeChats || 1
                const percent = Math.round((count / maxCount) * 100)
                return (
                  <div key={tag.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shadow-sm"
                          style={{ backgroundColor: tag.color || '#ccc' }}
                        />
                        <span className="font-medium text-sm truncate max-w-[150px]">
                          {tag.name}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-brand-muted">
                        {count} ({percent}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-brand-cream-dark overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${percent}%`, backgroundColor: tag.color || '#ccc' }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
