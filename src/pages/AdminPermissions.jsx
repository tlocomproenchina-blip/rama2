import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Users, Settings as SettingsIcon, Save, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPermissions() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const allRoles = await base44.entities.Role.list();
      setRoles(allRoles);
      if (allRoles.length > 0 && !selectedRole) {
        setSelectedRole(allRoles[0]);
      }
    } catch (error) {
      toast.error('Error al cargar roles');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (category, permission, value) => {
    setSelectedRole(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [category]: {
          ...prev.permissions[category],
          [permission]: value
        }
      }
    }));
  };

  const handleSaveRole = async () => {
    setSaving(true);
    try {
      await base44.entities.Role.update(selectedRole.id, selectedRole);
      toast.success(`Rol "${selectedRole.role_name}" actualizado`);
      await loadRoles();
    } catch (error) {
      toast.error('Error al guardar rol');
    } finally {
      setSaving(false);
    }
  };

  const permissionCategories = [
    { key: 'dashboard', name: 'Dashboard', icon: '📊' },
    { key: 'packages', name: 'Paquetes', icon: '📦' },
    { key: 'consolidations', name: 'Consolidaciones', icon: '🚚' },
    { key: 'payments', name: 'Pagos', icon: '💰' },
    { key: 'invoices', name: 'Facturas', icon: '🧾' },
    { key: 'clients', name: 'Clientes', icon: '👥' },
    { key: 'reports', name: 'Reportes', icon: '📈' },
    { key: 'support', name: 'Soporte', icon: '🎧' },
    { key: 'settings', name: 'Configuración', icon: '⚙️' },
    { key: 'marketing', name: 'Marketing', icon: '📣' }
  ];

  const getPermissionLabel = (key) => {
    const labels = {
      view: 'Ver',
      view_own: 'Ver propios',
      view_all: 'Ver todos',
      view_stats: 'Ver estadísticas',
      create: 'Crear',
      edit: 'Editar',
      edit_own: 'Editar propios',
      edit_all: 'Editar todos',
      delete: 'Eliminar',
      receive: 'Recibir',
      approve: 'Aprobar',
      ship: 'Enviar',
      validate: 'Validar',
      manage: 'Gestionar',
      assign_shipping_mark: 'Asignar Shipping Mark',
      add_notes: 'Añadir notas',
      invite: 'Invitar',
      export: 'Exportar',
      view_own_tickets: 'Ver tickets propios',
      view_all_tickets: 'Ver todos los tickets',
      respond: 'Responder',
      close: 'Cerrar',
      edit_rates: 'Editar tarifas',
      edit_app_config: 'Editar configuración app',
      edit_privacy: 'Editar privacidad',
      create_campaigns: 'Crear campañas',
      manage_promotions: 'Gestionar promociones'
    };
    return labels[key] || key;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Gestión de Roles y Permisos
          </h1>
          <p className="text-slate-500">Configura los permisos de cada rol en el sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Lista de Roles */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Roles</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar rol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles
              .filter(role => role.role_name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(role => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedRole?.id === role.id
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-slate-50 border-2 border-transparent hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800">{role.role_name}</span>
                    <Badge variant={role.is_active ? 'default' : 'secondary'} className="text-xs">
                      {role.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{role.description}</p>
                </button>
              ))}
          </CardContent>
        </Card>

        {/* Main Content - Permisos del Rol Seleccionado */}
        <Card className="lg:col-span-3">
          {selectedRole ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      {selectedRole.role_name}
                    </CardTitle>
                    <CardDescription className="mt-1">{selectedRole.description}</CardDescription>
                  </div>
                  <Button
                    onClick={handleSaveRole}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="permissions" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="permissions">Permisos</TabsTrigger>
                    <TabsTrigger value="pages">Páginas Visibles</TabsTrigger>
                    <TabsTrigger value="info">Información</TabsTrigger>
                  </TabsList>

                  <TabsContent value="permissions" className="space-y-4">
                    {permissionCategories.map(category => {
                      const categoryPerms = selectedRole.permissions?.[category.key] || {};
                      const permKeys = Object.keys(categoryPerms);
                      
                      if (permKeys.length === 0) return null;

                      return (
                        <Card key={category.key} className="border-slate-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <span>{category.icon}</span>
                              {category.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {permKeys.map(permKey => (
                                <div key={permKey} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                  <Label htmlFor={`${category.key}-${permKey}`} className="text-sm cursor-pointer">
                                    {getPermissionLabel(permKey)}
                                  </Label>
                                  <Switch
                                    id={`${category.key}-${permKey}`}
                                    checked={categoryPerms[permKey]}
                                    onCheckedChange={(value) => handlePermissionChange(category.key, permKey, value)}
                                  />
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </TabsContent>

                  <TabsContent value="pages" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Páginas Accesibles</CardTitle>
                        <CardDescription>
                          Páginas que este rol puede visualizar en la aplicación
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {selectedRole.visible_pages?.map(page => (
                            <Badge key={page} variant="secondary" className="text-sm">
                              {page}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="info" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Información del Rol</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Clave del Rol</Label>
                          <Input value={selectedRole.role_key} disabled className="bg-slate-50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Nombre del Rol</Label>
                          <Input
                            value={selectedRole.role_name}
                            onChange={(e) => setSelectedRole({ ...selectedRole, role_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Descripción</Label>
                          <Input
                            value={selectedRole.description}
                            onChange={(e) => setSelectedRole({ ...selectedRole, description: e.target.value })}
                          />
                        </div>
                        <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg">
                          <Label htmlFor="role-active" className="flex-1 cursor-pointer">
                            Rol Activo
                          </Label>
                          <Switch
                            id="role-active"
                            checked={selectedRole.is_active}
                            onCheckedChange={(value) => setSelectedRole({ ...selectedRole, is_active: value })}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-slate-500">Selecciona un rol para editar sus permisos</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}