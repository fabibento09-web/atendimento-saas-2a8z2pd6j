import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Index from './pages/Index'
import Home from './pages/Home'
import Conversas from './pages/Conversas'
import Categorias from './pages/Categorias'
import CRM from './pages/CRM'
import NotFound from './pages/NotFound'
import { Layout } from './components/Layout'
import { AppProvider } from './stores/use-app-store'
import { AuthProvider } from './hooks/use-auth'

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <AuthProvider>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/home" element={<Home />} />
              <Route path="/conversas" element={<Conversas />} />
              <Route path="/categorias" element={<Categorias />} />
              <Route path="/crm" element={<CRM />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AppProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
