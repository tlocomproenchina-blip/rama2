import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, ShieldCheck, Briefcase, Save } from 'lucide-react';
import { toast } from 'sonner';
import RolePermissionsCard from '@/components/admin/RolePermissionsCard';
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
    const q = search.toLowerCase();
    return !q || item.email?.toLowerCase().includes(q) || item.full_name?.toLowerCase().includes(q) || item.custom_role?.toLowerCase().includes(q);
  }), [admins, search]);

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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Roles por área</h1>
        <p className="text-slate-500">Asigna un área a cada administrador y define qué módulos puede ver cada área.</p>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Asignación de áreas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, email o área" className="pl-10" />
          </div>

          <div className="grid gap-4">
            {filteredAdmins.map((item) => (
              <Card key={item.id} className="border border-slate-100 shadow-sm">
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-800 truncate">{item.full_name || item.email}</h3>
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <ShieldCheck className="mr-1 h-3 w-3" /> Admin
                      </Badge>
                      <Badge variant="outline" className="text-blue-700 border-blue-200">
                        <Briefcase className="mr-1 h-3 w-3" />
                        {item.custom_role || 'sin área'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 break-all">{item.email}</p>
                  </div>

                  <div className="w-full md:w-64">
                    <Select value={item.custom_role || 'sin_area'} onValueChange={(value) => handleAreaChange(item, value)} disabled={processingUserId === item.id || item.email === user?.email}>
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
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Permisos por área</h2>
          <p className="text-slate-500">Marca los módulos visibles para cada área y guarda los cambios.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {ROLE_OPTIONS.map((roleCode) => {
            const config = roleConfigs[roleCode] || ROLE_PRESETS[roleCode];
            return (
              <div key={roleCode} className="space-y-3">
                <RolePermissionsCard
                  roleName={config.role_name}
                  description={config.description}
                  roleCode={roleCode}
                  pages={PERMISSION_PAGES}
                  pageLabels={PAGE_LABELS}
                  selectedPages={config.visible_pages || []}
                  onTogglePage={(page) => handleTogglePage(roleCode, page)}
                />
                <Button onClick={() => handleSavePermissions(roleCode)} disabled={processingRoleCode === roleCode} className="bg-blue-600 hover:bg-blue-700">
                  {processingRoleCode === roleCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar permisos de {config.role_name}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}