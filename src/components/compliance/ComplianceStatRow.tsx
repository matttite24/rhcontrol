import { cn } from '@/lib/utils'

interface ComplianceStatRowProps {
  label: string
  value: string
  hint?: string
  emphasis?: 'default' | 'accent'
  accentClassName?: string
  divider?: boolean
}

/**
 * Fila de estadística reutilizable ("etiqueta — valor") usada en toda la
 * Guía de Parámetros Laborales, para no repetir el mismo bloque inline
 * flex-justify-between en cada tarjeta.
 */
export function ComplianceStatRow({
  label,
  value,
  hint,
  emphasis = 'default',
  accentClassName,
  divider = true,
}: ComplianceStatRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-1.5',
        divider && 'border-b border-border/40'
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">
        <span
          className={cn(
            'font-semibold text-foreground',
            emphasis === 'accent' && cn('font-mono font-bold', accentClassName)
          )}
        >
          {value}
        </span>
        {hint && (
          <span className="block text-[10px] text-muted-foreground font-mono">
            {hint}
          </span>
        )}
      </span>
    </div>
  )
}
