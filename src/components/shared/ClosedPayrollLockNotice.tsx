import { Lock } from 'lucide-react'
import type { ClosedPayrollLock } from '@/hooks/use-closed-payroll-lock'

function fmt(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Aviso de solo lectura para registros incluidos en un rol ya generado. */
export function ClosedPayrollLockNotice({ lock }: { lock: ClosedPayrollLock }) {
  return (
    <div className="px-4 py-2.5 border-t bg-muted/40 flex items-start gap-2 text-xs text-muted-foreground shrink-0">
      <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <p>
        Incluido en el rol <strong className="text-foreground">{lock.title}</strong> ({fmt(lock.start_date)} al{' '}
        {fmt(lock.end_date)}), ya generado: solo lectura. Registra cualquier corrección en el siguiente rol.
      </p>
    </div>
  )
}
