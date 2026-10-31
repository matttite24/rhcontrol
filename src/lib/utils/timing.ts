/**
 * Mide cuánto tarda una promesa (p. ej. una consulta de Supabase) y lo registra
 * en la consola del servidor como `[timing] etiqueta 123ms`.
 *
 * Solo registra si `TIMING_LOGS=1` está en el entorno (en .env.local para
 * desarrollo, o en las variables de Vercel para medir producción), así que no
 * añade ruido ni costo cuando está apagado. No cambia el resultado ni los
 * errores de la promesa original.
 */
export async function timed<T>(label: string, work: PromiseLike<T>): Promise<T> {
  if (process.env.TIMING_LOGS !== '1') return work
  const start = performance.now()
  try {
    return await work
  } finally {
    console.log(`[timing] ${label} ${Math.round(performance.now() - start)}ms`)
  }
}
