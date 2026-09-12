/**
 * Falla-rápido para promesas que pueden quedarse colgadas indefinidamente
 * (ej. un fetch a Supabase durante un problema de red intermitente o un cold
 * start de conexión). Sin esto, un Server Component que hace `await` sobre
 * una de esas promesas nunca resuelve ni rechaza — Next.js deja el
 * `loading.tsx` de la ruta mostrado para siempre, sin importar cuántos datos
 * tenga la página (el problema no es volumen de datos, es la promesa colgada).
 *
 * Igual patrón que ya usa src/lib/supabase/middleware.ts para auth.getUser(),
 * generalizado para reusarlo en cualquier punto compartido por muchas rutas
 * (ej. getUserOrganizations, llamado por el layout y cada page del dashboard).
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Tiempo de espera agotado'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timeoutId!)
  }
}
