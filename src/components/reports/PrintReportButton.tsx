'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Abre el diálogo de impresión del navegador (ahí se elige "Guardar como PDF"). */
export function PrintReportButton() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()} className="gap-1.5 cursor-pointer print:hidden">
      <Printer className="h-4 w-4" />
      Imprimir / Guardar PDF
    </Button>
  )
}
