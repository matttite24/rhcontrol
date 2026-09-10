'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { User } from '@supabase/supabase-js'
import { LogOut } from 'lucide-react'

export function SidebarCurrentUser() {
  const supabase = createClient()
  const router = useRouter()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleLogout(e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-1.5 rounded-lg bg-sidebar-accent/30 animate-pulse">
        <div className="size-8 rounded-full bg-muted shrink-0" />
        {!isCollapsed && (
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-2 w-24 bg-muted/60 rounded" />
          </div>
        )}
      </div>
    )
  }

  if (!user) return null

  const email = user.email || 'usuario@rhgarden.com'
  const name = user.user_metadata?.full_name || email.split('@')[0]
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'U'

  // Si el sidebar está colapsado (modo icono estrecho)
  if (isCollapsed) {
    return (
      <SidebarMenuButton
        size="lg"
        onClick={handleLogout}
        tooltip={`${name} (${email}) — Clic para cerrar sesión`}
        className="cursor-pointer flex items-center justify-center p-0"
      >
        <Avatar className="h-8 w-8 ring-1 ring-sidebar-border shrink-0">
          <AvatarImage src={user.user_metadata?.avatar_url} alt={name} />
          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </SidebarMenuButton>
    )
  }

  // Sidebar expandido
  return (
    <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors duration-150 ease-out motion-reduce:transition-none w-full">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Avatar className="h-8 w-8 ring-1 ring-sidebar-border shrink-0">
          <AvatarImage src={user.user_metadata?.avatar_url} alt={name} />
          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="grid flex-1 text-left text-xs leading-tight min-w-0">
          <span className="truncate font-semibold text-foreground">{name}</span>
          <span className="truncate text-[11px] text-muted-foreground/80 leading-none mt-0.5">
            {email}
          </span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleLogout}
        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-90 shrink-0 cursor-pointer rounded-md transition-[color,background-color,transform] duration-150 ease-out motion-reduce:transition-none"
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
