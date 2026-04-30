import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, QrCode, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import {
  createWhatsAppInstanceApi,
  checkWhatsAppInstanceStatus,
  getWhatsAppInstances,
} from '@/services/whatsapp_instances'

function StepCard({ stepNum, currentStep, title, icon, children, description }: any) {
  const isActive = stepNum === currentStep
  const isPast = stepNum < currentStep
  const isFuture = stepNum > currentStep

  return (
    <Card
      className={cn(
        'transition-all duration-500 relative overflow-hidden border backdrop-blur-xl',
        isActive
          ? 'border-2 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)] scale-[1.03] z-10 bg-white/95'
          : isPast
            ? 'border-white/40 bg-white/80 scale-100 opacity-95'
            : 'border-white/20 bg-white/60 scale-100 opacity-80',
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm',
              isActive
                ? 'bg-[#0f3b21] text-white'
                : isPast
                  ? 'bg-[#1a4a2b]/80 text-white'
                  : 'bg-white/60 text-[#1a4a2b]/50',
            )}
          >
            {isPast ? <CheckCircle2 className="w-5 h-5" /> : icon}
          </div>
          <CardTitle
            className={cn(
              'font-serif text-xl',
              isActive || isPast ? 'text-[#0f3b21]' : 'text-[#0f3b21]/50',
            )}
          >
            {title}
          </CardTitle>
        </div>
        <CardDescription
          className={cn(isActive || isPast ? 'text-[#1a4a2b]' : 'text-[#1a4a2b]/50')}
        >
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const PlanetGraphic = () => (
  <svg
    viewBox="0 0 800 800"
    className="w-full h-full opacity-60 animate-spin-slow origin-center"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <radialGradient id="globe-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#041209" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="globe-core" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stopColor="#F7F3E8" stopOpacity="0.05" />
        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle
      cx="400"
      cy="400"
      r="390"
      fill="url(#globe-glow)"
      className="animate-pulse-glow origin-center"
    />
    <circle cx="400" cy="400" r="380" fill="url(#globe-core)" />
    <g stroke="currentColor" strokeWidth="1" fill="none" className="text-[#F7F3E8]/20">
      <circle cx="400" cy="400" r="380" strokeWidth="2" className="text-emerald-400/30" />
      <ellipse cx="400" cy="400" rx="380" ry="280" />
      <ellipse cx="400" cy="400" rx="380" ry="180" />
      <ellipse cx="400" cy="400" rx="380" ry="80" />
      <line x1="20" y1="400" x2="780" y2="400" strokeWidth="1.5" />
      <ellipse cx="400" cy="400" rx="280" ry="380" />
      <ellipse cx="400" cy="400" rx="180" ry="380" />
      <ellipse cx="400" cy="400" rx="80" ry="380" />
      <line x1="400" y1="20" x2="400" y2="780" strokeWidth="1.5" />
    </g>
    <g fill="#F7F3E8" className="opacity-70">
      <circle cx="400" cy="20" r="3" />
      <circle cx="400" cy="780" r="3" />
      <circle cx="20" cy="400" r="3" />
      <circle cx="780" cy="400" r="3" />
      <circle cx="400" cy="400" r="5" fill="#10b981" />
      <circle cx="220" cy="220" r="2" />
      <circle cx="580" cy="220" r="2" />
      <circle cx="220" cy="580" r="2" />
      <circle cx="580" cy="580" r="2" />
      <circle cx="320" cy="120" r="2" />
      <circle cx="480" cy="120" r="2" />
      <circle cx="320" cy="680" r="2" />
      <circle cx="480" cy="680" r="2" />
    </g>
  </svg>
)

export default function Index() {
  const [step, setStep] = useState(1)
  const [progress, setProgress] = useState(0)
  const navigate = useNavigate()
  const { signIn, signUp, user, loading: authLoading } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(false)
  const [loading, setLoading] = useState(false)

  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [instanceNameToPoll, setInstanceNameToPoll] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && user && step === 1) {
      setStep(2)
    }
  }, [user, step, authLoading])

  useEffect(() => {
    let mounted = true

    const initOrCheckInstance = async () => {
      if (step !== 2 || !user?.id) return

      try {
        const instances = await getWhatsAppInstances()
        let instanceName = user.id

        if (instances.length > 0) {
          const instance = instances[0]
          instanceName = instance.instance_name
          if (instance.status === 'connected') {
            setStep(3)
            return
          }
        } else {
          const res = await createWhatsAppInstanceApi(user.id)
          if (res.qrcodeBase64 && mounted) {
            setQrCodeBase64(res.qrcodeBase64)
          }
        }

        if (mounted) {
          setIsPolling(true)
          setInstanceNameToPoll(instanceName)
        }
      } catch (error) {
        if (mounted) {
          setApiError('Erro ao inicializar WhatsApp. Tente novamente.')
        }
      }
    }

    initOrCheckInstance()

    return () => {
      mounted = false
    }
  }, [step, user])

  useEffect(() => {
    let intervalId: any

    if (isPolling && step === 2 && instanceNameToPoll) {
      intervalId = setInterval(async () => {
        try {
          const res = await checkWhatsAppInstanceStatus(instanceNameToPoll)
          setApiError(null)
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
  }, [isPolling, step, instanceNameToPoll])

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#021007] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#021007] flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Sophisticated Wave-Flow Gradient Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-90 animate-wave-gradient"
          style={{
            background:
              'linear-gradient(-45deg, #021007, #062413, #0f3b21, #F7F3E8, #0f3b21, #062413, #021007)',
            backgroundSize: '400% 400%',
          }}
        />
        {/* Gradient overlays for depth and text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#021007]/90 via-transparent to-[#021007]/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#021007]/60 to-[#021007]/90" />

        {/* Animated Blobs for Organic Flow */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#0f3b21]/40 rounded-full mix-blend-screen filter blur-[100px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-[#F7F3E8]/10 rounded-full mix-blend-overlay filter blur-[120px] animate-blob animation-delay-2000" />
        <div className="absolute top-[20%] right-[20%] w-[40vw] h-[40vw] bg-[#1a4a2b]/30 rounded-full mix-blend-screen filter blur-[80px] animate-blob animation-delay-4000" />

        {/* Planet Graphic */}
        <div className="absolute top-[40%] md:top-[50%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] md:w-[1200px] md:h-[1200px]">
          <PlanetGraphic />
        </div>
      </div>

      <div className="mb-12 text-center space-y-4 relative z-10">
        <h1 className="text-4xl md:text-6xl font-serif font-bold text-white drop-shadow-lg animate-fade-in-down tracking-tight">
          AtendeSaaS
        </h1>
        <p className="text-emerald-50/80 max-w-lg mx-auto animate-fade-in-up text-lg font-medium">
          Configure sua plataforma em três passos simples e revolucione o atendimento da sua equipe.
        </p>
      </div>

      <div className="max-w-[1000px] w-full grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start relative z-10">
        <StepCard
          stepNum={1}
          currentStep={step}
          title={isLogin ? 'Fazer Login' : 'Criar Cadastro'}
          description="Seus dados de acesso"
          icon={<CheckCircle2 className="w-5 h-5" />}
        >
          <div className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label className="text-[#5A6B5A]">Nome Completo</Label>
                <Input
                  placeholder="Ex: João Silva"
                  disabled={step !== 1 || loading}
                  className="bg-white/60 border-transparent focus-visible:ring-[#2A4B3C]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[#5A6B5A]">E-mail Corporativo</Label>
              <Input
                type="email"
                placeholder="joao@empresa.com"
                disabled={step !== 1 || loading}
                className="bg-white/60 border-transparent focus-visible:ring-[#2A4B3C]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#5A6B5A]">Senha</Label>
              <Input
                type="password"
                placeholder="••••••••"
                disabled={step !== 1 || loading}
                className="bg-white/60 border-transparent focus-visible:ring-[#2A4B3C]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-3 pt-2">
              <Button
                className="w-full bg-[#0f3b21] hover:bg-[#1a4a2b] text-white shadow-md transition-colors"
                onClick={handleAuth}
                disabled={step !== 1 || loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isLogin ? 'Entrar' : 'Cadastrar'}
              </Button>
              {step === 1 && (
                <Button
                  variant="ghost"
                  className="w-full text-xs text-[#1a4a2b] hover:text-[#0f3b21] hover:bg-black/5"
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
                'p-2 bg-white rounded-xl border border-dashed border-[#C8CCBE] transition-all flex items-center justify-center w-[200px] h-[200px]',
                step !== 2 && 'opacity-50 grayscale',
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
                  className="w-full h-full object-contain"
                />
              ) : step === 2 && !apiError ? (
                <Loader2 className="w-8 h-8 animate-spin text-[#0f3b21]" />
              ) : (
                <QrCode className="w-16 h-16 text-black/10" />
              )}
            </div>
            {apiError && (
              <p className="text-xs text-center text-destructive bg-destructive/10 p-2 rounded-md w-full">
                {apiError}
              </p>
            )}
            <p
              className={cn('text-sm text-center', step === 2 ? 'text-[#5A6B5A]' : 'text-black/40')}
            >
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
                <span className={cn(step === 3 ? 'text-[#5A6B5A]' : 'text-black/40')}>
                  {progress < 100 ? 'Baixando histórico...' : 'Concluído!'}
                </span>
                <span className={cn(step === 3 ? 'text-[#5A6B5A]' : 'text-black/40')}>
                  {progress}%
                </span>
              </div>
              <Progress value={progress} className="h-2 bg-[#E3E5D9] [&>div]:bg-[#0f3b21]" />
            </div>
            <p
              className={cn(
                'text-xs text-center leading-relaxed',
                step === 3 ? 'text-[#5A6B5A]' : 'text-black/40',
              )}
            >
              Estamos puxando as conversas e contatos ativos da Evolution API para sua nova base de
              dados.
            </p>
          </div>
        </StepCard>
      </div>
    </div>
  )
}
