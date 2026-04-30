import { Outlet, Link, useLocation, Navigate } from 'react-router-dom'
import { MessageSquare, Search, LogOut, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function TopNav() {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const navLinks = [
    { name: 'Início', path: '/home' },
    { name: 'Conversas', path: '/conversas' },
    { name: 'CRM', path: '/crm' },
    { name: 'Categorias', path: '/categorias' },
  ]

  const activeLink = navLinks.find((link) => location.pathname.startsWith(link.path)) || navLinks[0]

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] md:w-auto transition-all duration-300">
      <nav className="flex items-center justify-between md:justify-start h-14 bg-white/80 backdrop-blur-md border border-[#E3E5D9] rounded-full px-2 shadow-glow">
        {/* Mobile View */}
        <div className="flex items-center w-full justify-between md:hidden px-2">
          <Link to="/home" className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#0f3b21] fill-current" />
            <span className="font-serif font-bold text-[#0f3b21]">{activeLink.name}</span>
          </Link>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
              <Search className="h-4 w-4 text-[#0f3b21]" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-[#0f3b21]">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="top"
                className="bg-white/95 backdrop-blur-xl border-b border-[#E3E5D9] rounded-b-3xl pt-6 px-4"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu de Navegação</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col items-center gap-6 mt-8 mb-6">
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={cn(
                        'text-xl font-sans font-medium transition-colors',
                        location.pathname.startsWith(link.path)
                          ? 'text-[#0f3b21] font-bold'
                          : 'text-[#5A6B5A] hover:text-[#0f3b21]',
                      )}
                    >
                      {link.name}
                    </Link>
                  ))}
                  <div className="w-12 h-px bg-[#E3E5D9] my-2" />
                  <button
                    onClick={signOut}
                    className="text-red-600 font-medium flex items-center gap-2"
                  >
                    <LogOut className="h-5 w-5" />
                    Sair
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:flex items-center h-full">
          {/* Brand Element */}
          <Link
            to="/home"
            className="flex items-center gap-2 pl-4 pr-4 rounded-full hover:bg-black/5 transition-colors h-10"
          >
            <MessageSquare className="h-5 w-5 text-[#0f3b21] fill-current" />
            <span className="font-serif font-bold text-[#0f3b21]">Conectado</span>
          </Link>

          {/* Separator */}
          <div className="w-px h-6 bg-[#E3E5D9] mx-1" />

          {/* Navigation Links */}
          <div className="flex items-center gap-1 px-2">
            {navLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.path)
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    'px-4 py-2 rounded-full font-sans font-medium text-sm transition-all duration-300',
                    isActive
                      ? 'bg-white shadow-[0_2px_10px_rgba(15,59,33,0.08)] text-[#0f3b21]'
                      : 'text-[#5A6B5A] hover:text-[#0f3b21] hover:bg-black/5',
                  )}
                >
                  {link.name}
                </Link>
              )
            })}
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-[#E3E5D9] mx-1" />

          {/* Integrated Actions */}
          <div className="flex items-center gap-1 pl-2 pr-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10 text-[#5A6B5A] hover:text-[#0f3b21] hover:bg-black/5"
            >
              <Search className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full p-0 hover:bg-black/5"
                >
                  <Avatar className="h-8 w-8 border border-[#E3E5D9] shadow-sm">
                    {user?.avatar && <AvatarImage src={pb.files.getURL(user, user.avatar)} />}
                    <AvatarFallback className="bg-[#0f3b21]/10 text-[#0f3b21] font-serif font-bold text-xs">
                      {' '}
                      {user?.name?.substring(0, 2).toUpperCase() ||
                        user?.email?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 bg-white/90 backdrop-blur-xl border-[#E3E5D9] rounded-2xl shadow-xl p-2 mt-2"
              >
                <div className="flex items-center justify-start gap-2 p-2 mb-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user?.name && (
                      <p className="font-medium text-sm text-[#0f3b21]">{user.name}</p>
                    )}
                    {user?.email && (
                      <p className="w-[200px] truncate text-xs text-[#5A6B5A]">{user.email}</p>
                    )}
                  </div>
                </div>
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-red-600 cursor-pointer focus:bg-red-50 focus:text-red-600 rounded-xl"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>
    </div>
  )
}

export function Layout() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const isAuthPage = location.pathname === '/'

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <div className="animate-spin text-brand-primary">
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
    <div className="h-screen bg-brand-cream flex flex-col font-sans overflow-hidden">
      <TopNav />
      <main
        className={cn(
          'flex-1 overflow-auto bg-noise bg-opacity-10 relative pt-[5.5rem] md:pt-[5.5rem]',
          location.pathname.startsWith('/conversas') ? 'px-0 pb-0' : 'px-4 pb-4 md:px-6 md:pb-6',
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
