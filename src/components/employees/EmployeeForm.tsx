'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Employee, EmployeeInsert, Department, Position, EmployeeSalary, SalaryType, EmployeeSchedule, EmployeeDocument, RotatingShiftPattern, EmployeeRotatingSchedule } from '@/types/employee'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getEmployeeCompleteness, completenessTone, type EmployeeTabKey, type EmployeeCompleteness } from '@/lib/employees/completeness'
// Cada tab se descarga solo cuando el usuario lo abre (chunk propio), en vez de
// sumar el JS de los 5 tabs al bundle inicial de la ficha — la mayoría de las
// visitas solo ven el tab "General" y nunca llegan a los otros 4.
import { getDefaultSchedules, ScheduleDayItem } from './EmployeeScheduleForm'
import { EmployeeRotatingScheduleForm, RotatingScheduleValue } from './EmployeeRotatingScheduleForm'
import { toast } from '@/components/ui/toast'
import { UserCheck, Building2, DollarSign, Clock, FileCheck2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabSkeleton = (
  <div className="flex items-center justify-center py-16 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin" />
  </div>
)

// Antes definido dentro de EmployeeForm: un componente redefinido en cada
// render es un tipo distinto para React en cada pasada, así que remonta (en
// vez de re-renderizar) su contenido cada vez — pierde cualquier estado local
// que tuviera y es más costoso de lo necesario. Ahora vive a nivel de módulo
// y recibe `completeness` como prop en vez de leerlo por closure.
function TabPercentBadge({
  tab,
  completeness,
}: {
  tab: EmployeeTabKey
  completeness: EmployeeCompleteness
}) {
  const t = completeness.tabs[tab]
  const tone = completenessTone(t.percent)
  return (
    <span
      title={t.missing.length ? `Falta: ${t.missing.join(', ')}` : 'Completo'}
      className={cn(
        'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums',
        tone === 'complete' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        tone === 'partial' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        tone === 'low' && 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
      )}
    >
      {t.percent}%
    </span>
  )
}

const EmployeeGeneralTab = dynamic(
  () => import('./EmployeeGeneralTab').then((m) => m.EmployeeGeneralTab),
  { loading: () => tabSkeleton }
)
const EmployeeCompanyTab = dynamic(
  () => import('./EmployeeCompanyTab').then((m) => m.EmployeeCompanyTab),
  { loading: () => tabSkeleton }
)
const EmployeeSalaryTab = dynamic(
  () => import('./EmployeeSalaryTab').then((m) => m.EmployeeSalaryTab),
  { loading: () => tabSkeleton }
)
const EmployeeScheduleForm = dynamic(
  () => import('./EmployeeScheduleForm').then((m) => m.EmployeeScheduleForm),
  { loading: () => tabSkeleton }
)
const EmployeeDocumentsTab = dynamic(
  () => import('./EmployeeDocumentsTab').then((m) => m.EmployeeDocumentsTab),
  { loading: () => tabSkeleton }
)

export interface SalaryRowItem {
  id?: string
  salary_type: SalaryType
  name: string
  amount: number
  affects_iess: boolean
}

interface EmployeeFormProps {
  currentOrgId: string
  employee?: Employee
  departments?: Department[]
  positions?: Position[]
  initialSalaries?: EmployeeSalary[]
  initialSchedules?: EmployeeSchedule[]
  initialDocuments?: EmployeeDocument[]
  rotatingPatterns?: RotatingShiftPattern[]
  initialRotatingSchedule?: EmployeeRotatingSchedule | null
  readOnly?: boolean
  defaultTab?: string
}

export function EmployeeForm({
  currentOrgId,
  employee,
  departments = [],
  positions = [],
  initialSalaries = [],
  initialSchedules = [],
  initialDocuments = [],
  rotatingPatterns: initialRotatingPatterns = [],
  initialRotatingSchedule = null,
  readOnly = false,
  defaultTab,
}: EmployeeFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const urlTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<string>(urlTab || defaultTab || 'general')
  const [invalidFields, setInvalidFields] = useState<string[]>([])

  function handleTabChange(tabVal: string) {
    setActiveTab(tabVal)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tabVal)
    window.history.replaceState(null, '', `?${params.toString()}`)
  }

  // Estado para cálculo de edad en tiempo real y forma de pago
  const [fullName, setFullName] = useState<string>(employee?.full_name ?? '')
  const [nationalId, setNationalId] = useState<string>(employee?.national_id ?? '')
  const [email, setEmail] = useState<string>(employee?.email ?? '')
  const [status, setStatus] = useState<string>(employee?.status ?? 'activo')

  const [birthDate, setBirthDate] = useState<string>(employee?.birth_date ?? '')
  const [reserveFunds, setReserveFunds] = useState<string>(employee?.reserve_funds ?? 'pagar_ano')
  const [paymentType, setPaymentType] = useState<string>(employee?.payment_type ?? 'Transferencia')

  // Estado para Horario Laboral
  const [schedules, setSchedules] = useState<ScheduleDayItem[]>(() =>
    getDefaultSchedules(initialSchedules)
  )

  // Estado para Horario Rotativo (ver EmployeeRotatingScheduleForm): modo
  // alterno al horario semanal fijo de arriba, para turnos tipo "4 libres +
  // 10 trabajo" donde el mismo día de la semana alterna libre/laborable.
  const [scheduleMode, setScheduleMode] = useState<'weekly' | 'rotating'>(
    initialRotatingSchedule ? 'rotating' : 'weekly'
  )
  const [rotatingPatterns, setRotatingPatterns] = useState<RotatingShiftPattern[]>(initialRotatingPatterns)
  const [rotatingSchedule, setRotatingSchedule] = useState<RotatingScheduleValue>({
    patternId: initialRotatingSchedule?.pattern_id ?? null,
    anchorDate: initialRotatingSchedule?.anchor_date ?? new Date().toISOString().slice(0, 10),
  })

  // Estado para Conceptos Salariales (Sueldo, Bonificación, Extras)
  const [salaries, setSalaries] = useState<SalaryRowItem[]>(() => {
    if (initialSalaries && initialSalaries.length > 0) {
      return initialSalaries.map((s) => ({
        id: s.id,
        salary_type: s.salary_type,
        name: s.name ?? '',
        amount: Number(s.amount) || 0,
        affects_iess: s.affects_iess ?? true,
      }))
    }
    return [
      {
        salary_type: 'Sueldo',
        name: 'Sueldo Base',
        amount: 460,
        affects_iess: true,
      },
    ]
  })

  // Chequeo de obligatoriedad por pestaña
  const hasGeneralErrors = invalidFields.some((f) => ['full_name', 'national_id', 'email'].includes(f))
  const hasCompanyErrors = invalidFields.some((f) => ['status'].includes(f))

  // % de completitud de la ficha por pestaña (campos relevantes a nómina/legal).
  // Los campos con estado local (nombre, cédula, correo, forma de pago, salarios,
  // horario) se toman "en vivo"; el resto viene del `employee` guardado.
  const completeness = useMemo(
    () =>
      getEmployeeCompleteness(
        {
          ...employee,
          full_name: fullName,
          national_id: nationalId,
          email,
          status: status as Employee['status'],
          birth_date: birthDate,
          payment_type: paymentType,
        },
        salaries,
        schedules,
        initialDocuments
      ),
    [employee, fullName, nationalId, email, status, birthDate, paymentType, salaries, schedules, initialDocuments]
  )

  function addSalaryItem(type: SalaryType = 'Bonificacion') {
    const defaultNames: Record<SalaryType, string> = {
      Sueldo: 'Sueldo Base',
      Bonificacion: 'Bono',
      Extras: 'Horas Extras',
    }
    setSalaries((prev) => [
      ...prev,
      {
        salary_type: type,
        name: defaultNames[type] || 'Concepto',
        amount: 0,
        affects_iess: type === 'Sueldo',
      },
    ])
  }

  function removeSalaryItem(index: number) {
    setSalaries((prev) => prev.filter((_, i) => i !== index))
  }

  function updateSalaryItem<K extends keyof SalaryRowItem>(
    index: number,
    field: K,
    value: SalaryRowItem[K]
  ) {
    setSalaries((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Guard contra doble submit: un doble clic (o Enter + clic) en el botón
    // "Guardar" —que vive fuera de este componente, en el header de la
    // página— disparaba este handler dos veces mientras el primer guardado
    // aún corría, insertando el empleado por duplicado. El botón externo
    // también se deshabilita al recibir el evento 'submit' del form, pero
    // este guard es la garantía real: no depende de que el otro componente
    // reaccione a tiempo.
    if (loading) return
    setLoading(true)

    const form = e.currentTarget
    const data = new FormData(form)

    // Avisa al botón "Guardar" externo (EmployeeFormSubmitButton, que vive
    // fuera de este componente) que ya puede reactivarse.
    const finish = () => {
      setLoading(false)
      form.dispatchEvent(new CustomEvent('employee-form:done'))
    }

    const full_name = (data.get('full_name') as string)?.trim() || fullName.trim()
    const national_id = (data.get('national_id') as string)?.trim() || nationalId.trim()
    const email_val = (data.get('email') as string)?.trim() || email.trim()
    const status_val = (data.get('status') as Employee['status']) || status || 'activo'

    // Validar campos obligatorios requeridos. Correo y teléfono NO son
    // obligatorios: en fase de recolección de datos, exigirlos llevaba a
    // capturar valores inventados solo para poder guardar al empleado.
    const missing: string[] = []
    if (!full_name) missing.push('full_name')
    if (!national_id) missing.push('national_id')
    if (!status_val) missing.push('status')

    if (missing.length > 0) {
      setInvalidFields(missing)
      finish()

      toast.error(
        'Campos obligatorios incompletos',
        'Por favor complete todos los datos requeridos marcados con asterisco (*).'
      )

      // Redirigir a la pestaña que tiene el error si no está activa
      if (missing.some((f) => ['full_name', 'national_id'].includes(f))) {
        setActiveTab('general')
      } else if (missing.includes('status')) {
        setActiveTab('company')
      }
      return
    }

    setInvalidFields([])

    const payload: EmployeeInsert = {
      organization_id: currentOrgId,
      full_name,
      national_id,
      email:            email_val || null,
      phone:            (data.get('phone') as string)?.trim() || null,
      phone_secondary:  (data.get('phone_secondary') as string)?.trim() || null,
      address:          (data.get('address') as string)?.trim() || null,
      province:         (data.get('province') as string)?.trim() || null,
      civil_status:     (data.get('civil_status') as string) || 'Soltero/a',
      position:         (data.get('position') as string) || null,
      department:       (data.get('department') as string) || null,
      hire_date:        (data.get('hire_date') as string) || null,
      termination_date: (data.get('termination_date') as string) || null,
      status:           status_val,
      avatar_url:       employee?.avatar_url ?? null,
      notes:            (data.get('notes') as string)?.trim() || null,

      // Datos Personales
      birth_date:       (data.get('birth_date') as string) || null,
      has_disability:   data.get('has_disability') === 'on',
      gender:           (data.get('gender') as string) || 'Masculino',

      // Datos para la Empresa / Forma de Pago
      contract_type:    (data.get('contract_type') as string) || 'Indefinido',
      payment_type:     paymentType,
      bank_name:        paymentType === 'Transferencia' ? ((data.get('bank_name') as string)?.trim() || null) : null,
      account_type:     paymentType === 'Transferencia' ? ((data.get('account_type') as string) || 'Ahorros') : null,
      account_number:   paymentType === 'Transferencia' ? ((data.get('account_number') as string)?.trim() || null) : null,
      check_issuing_bank: paymentType === 'Cheque' ? ((data.get('check_issuing_bank') as string)?.trim() || null) : null,

      // Configuraciones Generales
      reserve_funds:       reserveFunds,
      accumulate_decimals: data.get('accumulate_decimals') === 'on',
      spouse_extension:    data.get('spouse_extension') === 'on',
      iess_code:           (data.get('iess_code') as string)?.trim() || null,
      personal_charges:    parseInt(data.get('personal_charges') as string, 10) || 0,
      is_owner_manager:    data.get('is_owner_manager') === 'on',
    }

    try {
      let savedEmployeeId = employee?.id

      if (employee) {
        const { error: updateError } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', employee.id)

        if (updateError) throw updateError
      } else {
        const { data: newEmp, error: insertError } = await supabase
          .from('employees')
          .insert(payload)
          .select('id')
          .single()

        if (insertError) throw insertError
        savedEmployeeId = newEmp.id
      }

      // 1. Guardar Conceptos Salariales
      if (savedEmployeeId) {
        await supabase
          .from('employee_salaries')
          .delete()
          .eq('employee_id', savedEmployeeId)

        if (salaries.length > 0) {
          const salaryPayloads = salaries.map((sal) => ({
            organization_id: currentOrgId,
            employee_id: savedEmployeeId!,
            salary_type: sal.salary_type,
            name: sal.name.trim() || null,
            amount: sal.amount,
            affects_iess: sal.affects_iess,
          }))

          const { error: salaryInsertError } = await supabase
            .from('employee_salaries')
            .insert(salaryPayloads)

          if (salaryInsertError) console.error('Error insertando salarios:', salaryInsertError)
        }

        // 2. Guardar Horario Laboral
        await supabase
          .from('employee_schedules')
          .delete()
          .eq('employee_id', savedEmployeeId)

        if (schedules.length > 0) {
          const schedulePayloads = schedules.map((item) => ({
            organization_id: currentOrgId,
            employee_id: savedEmployeeId!,
            day_of_week: item.day_of_week,
            day_order: item.day_order,
            is_workday: item.is_workday,
            has_split_shift: item.has_split_shift,
            start_time_1: item.is_workday ? (item.start_time_1 || '08:00') : null,
            end_time_1: item.is_workday ? (item.end_time_1 || '17:00') : null,
            start_time_2: (item.is_workday && item.has_split_shift) ? (item.start_time_2 || '14:00') : null,
            end_time_2: (item.is_workday && item.has_split_shift) ? (item.end_time_2 || '18:00') : null,
          }))

          const { error: scheduleInsertError } = await supabase
            .from('employee_schedules')
            .insert(schedulePayloads)

          if (scheduleInsertError) console.error('Error insertando horarios:', scheduleInsertError)
        }

        // 2b. Guardar Horario Rotativo (si el modo activo es 'rotating' y hay
        // un patrón elegido). Se borra la asignación previa primero: si el
        // usuario cambió a modo semanal o quitó el patrón, no debe quedar un
        // horario rotativo huérfano compitiendo con el semanal.
        await supabase
          .from('employee_rotating_schedules')
          .delete()
          .eq('employee_id', savedEmployeeId)

        if (scheduleMode === 'rotating' && rotatingSchedule.patternId) {
          const { error: rotatingInsertError } = await supabase
            .from('employee_rotating_schedules')
            .insert({
              organization_id: currentOrgId,
              employee_id: savedEmployeeId,
              pattern_id: rotatingSchedule.patternId,
              anchor_date: rotatingSchedule.anchorDate,
            })

          if (rotatingInsertError) console.error('Error insertando horario rotativo:', rotatingInsertError)
        }
      }

      toast.success(
        employee ? 'Empleado actualizado' : 'Empleado registrado',
        `Los datos de ${full_name} se guardaron exitosamente.`
      )

      if (employee) {
        // Al editar: quedarse en la ficha para seguir revisando/ajustando otras
        // pestañas. Se refresca para reflejar los datos guardados (incluido el %
        // de completitud) sin navegar fuera.
        setInvalidFields([])
        router.refresh()
      } else {
        // Al crear un empleado nuevo sí se vuelve a la lista.
        router.push('/employees')
        router.refresh()
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error(
        'Error al guardar',
        (err as { message?: string })?.message || 'Ocurrió un error inesperado al guardar.'
      )
    } finally {
      finish()
    }
  }

  const selectClasses = cn(
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground",
    readOnly ? "opacity-90 bg-muted/30 cursor-default pointer-events-none" : "cursor-pointer"
  )

  return (
    <form id="employee-form" onSubmit={handleSubmit} className="w-full space-y-6">
      <Tabs value={activeTab} onValueChange={(val) => handleTabChange(val as string)} className="w-full space-y-6">
        {/* SUBHEADER DE PESTAÑAS (Navigation Underline Bar con puntos rojos de requerimiento) */}
        <div className="border-b border-border/80 overflow-x-auto no-scrollbar">
          <TabsList variant="line" className="h-10 gap-6">
            <TabsTrigger value="general" className="relative gap-2 text-xs font-semibold cursor-pointer">
              <UserCheck className="h-4 w-4" />
              General
              <TabPercentBadge tab="general" completeness={completeness} />
              {hasGeneralErrors && (
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse ring-2 ring-background" />
              )}
            </TabsTrigger>
            <TabsTrigger value="company" className="relative gap-2 text-xs font-semibold cursor-pointer">
              <Building2 className="h-4 w-4" />
              Empresa
              <TabPercentBadge tab="company" completeness={completeness} />
              {hasCompanyErrors && (
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse ring-2 ring-background" />
              )}
            </TabsTrigger>
            <TabsTrigger value="salary" className="gap-2 text-xs font-semibold cursor-pointer">
              <DollarSign className="h-4 w-4" />
              Salario
              <TabPercentBadge tab="salary" completeness={completeness} />
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2 text-xs font-semibold cursor-pointer">
              <Clock className="h-4 w-4" />
              Horario
              <TabPercentBadge tab="schedule" completeness={completeness} />
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              disabled
              title="Módulo de documentos en construcción"
              className="gap-2 text-xs font-semibold cursor-not-allowed opacity-45"
            >
              <FileCheck2 className="h-4 w-4" />
              Documentos
              <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                Pronto
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* PESTAÑA 1: INFORMACIÓN GENERAL */}
        <TabsContent value="general" keepMounted={!readOnly} className="focus-visible:outline-none">
          <EmployeeGeneralTab
            employee={employee}
            birthDate={birthDate}
            setBirthDate={setBirthDate}
            readOnly={readOnly}
            selectClasses={selectClasses}
            fullName={fullName}
            setFullName={setFullName}
            nationalId={nationalId}
            setNationalId={setNationalId}
            email={email}
            setEmail={setEmail}
            invalidFields={invalidFields}
          />
        </TabsContent>

        {/* PESTAÑA 2: DATOS PARA LA EMPRESA */}
        <TabsContent value="company" keepMounted={!readOnly} className="focus-visible:outline-none">
          <EmployeeCompanyTab
            employee={employee}
            departments={departments}
            positions={positions}
            paymentType={paymentType}
            setPaymentType={setPaymentType}
            reserveFunds={reserveFunds}
            setReserveFunds={setReserveFunds}
            readOnly={readOnly}
            selectClasses={selectClasses}
          />
        </TabsContent>

        {/* PESTAÑA 3: SUELDO Y CONCEPTOS SALARIALES */}
        <TabsContent value="salary" keepMounted={!readOnly} className="focus-visible:outline-none">
          <EmployeeSalaryTab
            salaries={salaries}
            addSalaryItem={addSalaryItem}
            removeSalaryItem={removeSalaryItem}
            updateSalaryItem={updateSalaryItem}
            readOnly={readOnly}
            selectClasses={selectClasses}
          />
        </TabsContent>

        {/* PESTAÑA 4: HORARIO LABORAL */}
        <TabsContent value="schedule" keepMounted={!readOnly} className="focus-visible:outline-none space-y-4">
          {/* Selector Semanal Fijo vs. Rotativo por Ciclo */}
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border text-xs w-fit">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setScheduleMode('weekly')}
              className={cn(
                "px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer",
                scheduleMode === 'weekly' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semanal Fijo
            </button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setScheduleMode('rotating')}
              className={cn(
                "px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer",
                scheduleMode === 'rotating' ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Rotativo por Ciclo
            </button>
          </div>

          {scheduleMode === 'weekly' ? (
            <EmployeeScheduleForm
              schedules={schedules}
              onChange={(newSchedules) => setSchedules(newSchedules)}
              readOnly={readOnly}
            />
          ) : (
            <>
              <EmployeeRotatingScheduleForm
                organizationId={currentOrgId}
                patterns={rotatingPatterns}
                value={rotatingSchedule}
                onChange={setRotatingSchedule}
                onPatternsChange={setRotatingPatterns}
                readOnly={readOnly}
              />
              {/* El horario base (horas de entrada/salida) sigue viviendo aquí
                  debajo: el rotativo solo decide qué días son libres. */}
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Horario base (horas de los días laborables del ciclo)
                </p>
                <EmployeeScheduleForm
                  schedules={schedules}
                  onChange={(newSchedules) => setSchedules(newSchedules)}
                  readOnly={readOnly}
                />
              </div>
            </>
          )}
        </TabsContent>

        {/* PESTAÑA 5: DOCUMENTACIÓN & EXPEDIENTE DE INGRESO */}
        <TabsContent value="documents" keepMounted={!readOnly} className="focus-visible:outline-none">
          <EmployeeDocumentsTab
            employee={employee}
            readOnly={readOnly}
          />
        </TabsContent>
      </Tabs>
    </form>
  )
}
