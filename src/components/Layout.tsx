import { Outlet, Link, useLocation } from 'react-router-dom'
import { MessageSquare, LayoutDashboard, Tags, Bell, Search } from 'lucide-react'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

function AppSidebar() {
  const location = useLocation()
  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2 text-primary">
          <MessageSquare className="w-6 h-6" />
          <span className="font-serif text-xl font-bold tracking-tight">AtendeSaaS</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === '/home'}
                tooltip="Dashboard"
              >
                <Link to="/home">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === '/conversas'}
                tooltip="Conversas"
              >
                <Link to="/conversas">
                  <MessageSquare />
                  <span>Conversas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === '/categorias'}
                tooltip="Categorias"
              >
                <Link to="/categorias">
                  <Tags />
                  <span>Categorias</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9 border border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-serif font-bold">
              AD
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Admin User</span>
            <span className="text-xs text-muted-foreground">Plano Premium</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export function Layout() {
  const location = useLocation()
  const isAuth = location.pathname === '/'

  if (isAuth) {
    return <Outlet />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background flex flex-col h-screen overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card px-4 shadow-sm z-10">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-lg font-serif font-semibold text-primary ml-2">
              Painel de Controle
            </h1>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar..."
                  className="w-64 pl-8 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/50"
                />
              </div>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-noise bg-opacity-10 relative">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
