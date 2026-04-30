import { Outlet, Link, useLocation, Navigate } from 'react-router-dom'
import { MessageSquare, LayoutDashboard, Tags, Bell, Search, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/use-auth'

function AppSidebar() {
  const location = useLocation()
  const { user, signOut } = useAuth()

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4 bg-sidebar">
        <div className="flex items-center gap-2 text-primary">
          <MessageSquare className="w-6 h-6" />
          <span className="font-serif text-xl font-bold tracking-tight">AtendeSaaS</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
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
      <SidebarFooter className="border-t p-4 bg-sidebar">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9 border border-primary/20 shadow-sm">
            {user?.avatar && <AvatarImage src={user.avatar} />}
            <AvatarFallback className="bg-primary/10 text-primary font-serif font-bold">
              {user?.name?.substring(0, 2).toUpperCase() ||
                user?.email?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{user?.name || user?.email}</span>
            <span className="text-xs text-muted-foreground">Logado</span>
          </div>
          <button
            onClick={signOut}
            className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export function Layout() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const isAuthPage = location.pathname === '/'

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin text-primary">
          <MessageSquare className="w-8 h-8" />
        </div>
      </div>
    )
  }

  if (!user && !isAuthPage) {
    return <Navigate to="/" replace />
  }

  if (isAuthPage) {
    return <Outlet />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background flex flex-col h-screen overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card px-4 shadow-sm z-10">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-lg font-serif font-semibold text-primary ml-2 capitalize">
              {location.pathname.substring(1)}
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
        <main
          className={cn(
            'flex-1 overflow-auto bg-noise bg-opacity-10 relative',
            location.pathname.startsWith('/conversas') ? 'p-0' : 'p-4 md:p-6',
          )}
        >
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
