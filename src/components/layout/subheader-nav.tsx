'use client'

import React, { createContext, useContext } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface SubHeaderNavValue {
  /** Navega dentro de la transición del SubHeader (muestra su línea de carga y conserva el contenido anterior). */
  navigate: (href: string) => void
  /** Href al que se está navegando ahora (para marcar la pestaña destino al instante). */
  pendingHref: string | null
}

export const SubHeaderNavContext = createContext<SubHeaderNavValue | null>(null)

type SubHeaderLinkProps = Omit<React.ComponentProps<typeof Link>, 'href'> & {
  href: string
  /** Si es la vista activa según el servidor. */
  active?: boolean
  /** Clases cuando está activa (también se aplican de forma optimista al hacer clic). */
  activeClassName?: string
  /** Clases cuando no está activa. */
  inactiveClassName?: string
}

/**
 * Enlace que, si vive dentro de un <SubHeader>, navega usando su transición:
 * se ve la misma línea de carga que al cambiar un filtro, la tabla anterior
 * se queda (atenuada) en vez de saltar al skeleton, y la pestaña destino se
 * marca como activa al instante. Fuera de un SubHeader es un <Link> normal.
 */
export function SubHeaderLink({
  href,
  onClick,
  active,
  className,
  activeClassName,
  inactiveClassName,
  ...props
}: SubHeaderLinkProps) {
  const ctx = useContext(SubHeaderNavContext)
  const showActive = ctx?.pendingHref ? ctx.pendingHref === href : !!active
  return (
    <Link
      href={href}
      aria-current={showActive ? 'page' : undefined}
      className={cn(className, showActive ? activeClassName : inactiveClassName)}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || !ctx) return
        // Respeta abrir en pestaña nueva / ventana (cmd, ctrl, shift, clic medio).
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        ctx.navigate(href)
      }}
      {...props}
    />
  )
}
