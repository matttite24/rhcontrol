'use client'

import { useEffect } from 'react'

/**
 * Atajo de teclado "N" para crear un nuevo registro (empleado, incidencia,
 * descuento, novedad de turno) en las páginas de listado donde aplica.
 *
 * Se ignora cuando:
 * - El usuario está escribiendo (input, textarea, select, contentEditable) —
 *   de lo contrario escribir una "n" en cualquier campo de búsqueda o
 *   formulario abriría el modal de creación por accidente.
 * - Hay un modifier (Ctrl/Cmd/Alt) presionado, para no pisar atajos del
 *   navegador o del sistema operativo.
 * - Ya hay un modal/diálogo abierto (`isBlocked`), para no encolar una
 *   segunda apertura mientras el usuario está completando un wizard.
 */
export function useNewItemShortcut(onTrigger: () => void, isBlocked = false) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isBlocked) return
      if (e.key.toLowerCase() !== 'n') return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable

      if (isEditable) return

      e.preventDefault()
      onTrigger()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onTrigger, isBlocked])
}
