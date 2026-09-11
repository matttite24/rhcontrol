'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmployeeFormSubmitButtonProps {
  formId: string
  label: string
}

/**
 * Botón "Guardar" del formulario de empleado. Vive fuera de <EmployeeForm>
 * (en el header de la página) pero apunta al form por id (form={formId}).
 *
 * Se deshabilita apenas se dispara el submit y hasta que EmployeeForm termina
 * (éxito o error) — evita el doble-submit que duplicaba el empleado si el
 * usuario hacía doble clic mientras el guardado tardaba unos segundos.
 * EmployeeForm avisa el fin despachando un CustomEvent 'employee-form:done'
 * sobre el propio <form>, así no hace falta compartir estado React entre el
 * server component del header y este client component.
 */
export function EmployeeFormSubmitButton({ formId, label }: EmployeeFormSubmitButtonProps) {
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const form = document.getElementById(formId)
    if (!form) return

    const handleSubmit = () => setSubmitting(true)
    const handleDone = () => setSubmitting(false)

    form.addEventListener('submit', handleSubmit)
    form.addEventListener('employee-form:done', handleDone)
    return () => {
      form.removeEventListener('submit', handleSubmit)
      form.removeEventListener('employee-form:done', handleDone)
    }
  }, [formId])

  return (
    <Button type="submit" form={formId} size="sm" className="shadow-sm" disabled={submitting}>
      {submitting ? (
        <Loader2 className={cn('h-4 w-4 mr-1.5 animate-spin')} />
      ) : (
        <Check className="h-4 w-4 mr-1.5" />
      )}
      {submitting ? 'Guardando…' : label}
    </Button>
  )
}
