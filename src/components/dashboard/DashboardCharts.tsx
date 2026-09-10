'use client'

import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts'

interface DepartmentData {
  name: string
  count: number
}

interface ContractData {
  name: string
  value: number
  color: string
}

interface DashboardChartsProps {
  departmentData: DepartmentData[]
  contractData: ContractData[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

export function DashboardCharts({
  departmentData,
  contractData,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Gráfico 1: Distribución de Personal por Departamento */}
      <div className="lg:col-span-7 rounded-xl border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Empleados por Departamento
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Distribución de la nómina por área operativa y administrativa
            </p>
          </div>
        </div>

        <div className="h-60 w-full pt-2">
          {departmentData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground"
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-1.5 shadow-md text-xs font-mono">
                          <span className="font-semibold text-foreground">{payload[0].payload.name}: </span>
                          <span className="font-bold text-primary">{payload[0].value} empleados</span>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {departmentData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
              Sin departamentos registrados aún.
            </div>
          )}
        </div>
      </div>

      {/* Gráfico 2: Modalidad de Contratación */}
      <div className="lg:col-span-5 rounded-xl border bg-card p-5 space-y-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Modalidad de Contratos
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Proporción de personal indefinido, eventual y por obra
            </p>
          </div>
        </div>

        <div className="h-44 w-full relative flex items-center justify-center">
          {contractData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-popover px-3 py-1.5 shadow-md text-xs font-mono">
                          <span className="font-semibold text-foreground">{payload[0].name}: </span>
                          <span className="font-bold text-primary">{payload[0].value} empleados</span>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Pie
                  data={contractData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={68}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {contractData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              Sin empleados registrados.
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-[11px]">
          {contractData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground truncate">{item.name}:</span>
              <span className="font-mono font-bold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
