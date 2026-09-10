'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface TransitionBackdropProps {
  show: boolean
}

/**
 * Backdrop opaco renderizado vía portal directo a document.body, para el
 * tránsito entre dos <Dialog> independientes (ej. selector de tipo → wizard):
 * cada Dialog anima su propio backdrop (~100ms), y si el launcher vive dentro
 * de un ancestro con su propio stacking context (headers `sticky`/`fixed`
 * con z-index), un simple `fixed z-40` anidado ahí no basta — su z-index se
 * compara solo dentro de ese contexto, no contra el resto de la página. El
 * portal escapa a cualquier stacking context intermedio, igual que hacen los
 * Dialogs reales internamente, así siempre cubre lo que hay debajo (ej. el
 * SubHeader de filtros) durante el hueco entre una animación y la otra.
 */
export function TransitionBackdrop({ show }: TransitionBackdropProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || !show) return null

  return createPortal(
    <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" />,
    document.body
  )
}
