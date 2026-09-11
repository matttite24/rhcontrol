'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteEmployeeAction } from '@/lib/employees/actions'
import { toast } from '@/components/ui/toast'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'

interface DeleteEmployeeButtonProps {
  employeeId: string
  employeeName: string
}

/**
 * Elimina PERMANENTEMENTE un empleado y todos sus datos relacionados
 * (salarios, horarios, incidencias, solicitudes, descuentos, documentos,
 * liquidaciones). No hay deshacer, así que pide escribir el nombre completo
 * del empleado para confirmar — no basta un simple sí/no en una acción tan
 * destructiva e irreversible.
 */
export function DeleteEmployeeButton({ employeeId, employeeName }: DeleteEmployeeButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const canConfirm = confirmText.trim() === employeeName.trim()

  async function handleDelete() {
    if (!canConfirm) return
    setDeleting(true)

    const res = await deleteEmployeeAction(employeeId)

    if (!res.success) {
      toast.error('No se pudo eliminar', res.error || 'Ocurrió un error inesperado.')
      setDeleting(false)
      return
    }

    toast.success('Empleado eliminado', `${employeeName} y sus datos relacionados fueron eliminados.`)
    setOpen(false)
    router.push('/employees')
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setConfirmText('')
      }}
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        Eliminar
      </Button>

      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <DialogTitle>Eliminar empleado permanentemente</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Esta acción no se puede deshacer. Se eliminará a <strong className="text-foreground">{employeeName}</strong>{' '}
            junto con sus salarios, horarios, incidencias, solicitudes, descuentos, documentos y liquidaciones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-employee-name" className="text-xs">
            Escribe <strong className="text-foreground">{employeeName}</strong> para confirmar
          </Label>
          <Input
            id="confirm-employee-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={employeeName}
            autoComplete="off"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!canConfirm || deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1.5" />
            )}
            Eliminar definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
