'use client'

import React, { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePendingFlag } from '@/components/layout/nav-pending'

/**
 * <Link> que navega dentro de una transición: conserva el contenido anterior
 * (sin saltar al skeleton) y activa la atenuación global de las tablas
 * (ver nav-pending.ts). Pensado para la paginación.
 */
export function NavLink({ href, onClick, ...props }: React.ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  usePendingFlag(isPending)
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        startTransition(() => router.push(href))
      }}
      {...props}
    />
  )
}
