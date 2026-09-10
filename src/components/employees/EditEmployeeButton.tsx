'use client'

import React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditEmployeeButtonProps {
  employeeId: string
}

export function EditEmployeeButton({ employeeId }: EditEmployeeButtonProps) {
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab')

  const editHref = currentTab 
    ? `/employees/${employeeId}/edit?tab=${currentTab}` 
    : `/employees/${employeeId}/edit`

  return (
    <Link 
      href={editHref} 
      className={cn(buttonVariants({ size: 'sm' }))}
    >
      <Pencil className="h-3.5 w-3.5 mr-1.5" />
      Editar Empleado
    </Link>
  )
}
