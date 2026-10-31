import { useState } from 'react'

/**
 * Devuelve true desde la primera vez que `value` es true y ya no vuelve a false.
 * Sirve para montar un modal cargado de forma diferida solo cuando se abre por
 * primera vez, y mantenerlo montado después para que la animación de cierre
 * funcione.
 */
export function useEverTrue(value: boolean) {
  const [ever, setEver] = useState(value)
  if (value && !ever) setEver(true)
  return ever || value
}
