'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, UserMinus } from 'lucide-react'
import { NewSettlementModal } from './NewSettlementModal'
import { Employee, EmployeeSalary } from '@/types/employee'

interface NewSettlementButtonProps {
  organizationId: string
  employees: (Employee & { salaries?: EmployeeSalary[] })[]
}

export function NewSettlementButton({
  organizationId,
  employees,
}: NewSettlementButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        className="gap-2 font-medium cursor-pointer"
        size="sm"
      >
        <UserMinus className="h-4 w-4" />
        Liquidar Empleado
      </Button>

      <NewSettlementModal
        organizationId={organizationId}
        employees={employees}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
