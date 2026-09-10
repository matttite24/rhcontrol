import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Obtener usuario autenticado, con timeout para evitar que el middleware
  // se quede colgado si Supabase no responde (cold start, red lenta, etc.)
  let user = null
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const timeout = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () =>
        reject(new Error('Timeout esperando respuesta de Supabase Auth'))
      )
    })

    const { data } = await Promise.race([supabase.auth.getUser(), timeout])
    clearTimeout(timeoutId)
    user = data.user
  } catch (error) {
    console.error('[middleware] Error/timeout al obtener usuario:', error)
    // Fail-safe: tratamos como no autenticado en vez de colgar la request
    user = null
  }

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isSelectOrgRoute = pathname.startsWith('/select-org')

  // 1. Si no está autenticado y no está en /login o /register, redirigir a /login
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Si ya está autenticado y visita /login o /register, enviarlo a inicio o a /select-org
  if (user && isAuthRoute) {
    const orgCookie = request.cookies.get('rh_current_org_id')?.value
    const url = request.nextUrl.clone()
    url.pathname = orgCookie ? '/' : '/select-org'
    return NextResponse.redirect(url)
  }

  // 3. Si está autenticado, no tiene org seleccionada y trata de entrar a rutas internas, redirigir a /select-org
  if (user && !isSelectOrgRoute && !isAuthRoute) {
    const orgCookie = request.cookies.get('rh_current_org_id')?.value
    if (!orgCookie) {
      const url = request.nextUrl.clone()
      url.pathname = '/select-org'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
