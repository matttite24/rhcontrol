'use client'

import { useMemo } from 'react'
import { getActiveSbu } from '@/lib/payroll/ecuador'
import { ECUADOR_COMPLIANCE_NOTICES } from '@/lib/compliance/notices'
import { useComplianceSearch } from '@/components/compliance/ComplianceSearchContext'
import { ComplianceCalendarSection } from '@/components/compliance/ComplianceCalendarSection'
import { ComplianceGuideSection, GUIDE_ITEM_KEYWORDS, type GuideVisibility } from '@/components/compliance/ComplianceGuideSection'

export { ComplianceSearchProvider } from '@/components/compliance/ComplianceSearchContext'
export { ComplianceHero } from '@/components/compliance/ComplianceHero'

interface ComplianceResultsProps {
  currentOrgId: string
}

/**
 * Cuerpo de la página de Cumplimiento: filtra el Calendario de Obligaciones
 * y la Guía de Parámetros según el buscador (contexto compartido con el
 * hero) y compone ambas secciones, en ese orden.
 */
export function ComplianceResults({ currentOrgId }: ComplianceResultsProps) {
  const { query } = useComplianceSearch()
  const sbu = useMemo(() => getActiveSbu(currentOrgId), [currentOrgId])

  const normalizedQuery = query.trim().toLowerCase()
  const matches = (text: string) =>
    !normalizedQuery || text.toLowerCase().includes(normalizedQuery)

  const filteredNotices = useMemo(() => {
    if (!normalizedQuery) return ECUADOR_COMPLIANCE_NOTICES
    return ECUADOR_COMPLIANCE_NOTICES.filter((notice) =>
      matches(`${notice.title} ${notice.description} ${notice.authority} ${notice.frequency}`)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQuery])

  const guideVisibility = useMemo<GuideVisibility>(() => {
    if (!normalizedQuery) {
      return { decimo_tercero: true, decimo_cuarto: true, fondos_reserva: true, aportes_iess: true, horas_extras: true }
    }
    return Object.fromEntries(
      Object.entries(GUIDE_ITEM_KEYWORDS).map(([key, keywords]) => [key, matches(keywords)])
    ) as GuideVisibility
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQuery])

  const anyGuideVisible = Object.values(guideVisibility).some(Boolean)
  const hasResults = anyGuideVisible || filteredNotices.length > 0

  return (
    <div className="space-y-10 w-full px-6 md:px-8 pb-10">
      {!hasResults && (
        <div className="p-10 text-center text-sm text-muted-foreground italic border rounded-2xl bg-muted/20">
          Sin resultados para &quot;{query}&quot;.
        </div>
      )}

      <ComplianceCalendarSection notices={filteredNotices} />
      <ComplianceGuideSection sbu={sbu} visibility={guideVisibility} />
    </div>
  )
}
