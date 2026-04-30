import { Outlet, Link, useLocation, Navigate } from 'react-router-dom'
import { MessageSquare, Bell, Search, LogOut, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
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

  return (
    <header className="sticky top-0 z-50 w-full h-14 md:h-16 bg-white/80 backdrop-blur-md border-b border-brand-cream-dark shadow-sm">
      <div className="flex items-center justify-between px-4 md:px-6 h-full">
        <div className="flex items-center gap-6">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-brand-primary">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-brand-cream border-brand-cream-dark">
              <SheetHeader>
                <SheetTitle className="font-serif font-bold text-xl text-brand-primary flex items-center gap-2">
                  <MessageSquare className="h-6 w-6" />
                  Skip
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      'text-lg font-sans font-medium transition-colors',
                      location.pathname.startsWith(link.path)
                        ? 'text-brand-primary font-bold'
                        : 'text-brand-muted hover:text-brand-primary',
                    )}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link to="/home" className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-brand-primary" />
            <span className="font-serif font-bold text-xl text-brand-primary tracking-tight">
              Skip
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 ml-6">
            {navLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.path)
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    'relative font-sans font-medium text-sm transition-colors py-2',
                    isActive ? 'text-brand-primary' : 'text-brand-muted hover:text-brand-primary',
                    'after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-brand-primary after:transition-transform after:duration-300',
                    isActive ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100',
                  )}
                >
                  {link.name}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-brand-muted hover:text-brand-primary hidden sm:flex"
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-brand-muted hover:text-brand-primary">
            <Bell className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9 border border-brand-cream-dark shadow-sm">
                  {user?.avatar && <AvatarImage src={user.avatar} />}
                  <AvatarFallback className="bg-brand-primary/10 text-brand-primary font-serif font-bold">
                    {user?.name?.substring(0, 2).toUpperCase() ||
                      user?.email?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border-brand-cream-dark">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  {user?.name && (
                    <p className="font-medium text-sm text-brand-primary">{user.name}</p>
                  )}
                  {user?.email && (
                    <p className="w-[200px] truncate text-xs text-brand-muted">{user.email}</p>
                  )}
                </div>
              </div>
              <DropdownMenuItem
                onClick={signOut}
                className="text-red-600 cursor-pointer focus:bg-red-50 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
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
          'flex-1 overflow-auto bg-noise bg-opacity-10 relative pt-0',
          location.pathname.startsWith('/conversas') ? 'p-0' : 'p-4 md:p-6',
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
