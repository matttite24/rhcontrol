'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Organization } from '@/types/employee'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Loader2, Upload, Trash2, Building2 } from 'lucide-react'

const LOGO_BUCKET = 'org-logos'
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

interface OrgProfileFormProps {
  organization: Organization
}

export function OrgProfileForm({ organization }: OrgProfileFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(organization.logo_url || null)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: organization.name || '',
    legal_name: organization.legal_name || '',
    tax_id: organization.tax_id || '',
    email: organization.email || '',
    phone: organization.phone || '',
    website: organization.website || '',
    address: organization.address || '',
    city: organization.city || '',
    country: organization.country || '',
  })

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return

    setLogoError(null)

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError('Formato no admitido. Usa PNG, JPG, WEBP o SVG.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('El archivo supera el límite de 2 MB.')
      return
    }

    setLogoBusy(true)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${organization.id}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })

    if (uploadError) {
      setLogoError(uploadError.message)
      setLogoBusy(false)
      return
    }

    const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
    // cache-buster para que el <img> y los formatos tomen la versión nueva
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ logo_url: publicUrl })
      .eq('id', organization.id)

    if (updateError) {
      setLogoError(updateError.message)
      setLogoBusy(false)
      return
    }

    setLogoUrl(publicUrl)
    setLogoBusy(false)
    router.refresh()
  }

  async function handleLogoRemove() {
    setLogoError(null)
    setLogoBusy(true)

    // Borra cualquier objeto bajo el prefijo de la organización.
    const { data: list } = await supabase.storage.from(LOGO_BUCKET).list(organization.id)
    if (list && list.length > 0) {
      await supabase.storage
        .from(LOGO_BUCKET)
        .remove(list.map((f) => `${organization.id}/${f.name}`))
    }

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ logo_url: null })
      .eq('id', organization.id)

    if (updateError) {
      setLogoError(updateError.message)
      setLogoBusy(false)
      return
    }

    setLogoUrl(null)
    setLogoBusy(false)
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        name: formData.name.trim(),
        legal_name: formData.legal_name.trim() || null,
        tax_id: formData.tax_id.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        country: formData.country.trim() || null,
      })
      .eq('id', organization.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    router.refresh()
  }

  return (
    <form id="org-profile-form" onSubmit={handleSubmit} className="w-full">
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>Información de la empresa actualizada correctamente.</span>
        </div>
      )}

      {/* 1. SECCIÓN: IDENTIDAD CORPORATIVA */}
      <section className="py-8 first:pt-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
          <div className="lg:col-span-4 space-y-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Identidad Corporativa
            </h3>
          </div>

          <div className="lg:col-span-8 space-y-5 max-w-2xl">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Logotipo</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 rounded-lg border border-border/70 bg-muted/30 flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logotipo" className="h-full w-full object-contain" />
                  ) : (
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={logoBusy}
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2 cursor-pointer"
                    >
                      {logoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {logoUrl ? 'Cambiar' : 'Subir logo'}
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={logoBusy}
                        onClick={handleLogoRemove}
                        className="gap-1.5 text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Quitar
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WEBP o SVG. Máx. 2 MB. Se muestra en el encabezado de los documentos imprimibles.
                  </p>
                  {logoError && <p className="text-xs text-destructive">{logoError}</p>}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_LOGO_TYPES.join(',')}
                  onChange={handleLogoFile}
                  className="hidden"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org_name_pub" className="text-sm font-medium">Nombre Comercial / Público *</Label>
              <Input
                id="org_name_pub"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ej. RH Garden, ACME Tech"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="legal_name" className="text-sm font-medium">Razón Social</Label>
                <Input
                  id="legal_name"
                  value={formData.legal_name}
                  onChange={(e) => handleChange('legal_name', e.target.value)}
                  placeholder="Ej. Soluciones RH Garden S.A. de C.V."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tax_id" className="text-sm font-medium">Identificación Fiscal (RFC / NIF / RUC)</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) => handleChange('tax_id', e.target.value)}
                  placeholder="Ej. SRH200101XYZ"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-border/60" />

      {/* 2. SECCIÓN: CONTACTO Y ENLACES */}
      <section className="py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
          <div className="lg:col-span-4 space-y-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Contacto y Enlaces
            </h3>
          </div>

          <div className="lg:col-span-8 space-y-5 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="org_email" className="text-sm font-medium">Correo Oficial</Label>
                <Input
                  id="org_email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="contacto@empresa.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="org_phone" className="text-sm font-medium">Teléfono Central</Label>
                <Input
                  id="org_phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+52 (55) 1234 5678"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="org_web" className="text-sm font-medium">Sitio Web</Label>
                <Input
                  id="org_web"
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://empresa.com"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-border/60" />

      {/* 3. SECCIÓN: UBICACIÓN / DOMICILIO */}
      <section className="py-8 last:pb-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
          <div className="lg:col-span-4 space-y-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Ubicación / Domicilio
            </h3>
          </div>

          <div className="lg:col-span-8 space-y-5 max-w-2xl">
            <div className="space-y-1.5">
              <Label htmlFor="org_address" className="text-sm font-medium">Dirección</Label>
              <Input
                id="org_address"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Av. Insurgentes Sur 1234, Piso 5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="org_city" className="text-sm font-medium">Ciudad / Estado</Label>
                <Input
                  id="org_city"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Ciudad de México, CDMX"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="org_country" className="text-sm font-medium">País</Label>
                <Input
                  id="org_country"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  placeholder="México"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </form>
  )
}
