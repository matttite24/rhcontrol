'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, Copy, Download, MessageSquare, Cake, PartyPopper, Gift, Sparkles } from 'lucide-react'
import { toPng } from 'html-to-image'

interface BirthdayNoticeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgName: string
  logoUrl?: string | null
  employeeName: string
  birthDate: string // YYYY-MM-DD
}

export function BirthdayNoticeModal({
  open,
  onOpenChange,
  orgName,
  logoUrl,
  employeeName,
  birthDate,
}: BirthdayNoticeModalProps) {
  const bannerRef = useRef<HTMLDivElement>(null)
  
  const firstName = employeeName.split(' ')[0]
  const [name, setName] = useState(employeeName)
  const [title, setTitle] = useState('¡Feliz Cumpleaños!')
  const [message, setMessage] = useState(`Hoy celebramos tu vida, ${firstName}. Esperamos que pases un día increíble lleno de alegrías y rodeado de tus seres queridos. ¡Gracias por ser parte fundamental de nuestro equipo!`)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  // parse date
  const parts = birthDate.split('-')
  const monthNumber = parts[1] ? parseInt(parts[1], 10) : 1
  const day = parts[2] ? parseInt(parts[2], 10) : 1
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const monthName = monthNames[monthNumber - 1]

  const handleDownload = useCallback(async () => {
    if (!bannerRef.current) return
    try {
      setGenerating(true)
      const dataUrl = await toPng(bannerRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.download = `Cumpleanos_${firstName}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Error generating image', err)
      alert('Error al generar la imagen. ' + (err as Error).message)
    } finally {
      setGenerating(false)
    }
  }, [firstName])

  const handleCopy = useCallback(async () => {
    if (!bannerRef.current) return
    try {
      setGenerating(true)
      const dataUrl = await toPng(bannerRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
      })
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
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
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Cake className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  Felicitación de Cumpleaños
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
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-rose-500"></div>
                    
                    {/* Contenido principal */}
                    <div className="relative z-10 w-full flex flex-col items-center justify-center h-full pt-4">
                      {/* Logo o Nombre */}
                      <div className="mb-8 w-full flex justify-center items-center h-32">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="max-w-[450px] max-h-[140px] object-contain" crossOrigin="anonymous" />
                        ) : (
                          <h2 className="text-4xl font-black text-rose-500 uppercase tracking-tight">{orgName}</h2>
                        )}
                      </div>

                      {/* Títulos */}
                      <h1 className="text-[52px] font-extrabold text-slate-900 mb-2 tracking-tight px-4 drop-shadow-sm">
                        {title}
                      </h1>
                      
                      {/* Nombre del Empleado */}
                      <div className="text-[44px] font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-pink-600 mb-6 tracking-tight uppercase px-6">
                        {name}
                      </div>

                      {/* Badge Día */}
                      <div className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-rose-50 text-rose-600 font-bold text-xl tracking-wide mb-10 border border-rose-100 shadow-sm">
                        <Cake className="w-5 h-5" strokeWidth={3} />
                        {day} de {monthName}
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
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-rose-600"></div>
                  Procesando...
                </div>
              )}
            </div>

            {/* Formulario y Acciones */}
            <div className="flex-1 flex flex-col gap-5">
              <div className="space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-4">
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
                      placeholder="Ej. ¡Feliz Cumpleaños!"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      Nombre a mostrar
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-sm rounded-xl border border-input bg-background px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2 flex-1 flex flex-col">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    Mensaje de Felicitación
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full flex-1 min-h-[140px] text-sm rounded-xl border border-input bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm resize-none"
                    placeholder="Escribe la felicitación..."
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
                      <Check className="h-4 w-4 text-rose-500" />
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
                  className="w-full sm:w-auto gap-2 font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20"
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
