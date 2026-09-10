'use client'

import { createContext, useContext, useState } from 'react'

interface ComplianceSearchContextValue {
  query: string
  setQuery: (q: string) => void
}

// Estado de búsqueda compartido entre el buscador (en el hero) y los
// resultados (debajo) sin pasar por la URL: el filtrado es puramente local,
// sobre datos estáticos que no vienen de la base de datos.
const ComplianceSearchContext = createContext<ComplianceSearchContextValue | null>(null)

export function ComplianceSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  return (
    <ComplianceSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </ComplianceSearchContext.Provider>
  )
}

export function useComplianceSearch() {
  const ctx = useContext(ComplianceSearchContext)
  if (!ctx) throw new Error('useComplianceSearch debe usarse dentro de ComplianceSearchProvider')
  return ctx
}
