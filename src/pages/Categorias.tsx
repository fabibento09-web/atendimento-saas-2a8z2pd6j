import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Plus, Tag as TagIcon, Trash2, Edit2, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from 'sonner'

export default function Categorias() {
  const { user } = useAuth()
  const [tags, setTags] = useState<any[]>([])
  const [chats, setChats] = useState<any[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#2D4A2B')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const colors = [
    '#2D4A2B',
    '#3b82f6',
    '#10b981',
    '#ef4444',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#64748b',
  ]

  const loadData = async () => {
    if (!user) return
    try {
      const records = await pb.collection('categories').getFullList({ sort: '-created' })
      setTags(records)
      const convs = await pb.collection('conversations').getFullList()
      setChats(convs)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])
  useRealtime('categories', loadData)
  useRealtime('conversations', loadData)

  const handleAdd = async () => {
    if (!newTagName.trim()) return
    try {
      await pb.collection('categories').create({
        name: newTagName.trim(),
        color: newTagColor,
        user_id: user?.id,
      })
      toast.success('Categoria criada com sucesso!')
      setNewTagName('')
      setIsAdding(false)
    } catch (error) {
      toast.error('Erro ao criar categoria.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await pb.collection('categories').delete(id)
      toast.success('Categoria removida.')
    } catch (e) {
      toast.error('Erro ao remover categoria.')
    }
  }

  const startEdit = (tag: any) => {
    setEditingId(tag.id)
    setEditName(tag.name)
  }

  const saveEdit = async (id: string) => {
    try {
      await pb.collection('categories').update(id, { name: editName })
      setEditingId(null)
      toast.success('Categoria atualizada.')
    } catch (e) {
      toast.error('Erro ao atualizar categoria.')
    }
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-brand-primary">Categorias e Tags</h1>
          <p className="text-brand-muted mt-1">
            Organize suas conversas e crie filtros personalizados.
          </p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          className="shrink-0 shadow-sm hover:shadow-md transition-shadow bg-brand-primary text-white"
        >
          <Plus className="w-4 h-4 mr-2" /> Nova Tag
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b border-brand-cream-dark bg-brand-cream/30">
              <CardTitle className="font-serif text-lg flex items-center gap-2 text-brand-primary">
                <TagIcon className="w-4 h-4" /> Uso das Tags
              </CardTitle>
              <CardDescription>Conversas por categoria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 p-3">
              {tags.map((tag) => {
                const count = chats.filter((c) => c.tags?.includes(tag.id)).length
                return (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-brand-cream/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3.5 h-3.5 rounded-full shadow-sm border border-black/10 shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm font-medium text-brand-deep truncate max-w-[120px]">
                        {tag.name}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-brand-cream text-brand-muted group-hover:bg-brand-primary group-hover:text-white transition-colors shadow-sm"
                    >
                      {count}
                    </Badge>
                  </div>
                )
              })}
              {tags.length === 0 && (
                <p className="text-sm text-brand-muted text-center py-4">Nenhuma tag cadastrada.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {isAdding && (
            <Card className="border-brand-primary shadow-lg animate-slide-down overflow-hidden">
              <div className="h-1.5 w-full bg-brand-primary" />
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col xl:flex-row gap-5 items-end">
                  <div className="space-y-2 flex-1 w-full">
                    <Label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                      Nome da Tag
                    </Label>
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Ex: Financeiro, Urgente..."
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                      Cor de Destaque
                    </Label>
                    <div className="flex gap-2 p-1.5 bg-white rounded-md border border-brand-sage shadow-sm">
                      {colors.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewTagColor(c)}
                          className={cn(
                            'w-8 h-8 rounded-full transition-all focus:outline-none shadow-sm border border-black/10',
                            newTagColor === c
                              ? 'ring-2 ring-offset-2 ring-brand-primary scale-110'
                              : 'hover:scale-110 opacity-80 hover:opacity-100',
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full xl:w-auto mt-2 xl:mt-0">
                    <Button
                      variant="outline"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 xl:flex-none border-brand-sage bg-white hover:bg-brand-cream"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleAdd}
                      className="flex-1 xl:flex-none shadow-sm bg-brand-primary text-white hover:bg-brand-secondary"
                    >
                      Salvar Tag
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {tags.map((tag) => (
              <Card key={tag.id} className="hover:shadow-md transition-all group overflow-hidden">
                <div
                  className="h-2 w-full transition-all duration-300 group-hover:h-3"
                  style={{ backgroundColor: tag.color }}
                />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                        style={{ backgroundColor: `${tag.color}15` }}
                      >
                        <TagIcon className="w-5 h-5" style={{ color: tag.color }} />
                      </div>
                      {editingId === tag.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 py-1 px-2 text-sm"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(tag.id)}
                        />
                      ) : (
                        <span
                          className="font-semibold text-brand-deep text-base truncate"
                          title={tag.name}
                        >
                          {tag.name}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingId === tag.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => saveEdit(tag.id)}
                            className="h-8 w-8 text-brand-primary hover:bg-brand-primary/10"
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingId(null)}
                            className="h-8 w-8 text-brand-muted hover:bg-brand-cream"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(tag)}
                            className="h-8 w-8 text-brand-muted hover:text-brand-primary hover:bg-brand-primary/10"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(tag.id)}
                            className="h-8 w-8 text-brand-muted hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {tags.length === 0 && !isAdding && (
              <div className="col-span-full py-12 text-center text-brand-muted flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mb-4">
                  <TagIcon className="w-8 h-8 text-brand-primary" />
                </div>
                <p className="font-serif text-lg text-brand-primary">Nenhuma categoria criada</p>
                <p className="text-sm max-w-sm mt-1">
                  Crie tags para organizar suas conversas do WhatsApp de forma eficiente.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
