import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, Loader2, Mail, Search, ShieldCheck, UserCog, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_OPTIONS, ROLE_PRESETS } from '@/lib/rolePermissions';
import PageHero from '@/components/common/PageHero';

export default function AdminEmployees({ user }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [openInvite, setOpenInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteArea, setInviteArea] = useState('sin_area');
  const [editData, setEditData] = useState({
    first_name: '',
    last_name: '',
    whatsapp: '',
    city: '',
    address: '',
    custom_role: 'sin_area',
  });
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.User.filter({ role: 'admin' }, '-created_date', 300);
      setEmployees(rows || []);
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
    const base = {
      total: employees.length,
      sin_area: employees.filter((item) => !item.custom_role).length,
    };

    ROLE_OPTIONS.forEach((role) => {
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
      custom_role: employee.custom_role || 'sin_area',
    });
  };

  const handleSave = async () => {
    if (!editingEmployee) return;
    if (editingEmployee.email === user?.email && editData.custom_role === 'sin_area') {
      toast.error('No puedes dejar tu propia cuenta sin área aquí');
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
        custom_role: editData.custom_role === 'sin_area' ? null : editData.custom_role,
      };
      const changedFields = Object.entries(payload)
        .filter(([key, value]) => (editingEmployee?.[key] || null) !== (value || null))
        .map(([key]) => key);

      await base44.entities.User.update(editingEmployee.id, payload);
      await createAuditLog({
        target_email: editingEmployee.email,
        target_name: editingEmployee.full_name || `${payload.first_name || ''} ${payload.last_name || ''}`.trim(),
        action_type: 'update_employee',
        area_code: payload.custom_role || '',
        area_name: payload.custom_role ? ROLE_PRESETS[payload.custom_role]?.role_name || payload.custom_role : 'Sin área',
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
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    setInviting(true);
    try {
      const existingRows = await base44.entities.User.filter({ email: normalizedEmail }, '-created_date', 1);
      const existingUser = existingRows?.[0];

      if (existingUser?.id) {
        await base44.entities.User.update(existingUser.id, {
          role: 'admin',
          custom_role: inviteArea === 'sin_area' ? null : inviteArea,
        });

        await createAuditLog({
          target_email: normalizedEmail,
          target_name: existingUser.full_name || normalizedEmail,
          action_type: 'promote_employee',
          area_code: inviteArea === 'sin_area' ? '' : inviteArea,
          area_name: inviteArea === 'sin_area' ? 'Sin área' : ROLE_PRESETS[inviteArea]?.role_name || inviteArea,
          summary: `Convirtió a empleado ${existingUser.full_name || normalizedEmail}`,
          details: inviteArea === 'sin_area' ? 'Usuario existente convertido a empleado sin área asignada' : `Usuario existente convertido a empleado con área ${ROLE_PRESETS[inviteArea]?.role_name || inviteArea}`,
          changed_fields: ['role', 'custom_role'],
        });

        toast.success('Cliente convertido en empleado');
      } else {
        await base44.users.inviteUser(normalizedEmail, 'admin');

        if (inviteArea !== 'sin_area') {
          try {
            const rows = await base44.entities.User.filter({ email: normalizedEmail }, '-created_date', 1);
            const invitedUser = rows?.[0];
            if (invitedUser?.id) {
              await base44.entities.User.update(invitedUser.id, { custom_role: inviteArea });
            }
          } catch {}
        }

        await createAuditLog({
          target_email: normalizedEmail,
          target_name: '',
          action_type: 'invite_employee',
          area_code: inviteArea === 'sin_area' ? '' : inviteArea,
          area_name: inviteArea === 'sin_area' ? 'Sin área' : ROLE_PRESETS[inviteArea]?.role_name || inviteArea,
          summary: `Invitó empleado ${normalizedEmail}`,
          details: inviteArea === 'sin_area' ? 'Invitación enviada sin área asignada' : `Invitación enviada con área ${ROLE_PRESETS[inviteArea]?.role_name || inviteArea}`,
          changed_fields: ['role', 'custom_role'],
        });

        toast.success('Invitación de empleado enviada');
      }

      setInviteEmail('');
      setInviteArea('sin_area');
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
        actions={<Button onClick={() => setOpenInvite(true)}>Agregar empleado</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Total</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p></CardContent></Card>
        {ROLE_OPTIONS.slice(0, 2).map((role) => (
          <Card key={role} className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">{ROLE_PRESETS[role].role_name}</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats[role]}</p></CardContent></Card>
        ))}
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Sin área</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.sin_area}</p></CardContent></Card>
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
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <ShieldCheck className="mr-1 h-3 w-3" /> Admin
                      </Badge>
                      <Badge variant="outline" className="border-blue-200 text-blue-700">
                        <Briefcase className="mr-1 h-3 w-3" />
                        {employee.custom_role || 'sin área'}
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
                  <SelectItem value="sin_area">Sin área</SelectItem>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_PRESETS[role].role_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
              El empleado será invitado con acceso administrativo y podrás seguir editándolo desde este módulo.
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
              <Select value={editData.custom_role} onValueChange={(value) => setEditData({ ...editData, custom_role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_area">Sin área</SelectItem>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>{ROLE_PRESETS[role].role_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </div>
  );
}