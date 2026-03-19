import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, ShieldCheck, Briefcase, Save, Users, KeyRound, LayoutPanelTop } from 'lucide-react';
import { toast } from 'sonner';
import RolePermissionsCard from '@/components/admin/RolePermissionsCard';
import RoleAreaSidebar from '@/components/admin/RoleAreaSidebar';
import { ROLE_OPTIONS, ROLE_PRESETS, PAGE_LABELS } from '@/lib/rolePermissions';
import { adminMenuItems } from '@/components/sidebar/sidebarConfig';

const PERMISSION_PAGES = adminMenuItems
  .map((item) => item.page)
  .filter((page) => !['AdminAdministrators', 'AdminRoles', 'AdminDelete', 'AdminSettings'].includes(page));

export default function AdminRoles({ user }) {
  const [admins, setAdmins] = useState([]);
  const [roleConfigs, setRoleConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processingUserId, setProcessingUserId] = useState(null);
  const [processingRoleCode, setProcessingRoleCode] = useState(null);
  const [selectedRoleCode, setSelectedRoleCode] = useState(ROLE_OPTIONS[0]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [adminUsers, configRows] = await Promise.all([
        base44.entities.User.filter({ role: 'admin' }, '-created_date', 300),
        base44.entities.RoleConfig.list('-updated_date', 50)
      ]);

      setAdmins(adminUsers || []);

      const mappedConfigs = { ...ROLE_PRESETS };
      (configRows || []).forEach((row) => {
        if (row?.role_code) {
          mappedConfigs[row.role_code] = {
            ...mappedConfigs[row.role_code],
            ...row,
            visible_pages: row.visible_pages || mappedConfigs[row.role_code]?.visible_pages || []
          };
        }
      });
      setRoleConfigs(mappedConfigs);
    } catch {
      toast.error('No se pudieron cargar los roles por área');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const filteredAdmins = useMemo(() => admins.filter((item) => {
    const q = String(search || '').toLowerCase();
    const email = String(item.email || '').toLowerCase();
    const fullName = String(item.full_name || '').toLowerCase();
    const customRole = String(item.custom_role || '').toLowerCase();
    return !q || email.includes(q) || fullName.includes(q) || customRole.includes(q);
  }), [admins, search]);

  const stats = useMemo(() => ({
    admins: admins.length,
    assigned: admins.filter((item) => !!item.custom_role).length,
    modules: PERMISSION_PAGES.length,
    areas: ROLE_OPTIONS.length,
  }), [admins]);

  const handleAreaChange = async (targetUser, nextRole) => {
    if (targetUser.email === user?.email) {
      toast.error('No puedes cambiar tu propia asignación aquí');
      return;
    }

    setProcessingUserId(targetUser.id);
    try {
      await base44.entities.User.update(targetUser.id, { custom_role: nextRole === 'sin_area' ? null : nextRole });
      setAdmins((prev) => prev.map((item) => item.id === targetUser.id ? { ...item, custom_role: nextRole === 'sin_area' ? null : nextRole } : item));
      toast.success('Área asignada correctamente');
    } catch {
      toast.error('No se pudo actualizar el área');
    }
    setProcessingUserId(null);
  };

  const handleTogglePage = (roleCode, pageName) => {
    setRoleConfigs((prev) => {
      const current = prev[roleCode] || ROLE_PRESETS[roleCode];
      const visiblePages = current?.visible_pages || [];
      const nextVisiblePages = visiblePages.includes(pageName)
        ? visiblePages.filter((page) => page !== pageName)
        : [...visiblePages, pageName];

      return {
        ...prev,
        [roleCode]: {
          ...current,
          visible_pages: nextVisiblePages
        }
      };
    });
  };

  const handleSavePermissions = async (roleCode) => {
    const current = roleConfigs[roleCode] || ROLE_PRESETS[roleCode];
    if (!current) return;

    setProcessingRoleCode(roleCode);
    try {
      const payload = {
        role_code: roleCode,
        role_name: current.role_name,
        description: current.description,
        visible_pages: current.visible_pages || [],
        is_active: current.is_active !== false,
      };

      if (current.id) {
        await base44.entities.RoleConfig.update(current.id, payload);
      } else {
        const created = await base44.entities.RoleConfig.create(payload);
        setRoleConfigs((prev) => ({ ...prev, [roleCode]: { ...current, ...created } }));
      }
      toast.success('Permisos guardados');
    } catch {
      toast.error('No se pudieron guardar los permisos');
    }
    setProcessingRoleCode(null);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
              <KeyRound className="h-3.5 w-3.5" />
              Gestión de accesos por área
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Roles por área</h1>
            <p className="max-w-2xl text-sm text-slate-200 md:text-base">
              Asigna un área a cada administrador y define qué módulos puede ver cada equipo dentro del sistema.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs text-slate-300">Administradores</p>
              <p className="mt-2 text-2xl font-semibold">{stats.admins}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs text-slate-300">Con área</p>
              <p className="mt-2 text-2xl font-semibold">{stats.assigned}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs text-slate-300">Áreas</p>
              <p className="mt-2 text-2xl font-semibold">{stats.areas}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs text-slate-300">Módulos</p>
              <p className="mt-2 text-2xl font-semibold">{stats.modules}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="h-5 w-5 text-blue-600" />
            Asignación de áreas a administradores
          </CardTitle>
          <CardDescription>
            Busca un administrador y asígnale el área operativa que le corresponde.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, email o área" className="pl-10" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredAdmins.map((item) => (
              <Card key={item.id} className="border border-slate-100 bg-slate-50/60 shadow-sm transition-all hover:shadow-md">
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-800 truncate">{item.full_name || item.email}</h3>
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <ShieldCheck className="mr-1 h-3 w-3" /> Admin
                      </Badge>
                      <Badge variant="outline" className="border-blue-200 text-blue-700">
                        <Briefcase className="mr-1 h-3 w-3" />
                        {item.custom_role || 'sin área'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 break-all">{item.email}</p>
                  </div>

                  <div className="w-full md:w-64">
                    <Select value={item.custom_role || 'sin_area'} onValueChange={(value) => handleAreaChange(item, value)} disabled={processingUserId === item.id || item.email === user?.email}>
                      <SelectTrigger className="bg-white">
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
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <LayoutPanelTop className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Permisos por área</h2>
            <p className="text-sm text-slate-500">Toca un área en el panel lateral para desplegar y editar sus permisos.</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[320px,minmax(0,1fr)]">
          <RoleAreaSidebar
            roleOptions={ROLE_OPTIONS}
            roleConfigs={roleConfigs}
            selectedRoleCode={selectedRoleCode}
            onSelectRole={setSelectedRoleCode}
          />

          <div className="min-w-0 space-y-3">
            {(() => {
              const config = roleConfigs[selectedRoleCode] || ROLE_PRESETS[selectedRoleCode];
              return (
                <>
                  <RolePermissionsCard
                    roleName={config.role_name}
                    description={config.description}
                    roleCode={selectedRoleCode}
                    pages={PERMISSION_PAGES}
                    pageLabels={PAGE_LABELS}
                    selectedPages={config.visible_pages || []}
                    onTogglePage={(page) => handleTogglePage(selectedRoleCode, page)}
                  />
                  <Button onClick={() => handleSavePermissions(selectedRoleCode)} disabled={processingRoleCode === selectedRoleCode} className="w-full bg-blue-600 hover:bg-blue-700">
                    {processingRoleCode === selectedRoleCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar permisos de {config.role_name}
                  </Button>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}