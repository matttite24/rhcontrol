'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { Coins, CheckCircle2 } from 'lucide-react'
import { ECUADOR_SBU_DEFAULT } from '@/lib/payroll/ecuador'

interface PayrollParametersSettingsProps {
  currentOrgId: string
}

const STORAGE_KEY_PREFIX = 'rh_payroll_sbu_'

export function PayrollParametersSettings({ currentOrgId }: PayrollParametersSettingsProps) {
  const currentYear = new Date().getFullYear()
  const storageKey = `${STORAGE_KEY_PREFIX}${currentOrgId}_${currentYear}`

  const [sbu, setSbu] = useState<number>(ECUADOR_SBU_DEFAULT)
  const [isSaved, setIsSaved] = useState(false)

  // Cargar SBU persistido de la organización
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed > 0) {
          setSbu(parsed)
          return
        }
      }
    } catch {
      // ignore
    }
    setSbu(ECUADOR_SBU_DEFAULT)
  }, [storageKey])

  function handleSaveSbu(e: React.FormEvent) {
    e.preventDefault()
    if (isNaN(sbu) || sbu <= 0) {
      toast.error('Ingresa un valor de SBU válido')
      return
    }

    try {
      localStorage.setItem(storageKey, sbu.toString())
      setIsSaved(true)
      toast.success(`Salario Básico Unificado para ${currentYear} fijado en $${sbu.toFixed(2)}`)
      setTimeout(() => setIsSaved(false), 3000)
    } catch (err) {
      toast.error('No se pudo guardar la configuración')
    }
  }

  function handleResetDefault() {
    setSbu(ECUADOR_SBU_DEFAULT)
    try {
      localStorage.setItem(storageKey, ECUADOR_SBU_DEFAULT.toString())
      toast.success(`Restablecido al SBU oficial ($${ECUADOR_SBU_DEFAULT.toFixed(2)})`)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-8 w-full max-w-5xl">
      {/* Fijar Salario Básico Unificado (SBU). La guía de referencia con los
          cálculos derivados de este valor (décimos, IESS, horas extras) vive
          en Ajustes > Cumplimiento, junto con el calendario de obligaciones. */}
      <Card className="rounded-xl border-border/80 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Salario Básico Unificado (SBU) — Año {currentYear}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Fija el valor base para el cálculo de décimo cuarto, aportaciones mínimas al IESS y recargos laborales.
                </CardDescription>
              </div>
            </div>

            <Badge variant="outline" className="self-start sm:self-auto text-xs px-2.5 py-1 font-mono font-medium text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
              Año Fiscal {currentYear}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <form onSubmit={handleSaveSbu} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sbu-input" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Monto del SBU en Ecuador (USD) <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="sbu-input"
                    type="number"
                    step="0.01"
                    min="1"
                    value={sbu}
                    onChange={(e) => setSbu(parseFloat(e.target.value) || 0)}
                    className="pl-8 font-mono text-base font-bold text-foreground h-11"
                    placeholder="460.00"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="default"
                  className="h-11 flex-1 font-semibold cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {isSaved ? 'Guardado' : 'Fijar SBU'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={handleResetDefault}
                  className="h-11 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                  title="Restablecer valor predeterminado"
                >
                  Valor oficial
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
