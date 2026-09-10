'use client'

import React, { useState, useMemo } from 'react'
import { Organization } from '@/types/employee'
import {
  ECUADOR_SBU_DEFAULT,
  getActiveSbu,
  IESS_PERSONAL_RATE,
  IESS_EMPLOYER_RATE,
  RESERVE_FUNDS_RATE,
} from '@/lib/payroll/ecuador'
import { printRoleSimulationDocument } from '@/lib/payroll/print-role-simulation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calculator,
  Printer,
  RotateCcw,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Building2,
  Utensils,
  Home,
  Receipt,
} from 'lucide-react'

interface PayrollSimulatorViewProps {
  currentOrg: Organization | null
}

interface ItemEntry {
  id: string
  name: string
  amount: number
}

const CONTRACT_TYPES = [
  'Indefinido',
  'Plazo Fijo',
  'Eventual',
  'Por Obra',
  'Pasantía',
]

export function PayrollSimulatorView({ currentOrg }: PayrollSimulatorViewProps) {
  // Datos del perfil y contratación tentativa
  const [candidateName, setCandidateName] = useState('')
  const [position, setPosition] = useState('')
  const [department, setDepartment] = useState('')
  const [contractType, setContractType] = useState('Indefinido')
  
  // Salario y SBU dinámico desde la configuración de la organización (o default oficial)
  const initialSbu = currentOrg?.id ? getActiveSbu(currentOrg.id) : ECUADOR_SBU_DEFAULT
  const [baseSalary, setBaseSalary] = useState<number>(initialSbu)
  const [sbu, setSbu] = useState<number>(initialSbu)

  // Opciones de Décimos y Beneficios Sociales
  const [monthlyThirteenth, setMonthlyThirteenth] = useState(true)
  const [monthlyFourteenth, setMonthlyFourteenth] = useState(true)
  const [reserveFundsTreatment, setReserveFundsTreatment] = useState<'pagar_ingreso' | 'pagar_ano' | 'acumular'>('pagar_ano')

  // Bonificaciones adicionales
  const [bonuses, setBonuses] = useState<ItemEntry[]>([])

  // Deducciones internas / acordadas (Alimentación, Vivienda, etc.)
  const [deductions, setDeductions] = useState<ItemEntry[]>([])

  // Horas extras proyectadas
  const [overtime50Hours, setOvertime50Hours] = useState<number>(0)
  const [overtime100Hours, setOvertime100Hours] = useState<number>(0)

  // Notas
  const [notes, setNotes] = useState('')

  // Cálculos reactivos
  const calculations = useMemo(() => {
    const salary = Math.max(0, Number(baseSalary) || 0)
    const validSbu = Math.max(1, Number(sbu) || ECUADOR_SBU_DEFAULT)

    // Total Bonos
    const totalBonuses = bonuses.reduce((acc, b) => acc + (Number(b.amount) || 0), 0)

    // Total Deducciones adicionales (Alimentación, Vivienda, etc.)
    const totalCustomDeductions = deductions.reduce((acc, d) => acc + (Number(d.amount) || 0), 0)

    // Horas Extras (sobre jornada de 240 horas mensuales en Ecuador)
    // Valor hora normal = Sueldo / 240
    const normalHourlyRate = salary > 0 ? salary / 240 : 0
    const overtime50Amount = Number(((Number(overtime50Hours) || 0) * (normalHourlyRate * 1.5)).toFixed(2))
    const overtime100Amount = Number(((Number(overtime100Hours) || 0) * (normalHourlyRate * 2.0)).toFixed(2))
    const totalOvertimeAmount = Number((overtime50Amount + overtime100Amount).toFixed(2))

    // Base imponible IESS (Sueldo + Bonos + Horas Extras)
    const taxableIncome = Number((salary + totalBonuses + totalOvertimeAmount).toFixed(2))

    // Décimo Tercero: 1/12 de los ingresos imponibles
    const thirteenthAmount = monthlyThirteenth
      ? Number((taxableIncome / 12).toFixed(2))
      : 0

    // Décimo Cuarto: 1/12 de 1 SBU
    const fourteenthAmount = monthlyFourteenth
      ? Number((validSbu / 12).toFixed(2))
      : 0

    // Fondos de Reserva: 8.33% del ingreso imponible
    // Si es 'pagar_ingreso', se paga de inmediato. Si es 'pagar_ano', en simulación de nuevo contrato no se percibe de entrada. Si es acumular, va al IESS.
    const reserveFundsAmount = reserveFundsTreatment === 'pagar_ingreso'
      ? Number((taxableIncome * RESERVE_FUNDS_RATE).toFixed(2))
      : 0

    // Total Beneficios sociales incluidos en el rol
    const totalSocialBenefits = Number((thirteenthAmount + fourteenthAmount + reserveFundsAmount).toFixed(2))

    // Total Ingresos brutos del rol (Imponible + Beneficios mensualizados)
    const totalIncome = Number((taxableIncome + totalSocialBenefits).toFixed(2))

    // Deducción Aporte Personal IESS (9.45% de la materia gravada)
    const iessPersonal = Number((taxableIncome * IESS_PERSONAL_RATE).toFixed(2))

    // Total Deducciones consolidadas (IESS Personal + Descuentos de alimentación/vivienda/otros)
    const totalDeductions = Number((iessPersonal + totalCustomDeductions).toFixed(2))

    // Líquido a percibir (Neto para el colaborador)
    const netToReceive = Number(Math.max(0, totalIncome - totalDeductions).toFixed(2))

    // Costo para la Empresa (Empleador):
    // Aporte Patronal IESS (12.15% de la materia gravada)
    const iessEmployer = Number((taxableIncome * IESS_EMPLOYER_RATE).toFixed(2))
    
    // Provisión total anualizada de beneficios (13vo + 14vo + Fondos de reserva completos)
    const fullThirteenthCost = Number((taxableIncome / 12).toFixed(2))
    const fullFourteenthCost = Number((validSbu / 12).toFixed(2))
    const fullReserveCost = reserveFundsTreatment !== 'pagar_ano' 
      ? Number((taxableIncome * RESERVE_FUNDS_RATE).toFixed(2)) 
      : 0
    
    // Costo mensual total de la plaza para la empresa
    const totalCompanyCost = Number((
      taxableIncome + 
      iessEmployer + 
      fullThirteenthCost + 
      fullFourteenthCost + 
      fullReserveCost
    ).toFixed(2))

    return {
      normalHourlyRate,
      totalBonuses,
      totalCustomDeductions,
      totalDeductions,
      overtime50Amount,
      overtime100Amount,
      totalOvertimeAmount,
      taxableIncome,
      thirteenthAmount,
      fourteenthAmount,
      reserveFundsAmount,
      totalSocialBenefits,
      totalIncome,
      iessPersonal,
      netToReceive,
      iessEmployer,
      totalCompanyCost,
    }
  }, [baseSalary, sbu, monthlyThirteenth, monthlyFourteenth, reserveFundsTreatment, bonuses, deductions, overtime50Hours, overtime100Hours])

  // Manejadores de bonos
  const addBonus = (presetName = 'Bono de desempeño', defaultAmount = 50) => {
    setBonuses([
      ...bonuses,
      { id: crypto.randomUUID(), name: presetName, amount: defaultAmount },
    ])
  }

  const updateBonus = (id: string, field: 'name' | 'amount', value: any) => {
    setBonuses(
      bonuses.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    )
  }

  const removeBonus = (id: string) => {
    setBonuses(bonuses.filter((b) => b.id !== id))
  }

  // Manejadores de deducciones (Alimentación, Vivienda, etc.)
  const addDeduction = (presetName = 'Alimentación', defaultAmount = 40) => {
    setDeductions([
      ...deductions,
      { id: crypto.randomUUID(), name: presetName, amount: defaultAmount },
    ])
  }

  const updateDeduction = (id: string, field: 'name' | 'amount', value: any) => {
    setDeductions(
      deductions.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    )
  }

  const removeDeduction = (id: string) => {
    setDeductions(deductions.filter((d) => d.id !== id))
  }

  const handleReset = () => {
    setCandidateName('')
    setPosition('')
    setDepartment('')
    setContractType('Indefinido')
    setBaseSalary(initialSbu)
    setSbu(initialSbu)
    setMonthlyThirteenth(true)
    setMonthlyFourteenth(true)
    setReserveFundsTreatment('pagar_ano')
    setBonuses([])
    setDeductions([])
    setOvertime50Hours(0)
    setOvertime100Hours(0)
    setNotes('')
  }

  const handlePrint = () => {
    printRoleSimulationDocument({
      organization: currentOrg,
      organizationName: currentOrg?.name || 'RH Garden',
      candidateName,
      position,
      department,
      contractType,
      baseSalary: Number(baseSalary) || 0,
      sbu: Number(sbu) || ECUADOR_SBU_DEFAULT,
      bonuses,
      customDeductions: deductions,
      totalCustomDeductions: calculations.totalCustomDeductions,
      totalDeductions: calculations.totalDeductions,
      overtime50Hours: Number(overtime50Hours) || 0,
      overtime50Amount: calculations.overtime50Amount,
      overtime100Hours: Number(overtime100Hours) || 0,
      overtime100Amount: calculations.overtime100Amount,
      totalOvertimeAmount: calculations.totalOvertimeAmount,
      monthlyThirteenth,
      thirteenthAmount: calculations.thirteenthAmount,
      monthlyFourteenth,
      fourteenthAmount: calculations.fourteenthAmount,
      reserveFundsTreatment,
      reserveFundsAmount: calculations.reserveFundsAmount,
      totalSocialBenefits: calculations.totalSocialBenefits,
      taxableIncome: calculations.taxableIncome,
      totalIncome: calculations.totalIncome,
      iessPersonal: calculations.iessPersonal,
      iessPersonalRate: IESS_PERSONAL_RATE,
      netToReceive: calculations.netToReceive,
      iessEmployer: calculations.iessEmployer,
      iessEmployerRate: IESS_EMPLOYER_RATE,
      totalCompanyCost: calculations.totalCompanyCost,
      notes,
    })
  }

  return (
    <>
      <PageHeader
        title="Simulador de Rol"
        description="Calcula cuánto percibirá un nuevo colaborador y el costo para la empresa antes de contratar, sin guardar registros."
        breadcrumbs={[
          { label: 'Nómina', href: '/payroll' },
          { label: 'Simulador' },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="cursor-pointer text-xs h-9 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Limpiar</span>
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="cursor-pointer text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Simulación</span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: Formulario de Configuración (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Bloque 1: Perfil de la Posición */}
          <div className="p-5 rounded-xl border bg-card shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              1. Datos de la Vacante / Candidato
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Nombre Tentativo del Candidato
                </label>
                <Input
                  placeholder="Ej. Juan Pérez (o Vacante 1)"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Cargo / Puesto Propuesto
                </label>
                <Input
                  placeholder="Ej. Asistente Administrativo"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Departamento / Área
                </label>
                <Input
                  placeholder="Ej. Operaciones, Ventas, TI"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Tipo de Contrato
                </label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bloque 2: Sueldo Base y SBU */}
          <div className="p-5 rounded-xl border bg-card shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              2. Remuneración Base y Parámetros
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Sueldo Base Nominal ($)</span>
                  <span className="text-[10px] text-muted-foreground font-mono font-normal">
                    Mín. legal: ${sbu.toFixed(2)}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-muted-foreground font-mono font-medium">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={baseSalary || ''}
                    onChange={(e) => setBaseSalary(parseFloat(e.target.value) || 0)}
                    className="h-9 pl-7 text-xs font-mono font-bold"
                  />
                </div>
                <div className="flex gap-1 pt-1">
                  {[482, 550, 600, 800, 1000, 1200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBaseSalary(preset)}
                      className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors cursor-pointer"
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>SBU Vigente Ecuador ($)</span>
                  <span className="text-[10px] text-muted-foreground font-mono font-normal">
                    Base 14to
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-muted-foreground font-mono font-medium">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    value={sbu || ''}
                    onChange={(e) => setSbu(parseFloat(e.target.value) || ECUADOR_SBU_DEFAULT)}
                    className="h-9 pl-7 text-xs font-mono"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground pt-1">
                  Referencia oficial del Ministerio del Trabajo para el cálculo del 14to sueldo.
                </p>
              </div>
            </div>
          </div>

          {/* Bloque 3: Tratamiento de Décimos y Fondos de Reserva */}
          <div className="p-5 rounded-xl border bg-card shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              3. Opciones de Mensualización (Ecuador)
            </h3>

            <div className="space-y-4">
              {/* 13er Sueldo */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    13er Sueldo (Bono Navideño)
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    1/12 de todos los ingresos del mes ({monthlyThirteenth ? 'Se paga mensualmente en el rol' : 'Se acumula para pago en Diciembre'})
                  </p>
                </div>
                <div className="flex items-center bg-muted p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMonthlyThirteenth(true)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                      monthlyThirteenth ? 'bg-background text-foreground shadow-2xs font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    Mensualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthlyThirteenth(false)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                      !monthlyThirteenth ? 'bg-background text-foreground shadow-2xs font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    Acumular
                  </button>
                </div>
              </div>

              {/* 14to Sueldo */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    14to Sueldo (Bono Escolar)
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    1/12 de 1 SBU ({monthlyFourteenth ? 'Se paga mensualmente en el rol' : 'Se acumula para pago en Marzo/Agosto'})
                  </p>
                </div>
                <div className="flex items-center bg-muted p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMonthlyFourteenth(true)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                      monthlyFourteenth ? 'bg-background text-foreground shadow-2xs font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    Mensualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthlyFourteenth(false)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                      !monthlyFourteenth ? 'bg-background text-foreground shadow-2xs font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    Acumular
                  </button>
                </div>
              </div>

              {/* Fondos de Reserva */}
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Fondos de Reserva (8.33%)
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Por ley se devengan a partir del segundo año continuo de labores, salvo acuerdo de pago desde el ingreso.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReserveFundsTreatment('pagar_ano')}
                    className={`p-2.5 text-left rounded-lg border text-xs transition-all cursor-pointer ${
                      reserveFundsTreatment === 'pagar_ano'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-semibold'
                        : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className="font-semibold text-foreground text-xs">A partir del 2do año</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Estándar Código de Trabajo ($0 en 1er año)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReserveFundsTreatment('pagar_ingreso')}
                    className={`p-2.5 text-left rounded-lg border text-xs transition-all cursor-pointer ${
                      reserveFundsTreatment === 'pagar_ingreso'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-semibold'
                        : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className="font-semibold text-foreground text-xs">Pagar desde 1er mes</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Mensualizar inmediatamente en rol</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReserveFundsTreatment('acumular')}
                    className={`p-2.5 text-left rounded-lg border text-xs transition-all cursor-pointer ${
                      reserveFundsTreatment === 'acumular'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-semibold'
                        : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className="font-semibold text-foreground text-xs">Acumular en IESS</div>
                    <div className="text-[10px] opacity-80 mt-0.5">No se liquida en efectivo en rol</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bloque 4: Bonificaciones y Horas Extras */}
          <div className="p-5 rounded-xl border bg-card shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              4. Bonificaciones y Horas Extras Estimadas
            </h3>

            {/* Bonificaciones dinámicas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">
                  Bonificaciones Adicionales
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => addBonus('Productividad', 50)}
                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground cursor-pointer font-medium"
                  >
                    + Prod ($50)
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addBonus('Bono de desempeño', 50)}
                    className="cursor-pointer text-[11px] h-7 gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Añadir Bono</span>
                  </Button>
                </div>
              </div>

              {bonuses.length === 0 ? (
                <div className="p-3 text-center border rounded-lg border-dashed text-xs text-muted-foreground">
                  Sin bonificaciones adicionales configuradas.
                </div>
              ) : (
                <div className="space-y-2">
                  {bonuses.map((b) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <Input
                        placeholder="Motivo del bono (ej. Productividad)"
                        value={b.name}
                        onChange={(e) => updateBonus(b.id, 'name', e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                      <div className="relative w-32 shrink-0">
                        <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground font-mono">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={b.amount || ''}
                          onChange={(e) => updateBonus(b.id, 'amount', parseFloat(e.target.value) || 0)}
                          className="h-8 pl-6 text-xs font-mono font-semibold"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBonus(b.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Horas extras */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Horas Suplementarias (50%)</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Valor/h: ${(calculations.normalHourlyRate * 1.5).toFixed(2)}
                  </span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={overtime50Hours || ''}
                  onChange={(e) => setOvertime50Hours(parseFloat(e.target.value) || 0)}
                  placeholder="0 hrs"
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground block font-mono">
                  Monto estimado: ${calculations.overtime50Amount.toFixed(2)}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Horas Extraordinarias (100%)</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Valor/h: ${(calculations.normalHourlyRate * 2.0).toFixed(2)}
                  </span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={overtime100Hours || ''}
                  onChange={(e) => setOvertime100Hours(parseFloat(e.target.value) || 0)}
                  placeholder="0 hrs"
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground block font-mono">
                  Monto estimado: ${calculations.overtime100Amount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Bloque 5: Descuentos Proyectados (Alimentación, Vivienda, Préstamos) */}
          <div className="p-5 rounded-xl border bg-card shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                5. Descuentos Previstos
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => addDeduction('Alimentación', 45)}
                  className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground cursor-pointer font-medium flex items-center gap-1"
                >
                  <Utensils className="h-3 w-3 text-rose-500" />
                  + Alimentación
                </button>
                <button
                  type="button"
                  onClick={() => addDeduction('Vivienda / Residencia', 100)}
                  className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground cursor-pointer font-medium flex items-center gap-1"
                >
                  <Home className="h-3 w-3 text-rose-500" />
                  + Vivienda
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addDeduction('Descuento acordado', 30)}
                  className="cursor-pointer text-[11px] h-7 gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Añadir</span>
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Descuentos mensuales autorizados que se deducirán directamente de la liquidación del empleado (consumos de comedor, arriendo corporativo, suministros, etc.).
            </p>

            {deductions.length === 0 ? (
              <div className="p-3 text-center border rounded-lg border-dashed text-xs text-muted-foreground">
                Sin descuentos de alimentación, vivienda u otros configurados.
              </div>
            ) : (
              <div className="space-y-2">
                {deductions.map((d) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <Input
                      placeholder="Motivo del descuento (ej. Alimentación, Vivienda)"
                      value={d.name}
                      onChange={(e) => updateDeduction(d.id, 'name', e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    <div className="relative w-32 shrink-0">
                      <span className="absolute left-2.5 top-1.5 text-xs text-rose-500 font-mono">-$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.amount || ''}
                        onChange={(e) => updateDeduction(d.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="h-8 pl-6 text-xs font-mono font-semibold text-rose-600 dark:text-rose-400"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDeduction(d.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Observaciones */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-medium text-foreground">
                Notas u Observaciones (saldrán impresas en el rol)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Propuesta salarial con descuento acordado por vivienda corporativa y servicio de comedor..."
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Resultados en Tiempo Real y Resumen Ejecutivo (5 cols) */}
        <div className="lg:col-span-5 space-y-5 sticky top-4">
          {/* Tarjeta Principal: Neto a percibir */}
          <div className="p-6 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-card shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                Líquido Estimado a Percibir
              </span>
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-mono text-xs px-2.5">
                Empleado
              </Badge>
            </div>

            <div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground tracking-tight">
                ${calculations.netToReceive.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Remuneración líquida mensual que el colaborador recibirá en su cuenta tras deducciones.
              </p>
            </div>
          </div>

          {/* Desglose Monetario del Rol */}
          <div className="p-5 rounded-xl border bg-card shadow-2xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Calculator className="h-3.5 w-3.5 text-primary" />
              Desglose de Ingresos y Deducciones
            </h4>

            <div className="space-y-2 text-xs">
              {/* Sueldo base */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sueldo Base Nominal</span>
                <span className="font-mono font-medium">${(Number(baseSalary) || 0).toFixed(2)}</span>
              </div>

              {/* Bonos si hay */}
              {calculations.totalBonuses > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bonificaciones Totales</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    +${calculations.totalBonuses.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Horas extras si hay */}
              {calculations.totalOvertimeAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Horas Extras ({Number(overtime50Hours) + Number(overtime100Hours)} hrs)</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    +${calculations.totalOvertimeAmount.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Subtotal Imponible */}
              <div className="flex items-center justify-between font-medium bg-muted/30 px-2 py-1.5 rounded">
                <span className="text-foreground">Total Ingreso Imponible (IESS)</span>
                <span className="font-mono font-semibold text-foreground">
                  ${calculations.taxableIncome.toFixed(2)}
                </span>
              </div>

              {/* Beneficios de ley */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    13er Sueldo (Navideño)
                    {!monthlyThirteenth && <Badge variant="secondary" className="text-[9px] h-4">Acumula</Badge>}
                  </span>
                  <span className="font-mono">
                    {monthlyThirteenth ? `+$${calculations.thirteenthAmount.toFixed(2)}` : '$0.00'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    14to Sueldo (Escolar)
                    {!monthlyFourteenth && <Badge variant="secondary" className="text-[9px] h-4">Acumula</Badge>}
                  </span>
                  <span className="font-mono">
                    {monthlyFourteenth ? `+$${calculations.fourteenthAmount.toFixed(2)}` : '$0.00'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Fondos de Reserva (8.33%)
                    {reserveFundsTreatment === 'pagar_ano' && (
                      <span className="text-[10px] text-muted-foreground">(2do año)</span>
                    )}
                    {reserveFundsTreatment === 'acumular' && (
                      <Badge variant="secondary" className="text-[9px] h-4">Acumula</Badge>
                    )}
                  </span>
                  <span className="font-mono">
                    {calculations.reserveFundsAmount > 0 ? `+$${calculations.reserveFundsAmount.toFixed(2)}` : '$0.00'}
                  </span>
                </div>
              </div>

              {/* Total Bruto */}
              <div className="flex items-center justify-between pt-1 font-semibold">
                <span>Total Ingresos en Rol</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  ${calculations.totalIncome.toFixed(2)}
                </span>
              </div>

              {/* Deducción IESS */}
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-medium">
                <span>Aporte Personal IESS (9.45%)</span>
                <span className="font-mono">
                  -${calculations.iessPersonal.toFixed(2)}
                </span>
              </div>

              {/* Deducciones internas si hay */}
              {deductions.length > 0 && (
                <div className="space-y-1.5">
                  {deductions.map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                      <span>• Desc: {d.name || 'Descuento interno'}</span>
                      <span className="font-mono">-${(Number(d.amount) || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Total Deducciones consolidadas */}
              <div className="flex items-center justify-between font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/5 px-2 py-1.5 rounded">
                <span>Total Deducciones</span>
                <span className="font-mono">
                  -${calculations.totalDeductions.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta Costo Total para la Empresa */}
          <div className="p-5 rounded-xl border bg-card shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                Costo Total Empresa
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                Empleador
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold font-mono text-foreground">
                ${calculations.totalCompanyCost.toFixed(2)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Presupuesto mensual integral que la empresa debe reservar por esta contratación.
              </p>
            </div>

            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Aporte Patronal IESS (12.15%)</span>
                <span className="font-mono text-foreground font-medium">
                  ${calculations.iessEmployer.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Provisiones completas de ley (13°, 14°)</span>
                <span className="font-mono text-foreground font-medium">
                  ${(Number((calculations.taxableIncome / 12) + (sbu / 12))).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
  )
}
