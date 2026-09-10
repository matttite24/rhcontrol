'use client'

import React, { useState } from 'react'
import { Employee, EmployeeDocument, EmployeeDocType } from '@/types/employee'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmployeeDocumentsTabProps {
  employee?: Employee
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

  function handleFakeUpload(type: EmployeeDocType, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setDocList((prev) =>
      prev.map((d) =>
        d.type === type
          ? {
              ...d,
              fileName: file.name,
              fileUrl: URL.createObjectURL(file),
              uploadedAt: new Date().toISOString(),
            }
          : d
      )
    )

    toast.success('Documento cargado', `Se adjuntó el archivo: ${file.name}`)
  }

  function handleRemove(type: EmployeeDocType) {
    setDocList((prev) =>
      prev.map((d) =>
        d.type === type
          ? { ...d, fileName: null, fileUrl: null, uploadedAt: null }
          : d
      )
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
    </div>
  )
}
