'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sparkles, Image as ImageIcon } from 'lucide-react'
import { BirthdayNoticeModal } from './BirthdayNoticeModal'
import { Button } from '@/components/ui/button'

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

interface BirthdayActionItemProps {
  employee: {
    id: string
    full_name: string
    avatar_url: string | null
    department: string | null
    position: string | null
    birth_date: string | null
  }
  isTodayBday: boolean
  day: number
  currentMonthName: string
  orgName: string
  logoUrl?: string | null
}

export function BirthdayActionItem({
  employee,
  isTodayBday,
  day,
  currentMonthName,
  orgName,
  logoUrl,
}: BirthdayActionItemProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          "group flex items-center justify-between p-2.5 rounded-xl transition-colors text-xs relative",
          isTodayBday
            ? "bg-rose-500/10 font-semibold"
            : "hover:bg-muted/40"
        )}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
            <AvatarImage src={employee.avatar_url ?? undefined} alt={employee.full_name} />
            <AvatarFallback className="text-[10px] font-semibold">
              {getInitials(employee.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground truncate max-w-[150px]">
              {employee.full_name}
            </span>
            <span className="text-[11px] text-muted-foreground truncate max-w-[150px]">
              {employee.position || employee.department || 'Empleado'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-600 hover:bg-rose-50"
            onClick={() => setModalOpen(true)}
            title="Generar post de felicitación"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          
          <div className="text-right shrink-0">
            {isTodayBday ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                <Sparkles className="h-3 w-3" />
                ¡Hoy!
              </span>
            ) : (
              <span className="font-mono text-xs text-muted-foreground font-semibold">
                {day} de {currentMonthName}
              </span>
            )}
          </div>
        </div>
      </div>

      <BirthdayNoticeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        orgName={orgName}
        logoUrl={logoUrl}
        employeeName={employee.full_name}
        birthDate={employee.birth_date ?? ''}
      />
    </>
  )
}
