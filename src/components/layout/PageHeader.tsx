import React from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'

export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  action,
  children,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background px-6 py-4 transition-all">
      {/* Fila principal: Título + Descripción + Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-2 min-w-0">
          {/* En móvil el sidebar es un panel oculto: este botón lo abre. */}
          <SidebarTrigger className="md:hidden -ml-2 mt-0.5 shrink-0" />
          <div className="space-y-0.5 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs md:text-sm text-muted-foreground">
              {description}
            </p>
          )}
          </div>
        </div>

        {action && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {action}
          </div>
        )}
      </div>

      {/* Contenido auxiliar opcional */}
      {children}
    </header>
  )
}
