'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Organization, OrganizationInvitation, OrganizationMember } from '@/types/employee'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import crypto from 'crypto'

/**
 * Reconstruye la URL base de la app (https://host) a partir de las cabeceras
 * del request actual. Sirve para armar el enlace de invitación en el correo.
 */
async function getAppBaseUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  const proto = h.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

/**
 * Crea una nueva organización y asigna al usuario autenticado como su
 * primer miembro (role='owner').
 */
export async function createOrganizationWithOwnerAction(
  name: string
): Promise<{ success: boolean; data?: Organization; error?: string }> {
  const trimmedName = name.trim()
  if (!trimmedName) {
    return { success: false, error: 'El nombre de la empresa es obligatorio.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Debes iniciar sesión para crear una organización.' }
  }

  const slug =
    trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + `-${Date.now().toString().slice(-4)}`

  const { data: orgData, error: orgErr } = await supabase
  .from('organizations')
  .insert({ name: trimmedName, slug })
  .select()
  .single()

  if (orgErr || !orgData) {
    return { success: false, error: orgErr?.message || 'No se pudo crear la organización.' }
  }

  const created = orgData as Organization

  const { error: memberErr } = await supabase.from('organization_members').insert({
    organization_id: created.id,
    user_id: user.id,
    role: 'owner',
  })

  if (memberErr) {
    return { success: false, error: memberErr.message }
  }

  revalidatePath('/', 'layout')

  return { success: true, data: created }
}

/**
 * Obtiene los miembros de la organización actual con sus roles.
 */
export async function getOrganizationMembersAction(
  organizationId: string
): Promise<{ success: boolean; data?: OrganizationMember[]; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado.' }
    }

    // RPC security definer: une organization_members con auth.users para
    // devolver el correo. Valida internamente que el llamante sea miembro.
    const { data: members, error } = await supabase.rpc(
      'get_organization_members_with_email',
      { org_id: organizationId }
    )

    if (error) {
      // Fallback si el RPC aún no está desplegado: lista sin correo.
      const { data: basic, error: basicErr } = await supabase
        .from('organization_members')
        .select('id, organization_id, user_id, role, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })

      if (basicErr) {
        return { success: false, error: basicErr.message }
      }
      return { success: true, data: (basic as OrganizationMember[]) || [] }
    }

    const mapped = ((members as any[]) || []).map((m) => ({
      id: m.id,
      organization_id: m.organization_id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      user_email: m.email ?? null,
    })) as OrganizationMember[]

    return { success: true, data: mapped }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener miembros.' }
  }
}

/**
 * Obtiene las invitaciones pendientes de la organización actual.
 */
export async function getOrganizationInvitationsAction(
  organizationId: string
): Promise<{ success: boolean; data?: OrganizationInvitation[]; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado.' }
    }

    const { data: invites, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: (invites as OrganizationInvitation[]) || [] }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener invitaciones.' }
  }
}

/**
 * Invita a un usuario a la organización por correo electrónico.
 */
export async function inviteUserToOrganizationAction(params: {
  organizationId: string
  email: string
  role: 'admin' | 'member'
}): Promise<{
  success: boolean
  invitation?: OrganizationInvitation
  inviteUrl?: string
  emailSent?: boolean
  emailError?: string
  error?: string
}> {
  try {
    const email = params.email.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Ingresa un correo electrónico válido.' }
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado.' }
    }

    // Verificar si el usuario ya es miembro
    // Nota: Por seguridad RLS, organization_members solo permite ver a miembros de la org
    const { data: existingMembers } = await supabase
      .from('organization_members')
      .select('id, user_id')
      .eq('organization_id', params.organizationId)

    // Generar un token criptográfico seguro
    const token = crypto.randomBytes(32).toString('hex')

    // Comprobar si ya hay una invitación pendiente para este correo
    const { data: existingInvite } = await supabase
      .from('organization_invitations')
      .select('id')
      .eq('organization_id', params.organizationId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingInvite) {
      return {
        success: false,
        error: 'Ya existe una invitación pendiente para este correo.',
      }
    }

    const { data: newInvite, error: insertError } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: params.organizationId,
        email,
        role: params.role,
        token,
        invited_by: user.id,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    const invitation = newInvite as OrganizationInvitation
    const baseUrl = await getAppBaseUrl()
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`

    // Enviar el correo de invitación vía la Admin API de Supabase.
    // Si no hay service_role key configurada, seguimos adelante: el admin
    // puede copiar el enlace manualmente desde la UI.
    let emailSent = false
    let emailError: string | undefined
    const admin = createAdminClient()
    if (admin) {
      const { error: mailErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: inviteUrl,
        data: {
          organization_id: params.organizationId,
          invited_role: params.role,
        },
      })
      if (mailErr) {
        // El usuario ya podría existir en auth.users: no es un fallo real de
        // la invitación (la fila ya está creada), solo del envío automático.
        emailError = mailErr.message
      } else {
        emailSent = true
      }
    } else {
      emailError = 'SUPABASE_SERVICE_ROLE_KEY no configurada; comparte el enlace manualmente.'
    }

    revalidatePath('/settings')

    return { success: true, invitation, inviteUrl, emailSent, emailError }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al invitar al usuario.' }
  }
}

/**
 * Revoca o cancela una invitación pendiente.
 */
export async function revokeInvitationAction(
  invitationId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado.' }
    }

    // Borramos la fila en vez de marcarla 'revoked': el constraint
    // unique(organization_id, email, status) impide tener dos filas
    // 'revoked' del mismo correo, y una invitación cancelada no
    // necesita conservarse. `.select()` nos deja detectar si RLS
    // filtró la fila (0 borradas => no eres admin/owner de la org).
    const { data: deleted, error } = await supabase
      .from('organization_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('organization_id', organizationId)
      .select('id')

    if (error) {
      return { success: false, error: error.message }
    }

    if (!deleted || deleted.length === 0) {
      return {
        success: false,
        error: 'No se pudo cancelar la invitación. Verifica que sigas siendo administrador de la organización.',
      }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al revocar invitación.' }
  }
}

/**
 * Remueve a un miembro de la organización.
 */
export async function removeMemberAction(
  memberId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'No autenticado.' }
    }

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', organizationId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar miembro.' }
  }
}

/**
 * Lista las invitaciones pendientes dirigidas al correo del usuario
 * autenticado (todas las organizaciones). Se usa en /select-org para
 * que el invitado pueda aceptarlas sin tener el enlace con el token.
 *
 * La RLS de organization_invitations ya permite al invitado ver sus
 * propias filas: `lower(email) = lower(auth.jwt() ->> 'email')`.
 */
export async function getMyPendingInvitationsAction(): Promise<{
  success: boolean
  data?: Array<{
    id: string
    token: string
    role: 'admin' | 'member'
    organization_id: string
    organization_name: string
    expires_at: string
  }>
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return { success: false, error: 'No autenticado.' }
    }

    const { data, error } = await supabase
      .from('organization_invitations')
      .select('id, token, role, organization_id, expires_at, organizations(name)')
      .eq('email', user.email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    const invites = (data || []).map((row: any) => ({
      id: row.id,
      token: row.token,
      role: row.role,
      organization_id: row.organization_id,
      organization_name: row.organizations?.name || 'Organización',
      expires_at: row.expires_at,
    }))

    return { success: true, data: invites }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener invitaciones.' }
  }
}

/**
 * Acepta una invitación usando el token.
 * Llama al RPC transaccional y seguro `accept_organization_invitation`.
 */
export async function acceptInvitationAction(
  token: string
): Promise<{ success: boolean; error?: string; organization_id?: string; organization_name?: string }> {
  try {
    if (!token?.trim()) {
      return { success: false, error: 'Token de invitación inválido.' }
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Debes iniciar sesión para aceptar la invitación.' }
    }

    const { data, error } = await supabase.rpc('accept_organization_invitation', {
      invitation_token: token.trim(),
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data.success) {
      return { success: false, error: data.error }
    }

    revalidatePath('/', 'layout')

    return {
      success: true,
      organization_id: data.organization_id,
      organization_name: data.organization_name,
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al procesar la invitación.' }
  }
}
