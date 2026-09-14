import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, ShieldCheck, Briefcase, Save, Users, KeyRound, LayoutPanelTop, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
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
import RolePermissionsCard from '@/components/admin/RolePermissionsCard';
import RoleAreaSidebar from '@/components/admin/RoleAreaSidebar';
import { ROLE_OPTIONS, ROLE_PRESETS, PAGE_LABELS } from '@/lib/rolePermissions';
import { adminMenuItems } from '@/components/sidebar/sidebarConfig';
import PageHero from '@/components/common/PageHero';

const PERMISSION_PAGES = adminMenuItems
  .map((item) => item.page)
  .filter((page) => !['AdminAdministrators', 'AdminRoles', 'AdminDelete', 'AdminSettings'].includes(page));

// Módulos que corresponden por defecto a cada área. El rol Administrador
// recibe acceso a todos los módulos del sistema.
const defaultPagesFor = (roleCode) =>
  roleCode === 'administrador' ? PERMISSION_PAGES : (ROLE_PRESETS[roleCode]?.visible_pages || []);

export default function AdminRoles({ user }) {
  const [admins, setAdmins] = useState([]);
  const [roleConfigs, setRoleConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processingUserId, setProcessingUserId] = useState(null);
  const [processingRoleCode, setProcessingRoleCode] = useState(null);
  const [selectedRoleCode, setSelectedRoleCode] = useState(ROLE_OPTIONS[0]);
  const [demoteTarget, setDemoteTarget] = useState(null);
  const [demoting, setDemoting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [adminUsers, configsRes] = await Promise.all([
        base44.functions.invoke('listAdmins', { limit: 300 }).then(r => r?.data?.admins || []),
        base44.functions.invoke('listRoleConfigs', {}).then(r => r?.data?.configs || null)
      ]);

      setAdmins(adminUsers || []);

      const mappedConfigs = {};
      ROLE_OPTIONS.forEach((code) => {
        mappedConfigs[code] = { ...ROLE_PRESETS[code], visible_pages: defaultPagesFor(code) };
      });
      if (configsRes) {
        Object.keys(configsRes).forEach((code) => {
          if (mappedConfigs[code]) {
            const row = configsRes[code];
            mappedConfigs[code] = {
              ...mappedConfigs[code],
              ...row,
              visible_pages: row.visible_pages?.length ? row.visible_pages : defaultPagesFor(code)
            };
          }
        });
      }
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

    if (nextRole === 'pasar_a_cliente') {
      setDemoteTarget(targetUser);
      return;
    }

    setProcessingUserId(targetUser.id);
    try {
      const res = await base44.functions.invoke('manageRoleAssignment', {
        target_user_id: targetUser.id,
        next_role: nextRole,
      });
      const updatedUser = res?.data?.user;
      const savedConfig = res?.data?.role_config;

      if (nextRole !== 'sin_area' && savedConfig?.id) {
        setRoleConfigs((prev) => ({
          ...prev,
          [nextRole]: {
            ...prev[nextRole],
            ...savedConfig,
            visible_pages: savedConfig.visible_pages?.length
              ? savedConfig.visible_pages
              : defaultPagesFor(nextRole)
          }
        }));
        setSelectedRoleCode(nextRole);
      }
      if (updatedUser) {
        setAdmins((prev) => prev.map((item) => item.id === targetUser.id ? { ...item, custom_role: updatedUser.custom_role } : item));
      }
      toast.success('Área asignada correctamente');
    } catch (err) {
      toast.error(err?.data?.error || 'No se pudo actualizar el área');
    }
    setProcessingUserId(null);
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
        setAdmins((prev) => prev.filter((item) => item.id !== demoteTarget.id));
        toast.success(`${demoteTarget.full_name || demoteTarget.email} ahora es un cliente`);
      }
    } catch (err) {
      toast.error(err?.data?.error || 'No se pudo convertir en cliente');
    }
    setDemoting(false);
    setDemoteTarget(null);
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
      const res = await base44.functions.invoke('saveRolePermissions', {
        role_code: roleCode,
        role_name: current.role_name,
        description: current.description,
        visible_pages: current.visible_pages || [],
        is_active: current.is_active !== false,
      });
      const savedConfig = res?.data?.role_config;
      if (savedConfig) {
        setRoleConfigs((prev) => ({
          ...prev,
          [roleCode]: {
            ...prev[roleCode],
            ...savedConfig,
            visible_pages: savedConfig.visible_pages?.length
              ? savedConfig.visible_pages
              : defaultPagesFor(roleCode)
          }
        }));
      }
      toast.success('Permisos guardados');
    } catch (err) {
      toast.error(err?.data?.error || 'No se pudieron guardar los permisos');
    }
    setProcessingRoleCode(null);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHero
        icon={KeyRound}
        badge="Gestión de accesos por área"
        title="Roles por área"
        description="Asigna un área a cada administrador y define qué módulos puede ver cada equipo dentro del sistema."
        actions={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
              <p className="text-xs text-slate-500">Administradores</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.admins}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
              <p className="text-xs text-slate-500">Con área</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.assigned}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
              <p className="text-xs text-slate-500">Áreas</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.areas}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
              <p className="text-xs text-slate-500">Módulos</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.modules}</p>
            </div>
          </div>
        }
      />

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
                        {item.custom_role && ROLE_PRESETS[item.custom_role]?.role_name ? ROLE_PRESETS[item.custom_role].role_name : 'sin área'}
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
                        <div className="my-1 border-t border-slate-100" />
                        <SelectItem value="pasar_a_cliente" className="text-rose-600 focus:bg-rose-50 focus:text-rose-700">
                          <span className="flex items-center gap-2">
                            <UserMinus className="h-4 w-4" />
                            Pasar a cliente
                          </span>
                        </SelectItem>
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
                  {selectedRoleCode === 'administrador' && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      El rol <strong>Administrador</strong> tiene marcados todos los módulos del sistema. Desmarca solo los que quieras restringir.
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setRoleConfigs((prev) => ({
                      ...prev,
                      [selectedRoleCode]: { ...prev[selectedRoleCode], visible_pages: defaultPagesFor(selectedRoleCode) }
                    }))}
                    className="w-full"
                  >
                    Restaurar módulos predeterminados de {config.role_name}
                  </Button>
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

      <AlertDialog open={!!demoteTarget} onOpenChange={(open) => { if (!demoting && !open) setDemoteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Pasar a cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {demoteTarget && (
                <>
                  <strong>{demoteTarget.full_name || demoteTarget.email}</strong> dejará de ser administrador y pasará a ser un cliente regular. Esta acción quita su acceso al panel de administración y su área asignada.
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