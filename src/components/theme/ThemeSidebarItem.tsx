'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import { Sun, Moon } from 'lucide-react'

export function ThemeSidebarItem() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <SidebarMenuButton tooltip="Cambiar tema">
        <Sun className="h-4 w-4 text-muted-foreground" />
        <span>Tema</span>
      </SidebarMenuButton>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <SidebarMenuButton
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      tooltip={isDark ? 'Modo claro' : 'Modo oscuro'}
      className="cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out motion-reduce:transition-none"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-500 shrink-0" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 shrink-0" />
      )}
      <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
    </SidebarMenuButton>
  )
}
