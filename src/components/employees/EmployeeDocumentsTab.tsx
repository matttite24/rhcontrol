'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Employee, EmployeeDocument, EmployeeDocType, Organization } from '@/types/employee'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import {
  FileText,
  FileCheck2,
  ShieldCheck,
  CreditCard,
  UserSquare2,
  Upload,
  CheckCircle2,
  ExternalLink,
  Trash2,
  AlertCircle,
  Printer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  printDecimosRequestDocument,
  DecimosModalidad,
  DecimosRubro,
} from '@/lib/employees/print-decimos-request'
import {
  printPayrollDiscountAuthorizationDocument,
  PayrollDiscountConcept,
} from '@/lib/employees/print-payroll-discount-authorization'
import { printResignationLetterDocument } from '@/lib/employees/print-resignation-letter'
import { printBiweeklyPaymentRequestDocument } from '@/lib/employees/print-biweekly-payment-request'
import {
  printReserveFundsRequestDocument,
  ReserveFundsModalidad,
} from '@/lib/employees/print-reserve-funds-request'

interface EmployeeDocumentsTabProps {
  employee?: Employee
  organization?: Organization | null
  documents?: EmployeeDocument[]
  readOnly?: boolean
}

interface RequiredDocConfig {
  type: EmployeeDocType
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  required: boolean
}

const REQUIRED_DOCS: RequiredDocConfig[] = [
  {
    type: 'contrato',
    title: 'Contrato de Trabajo',
    description: 'Contrato firmado por el empleado y empleador.',
    icon: FileText,
    required: true,
  },
  {
    type: 'legalizacion_mdt',
    title: 'Legalización MDT (SUT)',
    description: 'Registro oficial de legalización en el Ministerio del Trabajo.',
    icon: FileCheck2,
    required: true,
  },
  {
    type: 'aviso_entrada_iess',
    title: 'Aviso de Entrada IESS',
    description: 'Comprobante de afiliación y aviso de entrada en el IESS.',
    icon: ShieldCheck,
    required: true,
  },
  {
    type: 'cedula_papeleta',
    title: 'Cédula y Papeleta de Votación',
    description: 'Copia legible de documento de identidad y certificado de votación.',
    icon: CreditCard,
    required: true,
  },
  {
    type: 'hoja_vida',
    title: 'Hoja de Vida / Currículum',
    description: 'Hoja de vida con respaldos de experiencia y certificados.',
    icon: UserSquare2,
    required: false,
  },
]

export function EmployeeDocumentsTab({
  employee,
  organization,
  documents = [],
  readOnly = false,
}: EmployeeDocumentsTabProps) {
  // Estado local para simular la subida y almacenamiento de archivos en el expediente
  const [docList, setDocList] = useState<Array<{
    type: EmployeeDocType
    title: string
    fileName: string | null
    fileUrl: string | null
    uploadedAt: string | null
  }>>(() => {
    return REQUIRED_DOCS.map((doc) => {
      const existing = documents.find((d) => d.doc_type === doc.type)
      return {
        type: doc.type,
        title: doc.title,
        fileName: existing?.file_name || null,
        fileUrl: existing?.file_url || null,
        uploadedAt: existing?.uploaded_at || null,
      }
    })
  })

  // Blob URLs creados localmente con createObjectURL (previsualización antes
  // de subir a Storage): el navegador no los libera solo, hay que llamar
  // revokeObjectURL explícitamente o quedan retenidos en memoria mientras
  // dure la pestaña. Solo se trackean los que este componente creó (con
  // `blob:` prefix) — un fileUrl existente que venga de Storage (http(s))
  // nunca debe revocarse, apunta a un recurso real, no a un blob local.
  const createdBlobUrls = useRef<Set<string>>(new Set())

  // Selección para la solicitud de acumulación/mensualización de décimos
  const [decimosModalidad, setDecimosModalidad] = useState<DecimosModalidad>('acumular')
  const [decimosRubros, setDecimosRubros] = useState<DecimosRubro[]>(['decima_tercera', 'decima_cuarta'])
  const [decimosIssueDate, setDecimosIssueDate] = useState(() => new Date().toISOString().slice(0, 10))

  function toggleDecimosRubro(rubro: DecimosRubro) {
    setDecimosRubros((prev) =>
      prev.includes(rubro) ? prev.filter((r) => r !== rubro) : [...prev, rubro]
    )
  }

  function handleGenerateDecimosRequest() {
    if (!employee) return
    if (decimosRubros.length === 0) {
      toast.info('Selecciona al menos un rubro', 'Elige Décima Tercera y/o Décima Cuarta Remuneración.')
      return
    }
    printDecimosRequestDocument({
      organization,
      employeeName: employee.full_name,
      nationalId: employee.national_id || '',
      modalidad: decimosModalidad,
      rubros: decimosRubros,
      issueDate: decimosIssueDate || undefined,
    })
  }

  // Selección para la solicitud de acumulación/pago mensual de fondos de reserva
  const [reserveFundsModalidad, setReserveFundsModalidad] = useState<ReserveFundsModalidad>('acumular')
  const [reserveFundsIssueDate, setReserveFundsIssueDate] = useState(() => new Date().toISOString().slice(0, 10))

  function handleGenerateReserveFundsRequest() {
    if (!employee) return
    printReserveFundsRequestDocument({
      organization,
      employeeName: employee.full_name,
      nationalId: employee.national_id || '',
      modalidad: reserveFundsModalidad,
      issueDate: reserveFundsIssueDate || undefined,
    })
  }

  const PAYROLL_DISCOUNT_CONCEPT_OPTIONS: { value: PayrollDiscountConcept; label: string }[] = [
    { value: 'consumo', label: 'Consumos Internos' },
    { value: 'faltante_caja', label: 'Faltante de Caja' },
    { value: 'faltante_inventario', label: 'Faltante de Inventario' },
    { value: 'alimentacion', label: 'Alimentación' },
    { value: 'vivienda', label: 'Vivienda' },
  ]
  const [discountConcepts, setDiscountConcepts] = useState<PayrollDiscountConcept[]>(['consumo'])
  const [discountIssueDate, setDiscountIssueDate] = useState(() => new Date().toISOString().slice(0, 10))

  function toggleDiscountConcept(concept: PayrollDiscountConcept) {
    setDiscountConcepts((prev) =>
      prev.includes(concept) ? prev.filter((c) => c !== concept) : [...prev, concept]
    )
  }

  function handleGeneratePayrollDiscountAuthorization() {
    if (!employee) return
    if (discountConcepts.length === 0) {
      toast.info('Selecciona al menos un concepto', 'Elige el tipo de descuento a autorizar.')
      return
    }
    printPayrollDiscountAuthorizationDocument({
      organization,
      employeeName: employee.full_name,
      nationalId: employee.national_id || '',
      position: employee.position || '',
      concepts: discountConcepts,
      issueDate: discountIssueDate || undefined,
    })
  }

  const [biweeklyIssueDate, setBiweeklyIssueDate] = useState(() => new Date().toISOString().slice(0, 10))

  function handleGenerateBiweeklyPaymentRequest() {
    if (!employee) return
    printBiweeklyPaymentRequestDocument({
      organization,
      employeeName: employee.full_name,
      nationalId: employee.national_id || '',
      position: employee.position || '',
      issueDate: biweeklyIssueDate || undefined,
    })
  }

  // Datos variables de la carta de renuncia (no forman parte del expediente del empleado)
  const [resignationRecipient, setResignationRecipient] = useState('')
  const [resignationRecipientPosition, setResignationRecipientPosition] = useState('')
  const [resignationDate, setResignationDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [resignationHasDiscount, setResignationHasDiscount] = useState(false)
  const [resignationDiscountDays, setResignationDiscountDays] = useState('')
  const [resignationDiscountStart, setResignationDiscountStart] = useState('')
  const [resignationDiscountEnd, setResignationDiscountEnd] = useState('')

  function handleGenerateResignationLetter() {
    if (!employee) return
    if (!resignationRecipient.trim()) {
      toast.info('Falta el destinatario', 'Indica a quién va dirigida la carta de renuncia.')
      return
    }
    if (!resignationDate) {
      toast.info('Falta la fecha de renuncia', 'Indica la fecha efectiva de salida.')
      return
    }
    printResignationLetterDocument({
      organization,
      employeeName: employee.full_name,
      nationalId: employee.national_id || '',
      position: employee.position || '',
      recipientName: resignationRecipient.trim(),
      recipientPosition: resignationRecipientPosition.trim() || undefined,
      resignationDate,
      hasPayrollDiscount: resignationHasDiscount,
      discountDaysCount: resignationHasDiscount ? Number(resignationDiscountDays) || undefined : undefined,
      discountPeriodStart: resignationHasDiscount ? resignationDiscountStart || undefined : undefined,
      discountPeriodEnd: resignationHasDiscount ? resignationDiscountEnd || undefined : undefined,
    })
  }

  function revokeIfOwnBlob(url: string | null) {
    if (url && createdBlobUrls.current.has(url)) {
      URL.revokeObjectURL(url)
      createdBlobUrls.current.delete(url)
    }
  }

  // Libera cualquier blob URL que quede vivo si el componente se desmonta
  // (ej. el usuario navega fuera) sin haber quitado el archivo manualmente.
  useEffect(() => {
    return () => {
      createdBlobUrls.current.forEach((url) => URL.revokeObjectURL(url))
      createdBlobUrls.current.clear()
    }
  }, [])

  function handleFakeUpload(type: EmployeeDocType, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const newUrl = URL.createObjectURL(file)
    createdBlobUrls.current.add(newUrl)

    setDocList((prev) =>
      prev.map((d) => {
        if (d.type !== type) return d
        // Reemplazo de un archivo ya cargado: libera el blob anterior antes
        // de perder la referencia, si era uno creado por este componente.
        revokeIfOwnBlob(d.fileUrl)
        return {
          ...d,
          fileName: file.name,
          fileUrl: newUrl,
          uploadedAt: new Date().toISOString(),
        }
      })
    )

    toast.success('Documento cargado', `Se adjuntó el archivo: ${file.name}`)
  }

  function handleRemove(type: EmployeeDocType) {
    setDocList((prev) =>
      prev.map((d) => {
        if (d.type !== type) return d
        revokeIfOwnBlob(d.fileUrl)
        return { ...d, fileName: null, fileUrl: null, uploadedAt: null }
      })
    )
    toast.info('Documento removido', 'Se quitó el archivo del expediente.')
  }

  const uploadedCount = docList.filter((d) => Boolean(d.fileName)).length
  const totalRequired = REQUIRED_DOCS.filter((d) => d.required).length
  const uploadedRequired = docList.filter((d) => {
    const req = REQUIRED_DOCS.find((r) => r.type === d.type)
    return req?.required && Boolean(d.fileName)
  }).length

  const isComplete = uploadedRequired >= totalRequired

  return (
    <div className="space-y-6 pt-2">
      {/* Banner de Estado del Expediente Digital */}
      <div className={cn(
        "p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4",
        isComplete ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-lg border",
            isComplete ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"
          )}>
            {isComplete ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {isComplete ? 'Expediente de Ingreso Completo' : 'Documentación de Ingreso Pendiente'}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {uploadedCount} de {REQUIRED_DOCS.length} documentos cargados ({uploadedRequired} de {totalRequired} obligatorios de ley).
            </p>
          </div>
        </div>

        <Badge variant={isComplete ? 'default' : 'outline'} className="text-xs">
          {isComplete ? '100% Legalizado' : `${Math.round((uploadedRequired / totalRequired) * 100)}% Completado`}
        </Badge>
      </div>

      {/* Grid de Documentos de Ingreso */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REQUIRED_DOCS.map((doc) => {
          const Icon = doc.icon
          const current = docList.find((d) => d.type === doc.type)
          const isUploaded = Boolean(current?.fileName)

          return (
            <div
              key={doc.type}
              className={cn(
                "p-4 rounded-xl border transition-all flex flex-col justify-between gap-4",
                isUploaded ? "bg-card border-border/80" : "bg-muted/10 border-dashed border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-lg border shrink-0 mt-0.5",
                    isUploaded ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">{doc.title}</span>
                      {doc.required && (
                        <span className="text-[10px] text-destructive font-semibold bg-destructive/10 px-1.5 py-0.2 rounded border border-destructive/20">
                          Requerido
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {doc.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Estado del Archivo / Acciones */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                {isUploaded ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCheck2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="font-mono text-[11px] text-foreground truncate max-w-[180px]">
                      {current?.fileName}
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground italic">
                    Sin archivo adjunto
                  </span>
                )}

                {!readOnly ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <label className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors border",
                      isUploaded 
                        ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}>
                      <Upload className="h-3 w-3" />
                      {isUploaded ? 'Reemplazar' : 'Cargar PDF'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFakeUpload(doc.type, e)}
                        className="hidden"
                      />
                    </label>

                    {isUploaded && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemove(doc.type)}
                        title="Eliminar documento"
                        aria-label="Eliminar documento"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ) : isUploaded && current?.fileUrl ? (
                  <a
                    href={current.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver documento
                  </a>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* Generación de Documentos */}
      <div className="space-y-3">
        {/* Generar Solicitud de Acumulación / Mensualización de Décimos */}
        <div className="p-4 rounded-xl border bg-card border-border/80 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex items-start gap-3 w-72 shrink-0">
            <div className="p-2 rounded-lg border bg-primary/10 text-primary border-primary/20 shrink-0 mt-0.5">
              <Printer className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-foreground">
                Solicitud de Acumulación / Mensualización de Décimos
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Genera el documento de solicitud con los datos del empleado para su firma.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Modalidad</Label>
            <div className="flex gap-3 h-8 items-center">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="decimos-modalidad"
                  checked={decimosModalidad === 'acumular'}
                  onChange={() => setDecimosModalidad('acumular')}
                />
                Acumular
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="decimos-modalidad"
                  checked={decimosModalidad === 'mensualizar'}
                  onChange={() => setDecimosModalidad('mensualizar')}
                />
                Mensualizar
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Rubros</Label>
            <div className="flex gap-3 h-8 items-center">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={decimosRubros.includes('decima_tercera')}
                  onChange={() => toggleDecimosRubro('decima_tercera')}
                />
                Décima Tercera
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={decimosRubros.includes('decima_cuarta')}
                  onChange={() => toggleDecimosRubro('decima_cuarta')}
                />
                Décima Cuarta
              </label>
            </div>
          </div>

          <div className="flex items-end gap-3 ml-auto">
            <div className="space-y-1.5 w-44">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Fecha
              </Label>
              <DatePicker
                id="decimos_issue_date"
                name="decimos_issue_date"
                value={decimosIssueDate}
                onChange={(val) => setDecimosIssueDate(val)}
              />
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleGenerateDecimosRequest}
              disabled={!employee}
              className="cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Generar Documento
            </Button>
          </div>
        </div>

        {/* Generar Solicitud de Acumulación / Pago Mensual de Fondos de Reserva */}
        <div className="p-4 rounded-xl border bg-card border-border/80 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex items-start gap-3 w-72 shrink-0">
            <div className="p-2 rounded-lg border bg-primary/10 text-primary border-primary/20 shrink-0 mt-0.5">
              <Printer className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-foreground">
                Solicitud de Fondos de Reserva
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Genera la solicitud del empleado para acumular sus fondos de reserva en el IESS o
                recibirlos mensualmente junto al rol de pagos.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Modalidad</Label>
            <div className="flex gap-3 h-8 items-center">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="reserve-funds-modalidad"
                  checked={reserveFundsModalidad === 'acumular'}
                  onChange={() => setReserveFundsModalidad('acumular')}
                />
                Acumular (IESS)
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="reserve-funds-modalidad"
                  checked={reserveFundsModalidad === 'pagar_mensual'}
                  onChange={() => setReserveFundsModalidad('pagar_mensual')}
                />
                Pagar mensual
              </label>
            </div>
          </div>

          <div className="flex items-end gap-3 ml-auto">
            <div className="space-y-1.5 w-44">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Fecha
              </Label>
              <DatePicker
                id="reserve_funds_issue_date"
                name="reserve_funds_issue_date"
                value={reserveFundsIssueDate}
                onChange={(val) => setReserveFundsIssueDate(val)}
              />
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleGenerateReserveFundsRequest}
              disabled={!employee}
              className="cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Generar Documento
            </Button>
          </div>
        </div>

        {/* Generar Solicitud y Autorización de Descuento a Rol de Pagos */}
        <div className="p-4 rounded-xl border bg-card border-border/80 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex items-start gap-3 w-72 shrink-0">
            <div className="p-2 rounded-lg border bg-primary/10 text-primary border-primary/20 shrink-0 mt-0.5">
              <Printer className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-foreground">
                Solicitud y Autorización de Descuento a Rol de Pagos
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Genera el documento donde el empleado autoriza el descuento de uno o varios conceptos por rol de pagos.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[260px]">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Conceptos a autorizar
            </Label>
            <div className="flex flex-wrap gap-3 items-center min-h-8">
              {PAYROLL_DISCOUNT_CONCEPT_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discountConcepts.includes(opt.value)}
                    onChange={() => toggleDiscountConcept(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3 ml-auto">
            <div className="space-y-1.5 w-44">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Fecha
              </Label>
              <DatePicker
                id="discount_issue_date"
                name="discount_issue_date"
                value={discountIssueDate}
                onChange={(val) => setDiscountIssueDate(val)}
              />
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleGeneratePayrollDiscountAuthorization}
              disabled={!employee}
              className="cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Generar Documento
            </Button>
          </div>
        </div>

        {/* Generar Solicitud de Pago Quincenal */}
        <div className="p-4 rounded-xl border bg-card border-border/80 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex items-start gap-3 w-72 shrink-0">
            <div className="p-2 rounded-lg border bg-primary/10 text-primary border-primary/20 shrink-0 mt-0.5">
              <Printer className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-foreground">
                Solicitud de Pago de Remuneración en Quincenas
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Genera la solicitud del empleado para recibir su sueldo mensual fraccionado en dos pagos
                (día 15 y fin de mes), conforme al Código del Trabajo del Ecuador.
              </p>
            </div>
          </div>

          <div className="flex items-end gap-3 ml-auto">
            <div className="space-y-1.5 w-44">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Fecha
              </Label>
              <DatePicker
                id="biweekly_issue_date"
                name="biweekly_issue_date"
                value={biweeklyIssueDate}
                onChange={(val) => setBiweeklyIssueDate(val)}
              />
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleGenerateBiweeklyPaymentRequest}
              disabled={!employee}
              className="cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Generar Documento
            </Button>
          </div>
        </div>

        {/* Generar Carta de Renuncia */}
        <div className="p-4 rounded-xl border bg-card border-border/80 space-y-4">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="flex items-start gap-3 w-72 shrink-0">
              <div className="p-2 rounded-lg border bg-primary/10 text-primary border-primary/20 shrink-0 mt-0.5">
                <Printer className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-foreground">Carta de Renuncia</span>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Genera la carta de renuncia irrevocable del empleado, con autorización opcional de
                  descuento por días no laborados.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 w-52">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Dirigido a
              </Label>
              <Input
                value={resignationRecipient}
                onChange={(e) => setResignationRecipient(e.target.value)}
                placeholder="Nombre del destinatario"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5 w-44">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Cargo
              </Label>
              <Input
                value={resignationRecipientPosition}
                onChange={(e) => setResignationRecipientPosition(e.target.value)}
                placeholder="Ej. Gerente General"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-end gap-3 ml-auto">
              <div className="space-y-1.5 w-44">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Fecha
                </Label>
                <DatePicker
                  id="resignation_date"
                  name="resignation_date"
                  value={resignationDate}
                  onChange={(val) => setResignationDate(val)}
                />
              </div>

              <Button
                type="button"
                size="sm"
                onClick={handleGenerateResignationLetter}
                disabled={!employee}
                className="cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                Generar Documento
              </Button>
            </div>
          </div>

          <div className="space-y-3 pl-[calc(18rem+1.5rem)]">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={resignationHasDiscount}
                onChange={(e) => setResignationHasDiscount(e.target.checked)}
              />
              Incluir autorización de descuento por días no laborados
            </label>

            {resignationHasDiscount && (
              <div className="flex flex-wrap gap-4">
                <div className="space-y-1.5 w-36">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Días no laborados
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={resignationDiscountDays}
                    onChange={(e) => setResignationDiscountDays(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5 w-36">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Desde
                  </Label>
                  <DatePicker
                    id="resignation_discount_start"
                    name="resignation_discount_start"
                    value={resignationDiscountStart}
                    onChange={(val) => setResignationDiscountStart(val)}
                  />
                </div>
                <div className="space-y-1.5 w-36">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Hasta
                  </Label>
                  <DatePicker
                    id="resignation_discount_end"
                    name="resignation_discount_end"
                    value={resignationDiscountEnd}
                    onChange={(val) => setResignationDiscountEnd(val)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
