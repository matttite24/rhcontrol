import { AppSidebar } from '@/components/layout/AppSidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { getCurrentOrganization, getUserOrganizations } from '@/lib/org/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [currentOrg, organizations] = await Promise.all([
    getCurrentOrganization(),
    getUserOrganizations(),
  ])

  return (
    <SidebarProvider>
      <AppSidebar currentOrg={currentOrg} organizations={organizations} />
      <SidebarInset className="flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
