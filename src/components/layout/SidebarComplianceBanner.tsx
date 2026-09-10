'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, ShieldCheck, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'rh_compliance_banner_dismissed_at'

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function getDeadlineInfo() {
  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.getMonth() + 1
  const daysInMonth = new Date(today.getFullYear(), currentMonth, 0).getDate()

  // Próximo vencimiento del día 15 (Planilla IESS / Quincena)
  const daysToDay15 = currentDay <= 15 ? 15 - currentDay : (daysInMonth - currentDay) + 15
  const monthLabel = currentDay <= 15 ? MONTH_NAMES[currentMonth - 1] : MONTH_NAMES[currentMonth % 12]

  return { daysToDay15, monthLabel }
}

/**
 * Aviso sutil y descartable sobre plazos legales críticos (ej. planilla IESS),
 * ubicado en el pie del sidebar. Se recuerda el dismiss por día calendario.
 */
export function SidebarComplianceBanner() {
  // Arranca oculto (mismo resultado en servidor y cliente); el efecto de montaje
  // corre después de la hidratación, evitando un mismatch servidor/cliente.
  const [dismissed, setDismissed] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const todayKey = new Date().toDateString()
      setDismissed(stored === todayKey)
    } catch {
      setDismissed(false)
    }
  }, [])

  function handleDismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toDateString())
    } catch {
      // localStorage no disponible; el dismiss solo dura la sesión actual
    }
  }

  if (!mounted || dismissed) return null

  const { daysToDay15, monthLabel } = getDeadlineInfo()
  const isUrgent = daysToDay15 <= 3

  return (
    <div
      className={cn(
        "relative rounded-md border bg-sidebar-accent/40 p-3 text-xs",
        "group-data-[collapsible=icon]:hidden"
      )}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Descartar aviso"
        className="absolute top-2 right-2 text-muted-foreground/60 hover:text-foreground transition-colors active:scale-90"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-center gap-2 pr-4">
        <div className={cn(
          "p-1.5 rounded-md shrink-0",
          isUrgent ? "bg-amber-500/15 text-amber-600" : "bg-blue-500/10 text-blue-600"
        )}>
          <ShieldCheck className="h-3.5 w-3.5" />
        </div>
        <p className="font-semibold text-foreground leading-tight">
          {daysToDay15 === 0 ? 'Planilla IESS vence hoy' : `Planilla IESS en ${daysToDay15} días`}
        </p>
      </div>

      <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
        Aportes y fondos de reserva deben pagarse antes del 15 de {monthLabel}.
      </p>

      <Link
        href="/payroll"
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
      >
        Ir a Nómina
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
