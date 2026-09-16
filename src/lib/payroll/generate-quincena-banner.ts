'use client'

import { Organization } from '@/types/employee'
import { MONTH_NAMES_ES } from './generate-bank-payment-tsv'

export interface QuincenaBannerOptions {
  organization?: Partial<Organization> | null
  year: number
  month: number
  customMessage?: string
}

async function loadImg(src: string): Promise<HTMLImageElement> {
  // Primero intentamos vía Image con anonymous
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Fallo carga regular'))
      img.src = src
    })
  } catch {
    // Si falla por CORS estricto en Image, intentamos fetch -> blob -> objectUrl
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          URL.revokeObjectURL(objectUrl)
          resolve(img)
        }
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('Fallo carga blob'))
        }
        img.src = objectUrl
      })
    } catch (err) {
      throw new Error('Fallo fetch blob')
    }
  }
}

/**
 * Dibuja un banner nítido (1080x1080 px para WhatsApp) en un elemento HTMLCanvasElement.
 */
export async function drawQuincenaBanner(
  canvas: HTMLCanvasElement,
  options: QuincenaBannerOptions
): Promise<void> {
  const { organization, year, month, customMessage } = options
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = 1080
  const height = 1080
  canvas.width = width
  canvas.height = height

  const monthName = MONTH_NAMES_ES[month - 1] || ''
  const orgName = organization?.legal_name || organization?.name || 'RH Garden'
  const logoUrl = organization?.logo_url

  // 1. Fondo elegante blanco/gris ultra claro
  const bgGrad = ctx.createLinearGradient(0, 0, width, height)
  bgGrad.addColorStop(0, '#f8fafc')
  bgGrad.addColorStop(1, '#f1f5f9')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, width, height)

  // 2. Tarjeta central de contenido con sombra suave
  const cardMargin = 40
  const cardX = cardMargin
  const cardY = cardMargin
  const cardW = width - cardMargin * 2
  const cardH = height - cardMargin * 2
  const cardRadius = 32

  ctx.save()
  // Sombra de la tarjeta
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 15
  
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  
  // Limpiar la sombra para no afectar otros elementos
  ctx.shadowColor = 'transparent'
  // Borde muy sutil
  ctx.lineWidth = 1
  ctx.strokeStyle = '#f1f5f9'
  ctx.stroke()
  ctx.restore()

  // 3. Encabezado / Logo
  let currentY = cardY + 80

  if (logoUrl) {
    try {
      const img = await loadImg(logoUrl)
      // Logo mucho más grande
      const maxLogoW = 550
      const maxLogoH = 200
      const ratio = Math.min(maxLogoW / img.width, maxLogoH / img.height, 1)
      const drawW = img.width * ratio
      const drawH = img.height * ratio
      const drawX = (width - drawW) / 2

      ctx.drawImage(img, drawX, currentY, drawW, drawH)
      currentY += drawH + 40
    } catch {
      // Fallback si no carga imagen externa
      drawFallbackOrg(ctx, orgName, width, currentY)
      currentY += 80
    }
  } else {
    drawFallbackOrg(ctx, orgName, width, currentY)
    currentY += 80
  }

  currentY += 40

  // 4. Badge "NOTIFICACIÓN DE PAGO"
  const badgeText = 'NOTIFICACIÓN DE PAGO'
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const badgeMetrics = ctx.measureText(badgeText)
  const badgePaddingX = 22
  const badgeH = 34
  const badgeW = badgeMetrics.width + badgePaddingX * 2
  const badgeX = (width - badgeW) / 2

  ctx.save()
  roundRect(ctx, badgeX, currentY, badgeW, badgeH, 17)
  ctx.fillStyle = '#ecfdf5' // fondo verde claro
  ctx.fill()
  
  ctx.fillStyle = '#059669' // texto verde esmeralda oscuro
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(badgeText, width / 2, currentY + badgeH / 2)
  ctx.restore()

  currentY += badgeH + 40

  // 5. Título Principal
  ctx.save()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('¡Quincena Depositada!', width / 2, currentY)
  currentY += 46

  // Subtítulo con el Mes y Año
  ctx.font = '500 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#2563eb' // azul fuerte para destacar
  ctx.fillText(`Pago de ${capitalize(monthName)} ${year}`, width / 2, currentY)
  ctx.restore()

  currentY += 60

  // 6. Mensaje de Agradecimiento
  const defaultMsg =
    customMessage ||
    'Querido equipo, les informamos que el pago de su quincena ha sido procesado exitosamente en sus cuentas bancarias. Agradecemos su valioso esfuerzo y compromiso continuo.'

  ctx.save()
  ctx.font = '400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#475569'
  ctx.textAlign = 'center'

  const maxTextWidth = cardW - 160
  const lines = getLines(ctx, defaultMsg, maxTextWidth)
  const lineHeight = 40

  for (const line of lines) {
    ctx.fillText(line, width / 2, currentY)
    currentY += lineHeight
  }
  ctx.restore()

  // 7. Pie institucional: "Atentamente, Gerencia"
  const footerY = cardY + cardH - 120

  ctx.save()
  ctx.textAlign = 'center'

  // Icono o texto de verificación
  ctx.fillStyle = '#059669'
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('✓ TALENTO HUMANO Y NÓMINA', width / 2, footerY)

  // Atentamente Gerencia
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#0f172a'
  ctx.fillText('Atentamente, Gerencia', width / 2, footerY + 38)

  if (orgName) {
    ctx.font = '400 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.fillStyle = '#64748b'
    ctx.fillText(orgName, width / 2, footerY + 68)
  }
  ctx.restore()
}

function drawFallbackOrg(
  ctx: CanvasRenderingContext2D,
  orgName: string,
  width: number,
  y: number
) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = '#0ea5e9'
  ctx.fillText(orgName.toUpperCase(), width / 2, y + 25)
  ctx.restore()
}

function capitalize(s: string) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function getLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = words[0] || ''

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const width = ctx.measureText(currentLine + ' ' + word).width
    if (width < maxWidth) {
      currentLine += ' ' + word
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }
  return lines
}

/**
 * Descarga el contenido del canvas como un archivo PNG.
 */
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}
