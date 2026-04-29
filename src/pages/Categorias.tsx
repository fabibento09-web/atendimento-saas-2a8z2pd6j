import { useState } from 'react'
import useAppStore from '@/stores/use-app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Plus, Tag as TagIcon, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Categorias() {
  const { tags, chats, addTag, deleteTag } = useAppStore()
  const [isAdding, setIsAdding] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#2D4A2B')

  const handleAdd = () => {
    if (!newTagName.trim()) return
    addTag({ name: newTagName, color: newTagColor })
    setNewTagName('')
    setIsAdding(false)
  }

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

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Categorias e Tags</h1>
          <p className="text-muted-foreground mt-1">
            Organize suas conversas e crie filtros personalizados.
          </p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          className="shrink-0 shadow-sm hover:shadow-md transition-shadow"
        >
          <Plus className="w-4 h-4 mr-2" /> Nova Tag
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-muted shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <TagIcon className="w-4 h-4 text-primary" /> Uso das Tags
              </CardTitle>
              <CardDescription>Conversas por categoria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 p-3">
              {tags.map((tag) => {
                const count = chats.filter((c) => c.tags.includes(tag.id)).length
                return (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3.5 h-3.5 rounded-full shadow-sm border border-black/10"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm font-medium">{tag.name}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm"
                    >
                      {count}
                    </Badge>
                  </div>
                )
              })}
              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma tag cadastrada.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="lg:col-span-3 space-y-6">
          {isAdding && (
            <Card className="border-primary shadow-lg animate-slide-down overflow-hidden">
              <div className="h-1.5 w-full bg-primary" />
              <CardContent className="p-5 sm:p-6 bg-primary/5">
                <div className="flex flex-col sm:flex-row gap-5 items-end">
                  <div className="space-y-2 flex-1 w-full">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Nome da Tag
                    </Label>
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Ex: Financeiro, Urgente..."
                      autoFocus
                      className="bg-card shadow-sm border-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Cor de Destaque
                    </Label>
                    <div className="flex gap-2 p-1 bg-card rounded-md border border-muted shadow-sm">
                      {colors.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewTagColor(c)}
                          className={cn(
                            'w-8 h-8 rounded-full transition-all focus:outline-none shadow-sm border border-black/10',
                            newTagColor === c
                              ? 'ring-2 ring-offset-2 ring-primary scale-110'
                              : 'hover:scale-110 opacity-80 hover:opacity-100',
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <Button
                      variant="outline"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 sm:flex-none border-muted bg-card"
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleAdd} className="flex-1 sm:flex-none shadow-sm">
                      Salvar Tag
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {tags.map((tag) => (
              <Card
                key={tag.id}
                className="hover:shadow-md transition-all group overflow-hidden border-muted"
              >
                <div
                  className="h-2 w-full transition-all duration-300 group-hover:h-3"
                  style={{ backgroundColor: tag.color }}
                />
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: `${tag.color}15` }}
                    >
                      <TagIcon className="w-5 h-5" style={{ color: tag.color }} />
                    </div>
                    <span className="font-semibold text-foreground text-base">{tag.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTag(tag.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
