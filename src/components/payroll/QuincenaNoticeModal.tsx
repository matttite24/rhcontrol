'use client'

import React, { useRef, useState, useCallback } from 'react'
import { toPng } from 'html-to-image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Organization } from '@/types/employee'
import { MONTH_NAMES_ES } from '@/lib/payroll/generate-bank-payment-tsv'
import { Download, Copy, Check, Sparkles, MessageSquare } from 'lucide-react'

interface QuincenaNoticeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization?: Partial<Organization> | null
  year: number
  month: number
}

const DEFAULT_MESSAGE =
  'Querido equipo, les informamos que el pago de su quincena ha sido procesado exitosamente en sus cuentas bancarias. Agradecemos su valioso esfuerzo y compromiso continuo.'

export function QuincenaNoticeModal({
  open,
  onOpenChange,
  organization,
  year,
  month,
}: QuincenaNoticeModalProps) {
  const bannerRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState('¡Quincena Depositada!')
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const monthName = MONTH_NAMES_ES[month - 1] || ''
  const orgName = organization?.legal_name || organization?.name || 'RH Garden'
  const logoUrl = organization?.logo_url

  const handleDownload = useCallback(async () => {
    if (!bannerRef.current) return
    try {
      setGenerating(true)
      const dataUrl = await toPng(bannerRef.current, { cacheBust: true, pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `quincena_${monthName.toLowerCase()}_${year}_whatsapp.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Error generating image', err)
    } finally {
      setGenerating(false)
    }
  }, [monthName, year])

  const handleCopy = useCallback(async () => {
    if (!bannerRef.current) return
    try {
      setGenerating(true)
      const dataUrl = await toPng(bannerRef.current, { cacheBust: true, pixelRatio: 2 })
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error('Error copying image', err)
      // Fallback a descarga si falla el portapapeles
      handleDownload()
    } finally {
      setGenerating(false)
    }
  }, [handleDownload])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto p-0 rounded-2xl border-none">
        <div className="p-6 md:p-8 flex flex-col h-full bg-background">
          <DialogHeader className="mb-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  Notificación de Quincena
                </DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  Generador de diseño web a PNG listo para WhatsApp.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Vista previa DOM (HTML to Image) */}
            <div className="relative flex items-center justify-center min-h-[350px] md:min-h-0 w-full md:w-[400px] shrink-0">
              
              {/* Contenedor ajustado al tamaño escalado (320x320) para que no rompa el layout del modal */}
              <div className="relative w-[320px] h-[320px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-[24px] overflow-hidden">
                {/* Contenedor real de 800x800 escalado al 40% */}
                <div 
                  className="absolute top-0 left-0 origin-top-left scale-[0.4] w-[800px] h-[800px] pointer-events-none"
                >
                  <div ref={bannerRef} className="w-full h-full bg-white flex flex-col items-center justify-center text-center p-12 relative pointer-events-auto overflow-hidden">
                    
                    {/* Elementos decorativos de fondo */}
                    <div className="absolute inset-0 opacity-[0.3]" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}></div>
                    
                    {/* Línea de color sólido al final */}
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-emerald-600"></div>
                    
                    {/* Contenido principal */}
                    <div className="relative z-10 w-full flex flex-col items-center justify-center h-full">
                      {/* Logo o Nombre */}
                      <div className="mb-10 w-full flex justify-center items-center h-32">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="max-w-[450px] max-h-[140px] object-contain" crossOrigin="anonymous" />
                        ) : (
                          <h2 className="text-4xl font-black text-sky-500 uppercase tracking-tight">{orgName}</h2>
                        )}
                      </div>

                      {/* Títulos */}
                      <h1 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight px-4 drop-shadow-sm">
                        {title}
                      </h1>
                      
                      {/* Badge Mes */}
                      <div className="inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-full bg-emerald-50 text-emerald-600 font-bold text-[22px] tracking-wide mb-10 border border-emerald-100 shadow-sm">
                        <Check className="w-6 h-6" strokeWidth={3} />
                        Pago de {monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase()} {year}
                      </div>

                      {/* Mensaje */}
                      <p className="text-2xl text-slate-700 leading-[1.6] max-w-[650px] font-medium whitespace-pre-wrap">
                        {message}
                      </p>

                      <div className="mt-auto pt-10 flex flex-col items-center gap-3 w-full">
                        <p className="text-slate-900 text-[28px] font-bold">
                          Atentamente, Gerencia
                        </p>
                        <p className="text-slate-500 text-xl font-medium mt-1">
                          {orgName}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {generating && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col gap-3 items-center justify-center text-sm text-foreground font-semibold z-10 rounded-[24px]">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600"></div>
                  Procesando...
                </div>
              )}
            </div>

            {/* Formulario y Acciones */}
            <div className="flex-1 flex flex-col gap-5">
              <div className="space-y-4 flex-1">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Título Principal
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-sm rounded-xl border border-input bg-background px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    placeholder="Ej. ¡Quincena Depositada!"
                  />
                </div>

                <div className="space-y-2 flex-1 flex flex-col">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Mensaje de Agradecimiento
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full flex-1 min-h-[140px] text-sm rounded-xl border border-input bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm resize-none"
                    placeholder="Escribe el agradecimiento..."
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border justify-end">
                <Button
                  variant="secondary"
                  onClick={handleCopy}
                  disabled={generating}
                  className="w-full sm:w-auto gap-2 font-semibold"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-500" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={generating}
                  className="w-full sm:w-auto gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
                >
                  <Download className="h-4 w-4" />
                  Descargar PNG
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
