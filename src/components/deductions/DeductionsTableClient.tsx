'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DEDUCTION_TYPE_OPTIONS } from '@/lib/deductions/constants'
import { Deduction, DeductionStatus, Organization } from '@/types/employee'
import { DollarSign, Repeat, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeductionDetailModal } from './DeductionDetailModal'

interface DeductionsTableClientProps {
  deductions: Deduction[]
  organization?: Organization | null
}

const statusConfig: Record<DeductionStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pendiente: { label: 'Pendiente', variant: 'outline' },
  aplicado:  { label: 'Aplicado en Rol', variant: 'default' },
  anulado:   { label: 'Anulado', variant: 'destructive' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function DeductionsTableClient({ deductions, organization }: DeductionsTableClientProps) {
  const [selectedDeduction, setSelectedDeduction] = useState<Deduction | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  // La paginación ya viene resuelta por el servidor (ver PaginationBar en la
  // page): `deductions` aquí es solo la página actual, no la lista completa.

  function handleOpenDetail(item: Deduction) {
    setSelectedDeduction(item)
    setDetailModalOpen(true)
  }

  return (
    <>
      <div className="w-full">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
              <TableHead className="w-[26%] pl-6 font-semibold">Empleado</TableHead>
              <TableHead className="w-[22%] font-semibold">Tipo de Descuento</TableHead>
              <TableHead className="w-[13%] font-semibold">Monto</TableHead>
              <TableHead className="w-[11%] font-semibold">Frecuencia</TableHead>
              <TableHead className="w-[11%] font-semibold">Estado</TableHead>
              <TableHead className="w-[9%] font-semibold">Fecha</TableHead>
              <TableHead className="w-[8%] pr-6 text-right font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deductions.map((item) => {
              const typeMeta = DEDUCTION_TYPE_OPTIONS.find((t) => t.type === item.deduction_type)
              const TypeIcon = typeMeta?.icon || DollarSign
              const status = statusConfig[item.status] ?? statusConfig.pendiente

              return (
                <TableRow key={item.id} className="hover:bg-muted/40 transition-colors text-xs">
                  {/* Empleado */}
                  <TableCell className="pl-6 py-3.5">
                    {item.employee ? (
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/employees/${item.employee.id}`}
                          title={`Ver expediente de ${item.employee.full_name}`}
                          aria-label={`Ver expediente de ${item.employee.full_name}`}
                          className="shrink-0 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none active:scale-90 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 cursor-pointer"
                        >
                          <Avatar className="h-8 w-8 ring-1 ring-border">
                            <AvatarImage src={item.employee.avatar_url ?? undefined} alt={item.employee.full_name} />
                            <AvatarFallback className="text-[10px] font-semibold">
                              {getInitials(item.employee.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate">
                            {item.employee.full_name}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {item.employee.national_id ?? item.employee.department ?? '—'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Sin empleado asociado</span>
                    )}
                  </TableCell>

                  {/* Tipo de Descuento */}
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-1.5 rounded-md border shrink-0", typeMeta?.iconBg)}>
                        <TypeIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate">
                          {typeMeta?.title || item.title}
                        </span>
                        {item.description && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-xs">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Monto */}
                  <TableCell className="py-3.5">
                    <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                      -${Number(item.amount || 0).toFixed(2)}
                    </span>
                  </TableCell>

                  {/* Frecuencia */}
                  <TableCell className="py-3.5">
                    {item.is_recurring ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                        <Repeat className="h-3 w-3" />
                        Fijo mensual
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Único
                      </span>
                    )}
                  </TableCell>

                  {/* Estado */}
                  <TableCell className="py-3.5">
                    <Badge variant={status.variant} className="text-[11px]">
                      {status.label}
                    </Badge>
                  </TableCell>

                  {/* Fecha */}
                  <TableCell className="py-3.5 text-muted-foreground font-mono text-[11px]">
                    {item.date || (item.created_at ? new Date(item.created_at).toLocaleDateString('es-EC') : '—')}
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="pr-6 py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDetail(item)}
                      className="h-8 text-xs text-primary font-medium hover:text-primary hover:bg-primary/10 gap-1 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <DeductionDetailModal
        deduction={selectedDeduction}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onStatusChanged={(updated) => {
          setSelectedDeduction(updated)
        }}
        organization={organization}
      />
    </>
  )
}
