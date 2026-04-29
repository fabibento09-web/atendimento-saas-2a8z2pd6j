import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, QrCode, UserPlus, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import {
  createWhatsAppInstanceApi,
  checkWhatsAppInstanceStatus,
} from '@/services/whatsapp_instances'

function StepCard({ stepNum, currentStep, title, icon, children, description }: any) {
  const isActive = stepNum === currentStep
  const isPast = stepNum < currentStep
  const isFuture = stepNum > currentStep

  return (
    <Card
      className={cn(
        'transition-all duration-500 relative overflow-hidden',
        isActive
          ? 'ring-2 ring-primary shadow-xl scale-105 z-10 bg-card'
          : 'opacity-60 scale-100 bg-muted/30',
        isPast && 'border-primary bg-primary/5',
        isFuture && 'grayscale',
      )}
    >
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : isPast
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {isPast ? <CheckCircle2 className="w-6 h-6" /> : icon}
          </div>
          <CardTitle className="font-serif text-xl">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {isActive && (
        <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-primary/20 rounded-xl" />
      )}
    </Card>
  )
}

export default function Index() {
  const [step, setStep] = useState(1)
  const [progress, setProgress] = useState(0)
  const navigate = useNavigate()
  const { signIn, signUp, user } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(false)
  const [loading, setLoading] = useState(false)

  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (user && step === 1) {
      setStep(2)
    }
  }, [user, step])

  useEffect(() => {
    if (step === 2 && user?.id) {
      const initInstance = async () => {
        try {
          setApiError(null)
          const res = await createWhatsAppInstanceApi(user.id)
          if (res.qrcodeBase64) {
            setQrCodeBase64(res.qrcodeBase64)
          }
          setIsPolling(true)
        } catch (error) {
          setApiError('Erro ao gerar QR Code do WhatsApp. Tente novamente.')
          toast.error('Erro ao gerar QR Code do WhatsApp. Tente novamente.')
        }
      }
      initInstance()
    }
  }, [step, user])

  useEffect(() => {
    let intervalId: any

    if (isPolling && step === 2 && user?.id) {
      intervalId = setInterval(async () => {
        try {
          const res = await checkWhatsAppInstanceStatus(user.id)
          setApiError(null) // Reset error if successful response
          if (res.qrcodeBase64) {
            setQrCodeBase64(res.qrcodeBase64)
          }
          if (res.status === 'connected') {
            setIsPolling(false)
            setStep(3)
          }
        } catch (error) {
          setApiError('Erro ao verificar status. Tentando novamente...')
        }
      }, 3000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isPolling, step, user])

  const handleAuth = async () => {
    setLoading(true)
    if (isLogin) {
      const { error } = await signIn(email, password)
      if (error) {
        toast.error('Erro ao fazer login. Verifique suas credenciais.')
      } else {
        toast.success('Login efetuado com sucesso!')
        setStep(2)
      }
    } else {
      if (!name || !email || !password) {
        toast.error('Preencha todos os campos.')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, name)
      if (error) {
        toast.error('Erro ao criar conta. E-mail pode já estar em uso.')
      } else {
        toast.success('Conta criada com sucesso!')
        setStep(2)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    if (step === 3) {
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(interval)
            setTimeout(() => navigate('/home'), 600)
            return 100
          }
          return p + Math.floor(Math.random() * 15) + 5
        })
      }, 300)
      return () => clearInterval(interval)
    }
  }, [step, navigate])

  return (
    <div className="min-h-screen bg-noise bg-background flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-transparent to-[#E5E0D8]/40 pointer-events-none mix-blend-multiply" />

      <div className="mb-12 text-center space-y-4 relative z-10">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary animate-fade-in-down">
          AtendeSaaS
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto animate-fade-in-up">
          Configure sua plataforma em três passos simples e revolucione o atendimento da sua equipe.
        </p>
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start relative z-10">
        <StepCard
          stepNum={1}
          currentStep={step}
          title={isLogin ? 'Fazer Login' : 'Criar Cadastro'}
          description="Seus dados de acesso"
          icon={<UserPlus className="w-5 h-5" />}
        >
          <div className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input
                  placeholder="Ex: João Silva"
                  disabled={step !== 1 || loading}
                  className="bg-card"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>E-mail Corporativo</Label>
              <Input
                type="email"
                placeholder="joao@empresa.com"
                disabled={step !== 1 || loading}
                className="bg-card"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                placeholder="••••••••"
                disabled={step !== 1 || loading}
                className="bg-card"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-3 pt-2">
              <Button className="w-full" onClick={handleAuth} disabled={step !== 1 || loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isLogin ? 'Entrar' : 'Cadastrar'}
              </Button>
              {step === 1 && (
                <Button
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground hover:text-primary"
                  onClick={() => setIsLogin(!isLogin)}
                  disabled={loading}
                >
                  {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Fazer login'}
                </Button>
              )}
            </div>
          </div>
        </StepCard>

        <StepCard
          stepNum={2}
          currentStep={step}
          title="Conectar WhatsApp"
          description="Escaneie para vincular"
          icon={<QrCode className="w-5 h-5" />}
        >
          <div className="flex flex-col items-center justify-center space-y-6 py-4">
            <div
              className={cn(
                'p-4 bg-white rounded-2xl shadow-inner transition-all flex items-center justify-center w-[192px] h-[192px]',
                step !== 2 && 'opacity-50 blur-sm grayscale',
              )}
            >
              {qrCodeBase64 ? (
                <img
                  src={
                    qrCodeBase64.startsWith('data:image')
                      ? qrCodeBase64
                      : `data:image/png;base64,${qrCodeBase64}`
                  }
                  alt="QR Code"
                  className="w-40 h-40 mix-blend-multiply"
                />
              ) : step === 2 && !apiError ? (
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              ) : (
                <QrCode className="w-16 h-16 text-muted/30" />
              )}
            </div>
            {apiError && (
              <p className="text-xs text-center text-destructive bg-destructive/10 p-2 rounded-md w-full">
                {apiError}
              </p>
            )}
            <p className="text-sm text-center text-muted-foreground">
              Abra o WhatsApp no seu celular, acesse "Aparelhos Conectados" e aponte a câmera para o
              código.
            </p>
          </div>
        </StepCard>

        <StepCard
          stepNum={3}
          currentStep={step}
          title="Sincronizar"
          description="Importando conversas"
          icon={<RefreshCw className={cn('w-5 h-5', step === 3 && 'animate-spin')} />}
        >
          <div className="flex flex-col items-center justify-center space-y-8 py-8">
            <div className="w-full space-y-3">
              <div className="flex justify-between text-sm font-medium">
                <span className={cn(step === 3 ? 'text-primary' : 'text-muted-foreground')}>
                  {progress < 100 ? 'Baixando histórico...' : 'Concluído!'}
                </span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
            <p className="text-xs text-center text-muted-foreground leading-relaxed">
              Estamos puxando as conversas e contatos ativos da Evolution API para sua nova base de
              dados no Supabase.
            </p>
          </div>
        </StepCard>
      </div>
    </div>
  )
}
