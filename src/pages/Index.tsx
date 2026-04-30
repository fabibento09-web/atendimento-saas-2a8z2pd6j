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

const OrganicWave = () => (
  <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none z-0 pointer-events-none">
    <svg
      className="relative block w-full h-[120px] md:h-[180px] lg:h-[240px]"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
    >
      <path
        d="M0,120V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V120Z"
        className="fill-background opacity-30"
      ></path>
      <path
        d="M0,120V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-51.44V120Z"
        className="fill-background opacity-60"
      ></path>
      <path
        d="M0,120V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V120Z"
        className="fill-background"
      ></path>
    </svg>
  </div>
)

const PlanetGraphic = () => (
  <svg
    viewBox="0 0 800 800"
    className="w-full h-full opacity-40 animate-spin-slow origin-center"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <radialGradient id="globe-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#041209" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle
      cx="400"
      cy="400"
      r="390"
      fill="url(#globe-glow)"
      className="animate-pulse-glow origin-center"
    />
    <g stroke="currentColor" strokeWidth="1" fill="none" className="text-emerald-500/30">
      <circle cx="400" cy="400" r="380" strokeWidth="2" className="text-emerald-400/50" />
      <ellipse cx="400" cy="400" rx="380" ry="280" />
      <ellipse cx="400" cy="400" rx="380" ry="180" />
      <ellipse cx="400" cy="400" rx="380" ry="80" />
      <line x1="20" y1="400" x2="780" y2="400" strokeWidth="1.5" />
      <ellipse cx="400" cy="400" rx="280" ry="380" />
      <ellipse cx="400" cy="400" rx="180" ry="380" />
      <ellipse cx="400" cy="400" rx="80" ry="380" />
      <line x1="400" y1="20" x2="400" y2="780" strokeWidth="1.5" />
    </g>
    <g fill="#34d399" className="opacity-80">
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
    <div className="min-h-screen bg-gradient-to-br from-[#021007] via-[#062413] to-[#010804] flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top Glow */}
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-900/30 blur-[120px] rounded-full mix-blend-screen" />
        {/* Center Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 blur-[150px] rounded-full mix-blend-screen" />
        {/* Planet Graphic */}
        <div className="absolute top-[30%] md:top-[40%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] md:w-[1200px] md:h-[1200px]">
          <PlanetGraphic />
        </div>
      </div>

      <OrganicWave />

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
