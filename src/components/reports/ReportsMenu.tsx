'use client'

import Link from 'next/link'
import { BarChart3, ChevronDown, Palmtree } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Reportes disponibles. Cada uno es una página dentro de la app (con sidebar)
 * con opción de imprimir / guardar como PDF. Para agregar otro, añade una
 * entrada aquí y su página en src/app/reports/<slug>.
 */
const REPORTS = [
  {
    href: '/reports/vacations',
    label: 'Reporte de vacaciones',
    description: 'Días tomados y faltantes por empleado',
    icon: Palmtree,
  },
]

export function ReportsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 font-medium cursor-pointer">
            <BarChart3 className="h-4 w-4" />
            Reportes
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Reportes</DropdownMenuLabel>
        </DropdownMenuGroup>
        {REPORTS.map((r) => (
          <DropdownMenuItem
            key={r.href}
            render={<Link href={r.href} />}
            className="gap-2.5 cursor-pointer"
          >
            <r.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex flex-col">
              <span className="font-medium">{r.label}</span>
              <span className="text-xs text-muted-foreground">{r.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
