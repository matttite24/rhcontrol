import { getCurrentOrganization } from '@/lib/org/server'
import { NoActiveOrg } from '@/components/org/NoActiveOrg'
import {
  ComplianceSearchProvider,
  ComplianceHero,
  ComplianceResults,
} from '@/components/compliance/ComplianceView'

export default async function CompliancePage() {
  const currentOrg = await getCurrentOrganization()

  if (!currentOrg) {
    return (
      <NoActiveOrg action="ver la información de cumplimiento" />
    )
  }

  return (
    <ComplianceSearchProvider>
      <div className="flex flex-col flex-1 min-h-screen">
        <ComplianceHero />
        <ComplianceResults currentOrgId={currentOrg.id} />
      </div>
    </ComplianceSearchProvider>
  )
}
