'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Department, Position } from '@/types/employee'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, Loader2, Building2, Briefcase, Pencil, Check, X } from 'lucide-react'

interface SettingsManagerProps {
  currentOrgId: string
  departments: Department[]
  positions: Position[]
}

export function SettingsManager({
  currentOrgId,
  departments: initialDepartments,
  positions: initialPositions,
}: SettingsManagerProps) {
  const router = useRouter()
  const supabase = createClient()

  const [departments, setDepartments] = useState<Department[]>(initialDepartments)
  const [positions, setPositions] = useState<Position[]>(initialPositions)

  // Estados de formularios
  const [deptName, setDeptName] = useState('')
  const [deptDesc, setDeptDesc] = useState('')
  const [deptLoading, setDeptLoading] = useState(false)
  const [deptError, setDeptError] = useState<string | null>(null)

  const [posName, setPosName] = useState('')
  const [posDesc, setPosDesc] = useState('')
  const [posLoading, setPosLoading] = useState(false)
  const [posError, setPosError] = useState<string | null>(null)

  // Edición inline de un departamento o cargo existente
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null)
  const [editDeptName, setEditDeptName] = useState('')
  const [editDeptDesc, setEditDeptDesc] = useState('')
  const [editDeptLoading, setEditDeptLoading] = useState(false)

  const [editingPosId, setEditingPosId] = useState<string | null>(null)
  const [editPosName, setEditPosName] = useState('')
  const [editPosDesc, setEditPosDesc] = useState('')
  const [editPosLoading, setEditPosLoading] = useState(false)

  // Crear Departamento
  async function handleAddDepartment(e: React.FormEvent) {
    e.preventDefault()
    if (!deptName.trim()) return
    setDeptLoading(true)
    setDeptError(null)

    const { data, error } = await supabase
      .from('departments')
      .insert({ 
        organization_id: currentOrgId,
        name: deptName.trim(), 
        description: deptDesc.trim() || null 
      })
      .select()
      .single()

    if (error) {
      setDeptError(error.message)
      setDeptLoading(false)
      return
    }

    setDepartments((prev) => [...prev, data as Department].sort((a, b) => a.name.localeCompare(b.name)))
    setDeptName('')
    setDeptDesc('')
    setDeptLoading(false)
    router.refresh()
  }

  // Editar Departamento (nombre y/o descripción)
  function startEditDepartment(dept: Department) {
    setEditingDeptId(dept.id)
    setEditDeptName(dept.name)
    setEditDeptDesc(dept.description ?? '')
  }

  function cancelEditDepartment() {
    setEditingDeptId(null)
    setEditDeptName('')
    setEditDeptDesc('')
  }

  async function handleSaveDepartment(id: string) {
    if (!editDeptName.trim()) return
    setEditDeptLoading(true)

    const { data, error } = await supabase
      .from('departments')
      .update({
        name: editDeptName.trim(),
        description: editDeptDesc.trim() || null,
      })
      .eq('id', id)
      .eq('organization_id', currentOrgId)
      .select()
      .single()

    if (error) {
      alert('Error al guardar: ' + error.message)
      setEditDeptLoading(false)
      return
    }

    setDepartments((prev) =>
      prev
        .map((d) => (d.id === id ? (data as Department) : d))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
    setEditDeptLoading(false)
    cancelEditDepartment()
    router.refresh()
  }

  // Eliminar Departamento
  async function handleDeleteDepartment(id: string) {
    if (!confirm('¿Estás seguro de eliminar este departamento?')) return
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id)
      .eq('organization_id', currentOrgId)

    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }
    setDepartments((prev) => prev.filter((d) => d.id !== id))
    router.refresh()
  }

  // Crear Cargo
  async function handleAddPosition(e: React.FormEvent) {
    e.preventDefault()
    if (!posName.trim()) return
    setPosLoading(true)
    setPosError(null)

    const { data, error } = await supabase
      .from('positions')
      .insert({ 
        organization_id: currentOrgId,
        name: posName.trim(), 
        description: posDesc.trim() || null 
      })
      .select()
      .single()

    if (error) {
      setPosError(error.message)
      setPosLoading(false)
      return
    }

    setPositions((prev) => [...prev, data as Position].sort((a, b) => a.name.localeCompare(b.name)))
    setPosName('')
    setPosDesc('')
    setPosLoading(false)
    router.refresh()
  }

  // Editar Cargo (nombre y/o descripción)
  function startEditPosition(pos: Position) {
    setEditingPosId(pos.id)
    setEditPosName(pos.name)
    setEditPosDesc(pos.description ?? '')
  }

  function cancelEditPosition() {
    setEditingPosId(null)
    setEditPosName('')
    setEditPosDesc('')
  }

  async function handleSavePosition(id: string) {
    if (!editPosName.trim()) return
    setEditPosLoading(true)

    const { data, error } = await supabase
      .from('positions')
      .update({
        name: editPosName.trim(),
        description: editPosDesc.trim() || null,
      })
      .eq('id', id)
      .eq('organization_id', currentOrgId)
      .select()
      .single()

    if (error) {
      alert('Error al guardar: ' + error.message)
      setEditPosLoading(false)
      return
    }

    setPositions((prev) =>
      prev
        .map((p) => (p.id === id ? (data as Position) : p))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
    setEditPosLoading(false)
    cancelEditPosition()
    router.refresh()
  }

  // Eliminar Cargo
  async function handleDeletePosition(id: string) {
    if (!confirm('¿Estás seguro de eliminar este cargo?')) return
    const { error } = await supabase
      .from('positions')
      .delete()
      .eq('id', id)
      .eq('organization_id', currentOrgId)

    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }
    setPositions((prev) => prev.filter((p) => p.id !== id))
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
      {/* SECCIÓN DE DEPARTAMENTOS */}
      <div className="space-y-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Nuevo Departamento
            </CardTitle>
            <CardDescription>
              Crea áreas de trabajo exclusivas para esta empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddDepartment} className="space-y-4">
              {deptError && (
                <div className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                  {deptError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="dept_name">Nombre del Departamento *</Label>
                <Input
                  id="dept_name"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="Ej. Recursos Humanos, Tecnología, Finanzas"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept_desc">Descripción (opcional)</Label>
                <Input
                  id="dept_desc"
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  placeholder="Breve descripción del departamento"
                />
              </div>
              <Button type="submit" disabled={deptLoading} size="sm">
                {deptLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Agregar Departamento
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Listado de Departamentos */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Departamentos Registrados</CardTitle>
              <span className="text-xs text-muted-foreground font-medium">
                {departments.length} registros
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {departments.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">
                Aún no hay departamentos creados para esta empresa.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[112px] text-right pr-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => {
                    const isEditing = editingDeptId === dept.id
                    return (
                      <TableRow key={dept.id}>
                        {isEditing ? (
                          <>
                            <TableCell className="pl-6">
                              <Input
                                value={editDeptName}
                                onChange={(e) => setEditDeptName(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editDeptDesc}
                                onChange={(e) => setEditDeptDesc(e.target.value)}
                                placeholder="Descripción (opcional)"
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSaveDepartment(dept.id)}
                                  disabled={editDeptLoading || !editDeptName.trim()}
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 h-8 w-8"
                                  title="Guardar"
                                  aria-label="Guardar"
                                >
                                  {editDeptLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={cancelEditDepartment}
                                  disabled={editDeptLoading}
                                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                                  title="Cancelar"
                                  aria-label="Cancelar"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="pl-6 font-medium text-foreground">
                              {dept.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {dept.description ?? '—'}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEditDepartment(dept)}
                                  className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                                  title="Editar departamento"
                                  aria-label="Editar departamento"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteDepartment(dept.id)}
                                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                  title="Eliminar departamento"
                                  aria-label="Eliminar departamento"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN DE CARGOS / PUESTOS */}
      <div className="space-y-6">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              Nuevo Cargo
            </CardTitle>
            <CardDescription>
              Define los puestos laborales específicos de esta empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddPosition} className="space-y-4">
              {posError && (
                <div className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                  {posError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="pos_name">Nombre del Cargo *</Label>
                <Input
                  id="pos_name"
                  value={posName}
                  onChange={(e) => setPosName(e.target.value)}
                  placeholder="Ej. Diseñador UI/UX, Desarrollador Frontend"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos_desc">Descripción (opcional)</Label>
                <Input
                  id="pos_desc"
                  value={posDesc}
                  onChange={(e) => setPosDesc(e.target.value)}
                  placeholder="Breve descripción del puesto"
                />
              </div>
              <Button type="submit" disabled={posLoading} size="sm">
                {posLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Agregar Cargo
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Listado de Cargos */}
        <Card className="rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Cargos Registrados</CardTitle>
              <span className="text-xs text-muted-foreground font-medium">
                {positions.length} registros
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {positions.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">
                Aún no hay cargos registrados para esta empresa.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Puesto</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[112px] text-right pr-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos) => {
                    const isEditing = editingPosId === pos.id
                    return (
                      <TableRow key={pos.id}>
                        {isEditing ? (
                          <>
                            <TableCell className="pl-6">
                              <Input
                                value={editPosName}
                                onChange={(e) => setEditPosName(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editPosDesc}
                                onChange={(e) => setEditPosDesc(e.target.value)}
                                placeholder="Descripción (opcional)"
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSavePosition(pos.id)}
                                  disabled={editPosLoading || !editPosName.trim()}
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 h-8 w-8"
                                  title="Guardar"
                                  aria-label="Guardar"
                                >
                                  {editPosLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={cancelEditPosition}
                                  disabled={editPosLoading}
                                  className="text-muted-foreground hover:text-foreground h-8 w-8"
                                  title="Cancelar"
                                  aria-label="Cancelar"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="pl-6 font-medium text-foreground">
                              {pos.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {pos.description ?? '—'}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEditPosition(pos)}
                                  className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                                  title="Editar cargo"
                                  aria-label="Editar cargo"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeletePosition(pos.id)}
                                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                  title="Eliminar cargo"
                                  aria-label="Eliminar cargo"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
