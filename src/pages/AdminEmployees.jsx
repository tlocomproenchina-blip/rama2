import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, KeyRound, Loader2, Mail, Search, UserCog, UserMinus, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AREA_ROLE_OPTIONS, ROLE_PRESETS, ensureRoleConfig } from '@/lib/rolePermissions';
import PageHero from '@/components/common/PageHero';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AdminEmployees({ user }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [openInvite, setOpenInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteArea, setInviteArea] = useState('');
  const [editData, setEditData] = useState({
    first_name: '',
    last_name: '',
    whatsapp: '',
    city: '',
    address: '',
    custom_role: '',
  });
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [demoteTarget, setDemoteTarget] = useState(null);
  const [demoting, setDemoting] = useState(false);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      // Solo cuentas con rol de área: los administradores se gestionan en el
      // directorio de Administradores.
      const res = await base44.functions.invoke('listAdmins', { limit: 300, kind: 'employees' });
      setEmployees(res?.data?.admins || []);
    } catch {
      toast.error('No se pudieron cargar los empleados');
    }
    setLoading(false);
  };

  useEffect(() => { loadEmployees(); }, []);

  const createAuditLog = async (payload) => {
    await base44.entities.EmployeeAuditLog.create({
      actor_email: user?.email || 'system',
      actor_name: user?.full_name || '',
      ...payload,
    });
  };

  const filteredEmployees = useMemo(() => employees.filter((item) => {
    const q = String(search || '').toLowerCase();
    const email = String(item.email || '').toLowerCase();
    const fullName = String(item.full_name || '').toLowerCase();
    const customRole = String(item.custom_role || '').toLowerCase();
    const city = String(item.city || '').toLowerCase();
    return !q || email.includes(q) || fullName.includes(q) || customRole.includes(q) || city.includes(q);
  }), [employees, search]);

  const stats = useMemo(() => {
    const base = { total: employees.length };

    AREA_ROLE_OPTIONS.forEach((role) => {
      base[role] = employees.filter((item) => item.custom_role === role).length;
    });

    return base;
  }, [employees]);

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setEditData({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      whatsapp: employee.whatsapp || '',
      city: employee.city || '',
      address: employee.address || '',
      custom_role: employee.custom_role || '',
    });
  };

  const handleRoleChangeInEdit = (value) => {
    if (value === 'pasar_a_cliente') {
      setDemoteTarget(editingEmployee);
      return;
    }
    setEditData({ ...editData, custom_role: value });
  };

  const handleConfirmDemote = async () => {
    if (!demoteTarget) return;
    setDemoting(true);
    try {
      const res = await base44.functions.invoke('manageRoleAssignment', {
        target_user_id: demoteTarget.id,
        next_role: 'pasar_a_cliente',
      });
      if (res?.data?.demoted) {
        setEmployees((prev) => prev.filter((item) => item.id !== demoteTarget.id));
        setEditingEmployee(null);
        toast.success(`${demoteTarget.full_name || demoteTarget.email} ahora es un cliente`);
      }
    } catch (err) {
      toast.error(err?.data?.error || 'No se pudo convertir en cliente');
    }
    setDemoting(false);
    setDemoteTarget(null);
  };

  const handleSave = async () => {
    if (!editingEmployee) return;
    // Todo empleado trabaja con un área: sin área la cuenta pasa a ser
    // administrador y sale de este directorio.
    if (!AREA_ROLE_OPTIONS.includes(editData.custom_role)) {
      toast.error('Selecciona el área del empleado');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: editData.first_name,
        last_name: editData.last_name,
        whatsapp: editData.whatsapp,
        city: editData.city,
        address: editData.address,
        custom_role: editData.custom_role,
      };
      const changedFields = Object.entries(payload)
        .filter(([key, value]) => (editingEmployee?.[key] || null) !== (value || null))
        .map(([key]) => key);

      await base44.entities.User.update(editingEmployee.id, payload);
      try { await ensureRoleConfig(base44, payload.custom_role); } catch {}
      await createAuditLog({
        target_email: editingEmployee.email,
        target_name: editingEmployee.full_name || `${payload.first_name || ''} ${payload.last_name || ''}`.trim(),
        action_type: 'update_employee',
        area_code: payload.custom_role,
        area_name: ROLE_PRESETS[payload.custom_role]?.role_name || payload.custom_role,
        summary: `Actualizó empleado ${editingEmployee.full_name || editingEmployee.email}`,
        details: changedFields.length > 0 ? `Campos modificados: ${changedFields.join(', ')}` : 'Sin cambios detectados en campos auditables',
        changed_fields: changedFields,
      });
      setEmployees((prev) => prev.map((item) => item.id === editingEmployee.id ? { ...item, ...payload } : item));
      setEditingEmployee(null);
      toast.success('Empleado actualizado');
    } catch {
      toast.error('No se pudo actualizar el empleado');
    }
    setSaving(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    if (!AREA_ROLE_OPTIONS.includes(inviteArea)) {
      toast.error('Selecciona el área del empleado');
      return;
    }
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    const areaName = ROLE_PRESETS[inviteArea]?.role_name || inviteArea;
    setInviting(true);
    try {
      const lookupRes = await base44.functions.invoke('listAllUsers', { emails: [normalizedEmail] });
      const existingUser = lookupRes?.data?.users?.[0];

      if (existingUser?.id) {
        await base44.entities.User.update(existingUser.id, { role: 'admin', custom_role: inviteArea });
        try { await ensureRoleConfig(base44, inviteArea); } catch {}

        await createAuditLog({
          target_email: normalizedEmail,
          target_name: existingUser.full_name || normalizedEmail,
          action_type: 'promote_employee',
          area_code: inviteArea,
          area_name: areaName,
          summary: `Convirtió a empleado ${existingUser.full_name || normalizedEmail}`,
          details: `Usuario existente convertido a empleado con área ${areaName}`,
          changed_fields: ['role', 'custom_role'],
        });

        toast.success('Cliente convertido en empleado');
      } else {
        await base44.users.inviteUser(normalizedEmail, 'admin');

        try {
          const invitedRes = await base44.functions.invoke('listAllUsers', { emails: [normalizedEmail] });
          const invitedUser = invitedRes?.data?.users?.[0];
          if (invitedUser?.id) {
            await base44.entities.User.update(invitedUser.id, { custom_role: inviteArea });
          }
          await ensureRoleConfig(base44, inviteArea);
        } catch {}

        await createAuditLog({
          target_email: normalizedEmail,
          target_name: '',
          action_type: 'invite_employee',
          area_code: inviteArea,
          area_name: areaName,
          summary: `Invitó empleado ${normalizedEmail}`,
          details: `Invitación enviada con área ${areaName}`,
          changed_fields: ['role', 'custom_role'],
        });

        toast.success('Invitación de empleado enviada');
      }

      setInviteEmail('');
      setInviteArea('');
      setOpenInvite(false);
      loadEmployees();
    } catch {
      toast.error('No se pudo procesar el empleado');
    }
    setInviting(false);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHero
        icon={UserCog}
        badge="Gestión de empleados internos"
        title="Empleados"
        description="Visualiza, busca y edita a los empleados del sistema, incluyendo la asignación directa del rol por área."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setOpenInvite(true)} className="bg-blue-600 hover:bg-blue-700">
              <UserPlus className="mr-2 h-4 w-4" />
              Agregar empleado
            </Button>
            <Button asChild variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Link to="/AdminRoles">
                <KeyRound className="mr-2 h-4 w-4" />
                Roles y permisos por área
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Total empleados</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p></CardContent></Card>
        {AREA_ROLE_OPTIONS.slice(0, 3).map((role) => (
          <Card key={role} className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">{ROLE_PRESETS[role].role_name}</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats[role]}</p></CardContent></Card>
        ))}
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><Users className="h-5 w-5 text-blue-600" /> Directorio de empleados</CardTitle>
          <CardDescription>Usa el buscador para encontrar y editar empleados rápidamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, email, ciudad o área" className="pl-10" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredEmployees.map((employee) => (
              <Card key={employee.id} className="border border-slate-100 bg-slate-50/60 shadow-sm transition-all hover:shadow-md">
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-800 truncate">{employee.full_name || employee.email}</h3>
                      <Badge className="bg-indigo-100 text-indigo-700">
                        <Briefcase className="mr-1 h-3 w-3" /> {ROLE_PRESETS[employee.custom_role]?.role_name || employee.custom_role}
                      </Badge>
                      <Badge variant="outline" className="border-slate-200 text-slate-600">
                        Empleado
                      </Badge>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm">
                      <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Correo</p>
                        <p className="text-sm text-slate-700 break-all">{employee.email}</p>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(employee)}>
                    Editar empleado
                  </Button>
                </CardContent>
              </Card>
            ))}
            {filteredEmployees.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No hay empleados con ese criterio. Las cuentas administradoras se gestionan en{' '}
                <Link to="/AdminAdministrators" className="font-medium text-blue-600 underline">Administradores</Link>.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={openInvite} onOpenChange={setOpenInvite}>
        <DialogContent className="max-w-md border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Agregar empleado</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="empleado@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Rol por área</Label>
              <Select value={inviteArea} onValueChange={setInviteArea}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona área" />
                </SelectTrigger>
                <SelectContent>
                  {AREA_ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_PRESETS[role].role_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
              El empleado tendrá acceso al panel con los permisos de su área, no como administrador. Podrás seguir editándolo desde este módulo.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenInvite(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting} className="bg-blue-600 hover:bg-blue-700">
              {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
        <DialogContent className="max-w-xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Editar empleado</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={editData.first_name} onChange={(e) => setEditData({ ...editData, first_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Apellido</Label>
              <Input value={editData.last_name} onChange={(e) => setEditData({ ...editData, last_name: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>WhatsApp</Label>
              <Input value={editData.whatsapp} onChange={(e) => setEditData({ ...editData, whatsapp: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={editData.city} onChange={(e) => setEditData({ ...editData, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rol por área</Label>
              <Select value={editData.custom_role} onValueChange={handleRoleChangeInEdit} disabled={demoting}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona área" />
                </SelectTrigger>
                <SelectContent>
                  {AREA_ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_PRESETS[role].role_name}</SelectItem>
                  ))}
                  <div className="my-1 border-t border-slate-100" />
                  <SelectItem value="pasar_a_cliente" className="text-rose-600 focus:bg-rose-50 focus:text-rose-700">
                    <span className="flex items-center gap-2">
                      <UserMinus className="h-4 w-4" />
                      Pasar a cliente
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Los módulos que puede ver cada área se configuran en{' '}
                <Link to="/AdminRoles" className="font-medium text-blue-600 underline">Roles y permisos</Link>.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Dirección</Label>
              <Input value={editData.address} onChange={(e) => setEditData({ ...editData, address: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEmployee(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!demoteTarget} onOpenChange={(open) => { if (!demoting && !open) setDemoteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Pasar a cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {demoteTarget && (
                <>
                  <strong>{demoteTarget.full_name || demoteTarget.email}</strong> dejará de ser empleado y pasará a ser un cliente regular. Esta acción quita su acceso al panel de administración y su área asignada.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={demoting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDemote}
              disabled={demoting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {demoting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />}
              Sí, pasar a cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}