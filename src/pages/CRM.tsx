import { useState, useEffect } from 'react'
import { getCrmContacts, updateCrmContact } from '@/services/crm_contacts'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Search, User, Briefcase, Phone, MessageSquare, MapPin, Globe, Mail } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

const STAGES = [
  { value: 'all', label: 'Todos' },
  { value: 'lead', label: 'Leads' },
  { value: 'em_atendimento', label: 'Em Atendimento' },
  { value: 'cliente', label: 'Clientes' },
  { value: 'perdido', label: 'Perdidos' },
]

export default function CRM() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('all')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightContactId = searchParams.get('contact')

  const loadContacts = async () => {
    try {
      const data = await getCrmContacts()
      setContacts(data)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar contatos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContacts()
  }, [])

  useRealtime(
    'crm_contacts',
    () => {
      loadContacts()
    },
    !!user,
  )

  const filteredContacts = contacts.filter((c) => {
    const term = search.toLowerCase()
    const matchesSearch =
      (c.push_name || '').toLowerCase().includes(term) ||
      (c.phone || '').toLowerCase().includes(term) ||
      (c.business_email || '').toLowerCase().includes(term) ||
      (c.business_category || '').toLowerCase().includes(term)

    const matchesStage = filterStage === 'all' || c.stage === filterStage

    return matchesSearch && matchesStage
  })

  const handleStageChange = async (id: string, newStage: string) => {
    try {
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, stage: newStage } : c)))
      await updateCrmContact(id, { stage: newStage })
      toast.success('Fase do contato atualizada!')
    } catch (err) {
      toast.error('Erro ao atualizar fase')
      loadContacts()
    }
  }

  const getAvatarUrl = (c: any) => {
    if (c.avatar_file) return pb.files.getURL(c, c.avatar_file)
    return c.avatar_url
  }

  return (
    <div className="flex flex-col h-full space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-3xl font-serif font-bold text-brand-primary">CRM</h2>
          <p className="text-brand-muted text-sm mt-1">
            Gerencie seus contatos e acompanhe o funil de vendas. ({filteredContacts.length}{' '}
            contatos)
          </p>
        </div>

        <div className="flex w-full md:w-auto items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-brand-muted" />
            <Input
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {STAGES.map((stage) => (
          <Button
            key={stage.value}
            variant={filterStage === stage.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStage(stage.value)}
            className="whitespace-nowrap rounded-full"
          >
            {stage.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-brand-muted bg-white/95 backdrop-blur-sm rounded-xl border border-brand-cream-dark p-8 shadow-soft">
          <div className="w-16 h-16 bg-brand-primary/5 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-brand-primary/60" />
          </div>
          <h3 className="text-lg font-semibold text-brand-deep font-serif">
            Nenhum contato encontrado
          </h3>
          <p className="text-sm mt-2 text-center max-w-md leading-relaxed">
            Adicione contatos ao CRM diretamente das suas conversas do WhatsApp clicando no botão
            "Adicionar ao CRM".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className={`bg-white/95 backdrop-blur-sm rounded-xl border shadow-soft overflow-hidden flex flex-col transition-all hover:shadow-md ${highlightContactId === contact.id ? 'ring-2 ring-brand-primary border-brand-primary' : 'border-brand-cream-dark'}`}
            >
              <div className="p-5 flex gap-4 items-start border-b border-brand-cream-dark">
                <Avatar className="w-14 h-14 border border-brand-cream-dark shadow-sm">
                  <AvatarImage src={getAvatarUrl(contact)} />
                  <AvatarFallback className="bg-brand-primary/10 text-brand-primary font-serif">
                    {contact.push_name ? (
                      contact.push_name.charAt(0).toUpperCase()
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate text-brand-deep flex items-center gap-2">
                    {contact.push_name || contact.phone || 'Sem Nome'}
                    {contact.is_business && <Briefcase className="w-3.5 h-3.5 text-blue-500" />}
                  </h3>
                  <div className="flex items-center text-sm text-brand-muted mt-1">
                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                    {contact.phone || contact.jid.split('@')[0]}
                  </div>
                  {contact.business_category && (
                    <span className="inline-block mt-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-brand-cream rounded text-brand-muted">
                      {contact.business_category}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col gap-4 bg-brand-cream/20">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
                    Fase do Lead
                  </label>
                  <Select
                    value={contact.stage}
                    onValueChange={(val) => handleStageChange(contact.id, val)}
                  >
                    <SelectTrigger className="h-9 text-sm bg-white border-brand-sage shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="perdido">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(contact.business_email ||
                  contact.business_website ||
                  contact.business_address) && (
                  <div className="space-y-3 text-sm mt-2 border-t border-muted/50 pt-4">
                    {contact.business_email && (
                      <div className="flex items-center gap-2.5 text-muted-foreground truncate">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span className="truncate">{contact.business_email}</span>
                      </div>
                    )}
                    {contact.business_website && (
                      <div className="flex items-center gap-2.5 text-muted-foreground truncate">
                        <Globe className="w-4 h-4 shrink-0" />
                        <a
                          href={contact.business_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline truncate text-primary/90 font-medium"
                        >
                          {contact.business_website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {contact.business_address && (
                      <div className="flex items-start gap-2.5 text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 text-xs leading-relaxed">
                          {contact.business_address}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {contact.notes && (
                  <div className="mt-auto pt-4 border-t border-muted/50">
                    <p className="text-xs text-muted-foreground italic line-clamp-2 leading-relaxed">
                      "{contact.notes.replace(/<[^>]*>?/gm, '')}"
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-brand-cream-dark bg-white">
                <Button
                  className="w-full border-brand-sage text-brand-secondary hover:bg-brand-primary hover:text-white"
                  variant="outline"
                  onClick={() =>
                    navigate(`/conversas?jid=${contact.jid}&instance=${contact.instance_name}`)
                  }
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Ver Conversa
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
