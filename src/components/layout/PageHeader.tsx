import React from 'react'
import { Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
  /** Muestra el botón "Exportar" con opciones (deshabilitadas hasta implementar la función real). */
  showExport?: boolean
}

export function PageHeader({
  title,
  description,
  action,
  children,
  showExport = false,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background px-6 py-4 transition-all">
      {/* Fila principal: Título + Descripción + Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

        {(action || showExport) && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {showExport && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'gap-1.5 font-medium cursor-pointer'
                      )}
                    >
                      <Download className="h-4 w-4" />
                      Exportar
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem disabled className="gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Excel
                    </span>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      Próximamente
                    </Badge>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      PDF
                    </span>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      Próximamente
                    </Badge>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {action}
          </div>
        )}
      </div>

      {/* Contenido auxiliar opcional */}
      {children}
    </header>
  )
}
