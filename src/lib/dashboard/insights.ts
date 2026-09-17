import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Employee } from '@/types/employee'

export type ProbationRow = Pick<Employee, 'id' | 'full_name' | 'avatar_url' | 'department' | 'position' | 'hire_date'> & { days_since_hire: number }
export type BirthdayRow = Pick<Employee, 'id' | 'full_name' | 'avatar_url' | 'department' | 'position' | 'birth_date'>
export type AnniversaryRow = Pick<Employee, 'id' | 'full_name' | 'avatar_url' | 'department' | 'hire_date'> & { years: number }

export interface DashboardInsights {
  active_count: number
  probation: ProbationRow[]
  birthdays: BirthdayRow[]
  anniversaries: AnniversaryRow[]
}

/**
 * `cache()` deduplica el RPC dentro del mismo request: DashboardMetricsRow,
 * ProbationCard y BirthdaysCard/AnniversariesCard corren en Suspense
 * independientes pero todos necesitan el mismo get_dashboard_employee_insights
 * — sin cache() cada uno dispararía su propia llamada idéntica.
 */
export const getDashboardInsights = cache(async (orgId: string): Promise<DashboardInsights> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_dashboard_employee_insights', { org_id: orgId })
  return {
    active_count: data?.active_count ?? 0,
    probation: data?.probation ?? [],
    birthdays: data?.birthdays ?? [],
    anniversaries: data?.anniversaries ?? [],
  }
})
