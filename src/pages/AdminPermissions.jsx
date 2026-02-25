import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Shield, 
  Search, 
  UserPlus,
  UserMinus,
  Settings,
  Loader2,
  Crown,
  User as UserIcon,
  Package,
  Layers,
  CreditCard,
  DollarSign,
  Users
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const PERMISSIONS = [
  { key: 'view_packages', label: 'Ver Paquetes', icon: Package, description: 'Puede ver todos los paquetes' },
  { key: 'view_clients', label: 'Ver Clientes', icon: Users, description: 'Puede ver todos los clientes' },
  { key: 'consolidate', label: 'Consolidar Cargas', icon: Layers, description: 'Puede crear consolidaciones' },
  { key: 'validate_payments', label: 'Validar Pagos', icon: CreditCard, description: 'Puede validar y rechazar pagos' },
  { key: 'view_rates', label: 'Ver Tarifas', icon: DollarSign, description: 'Puede ver las tarifas configuradas' },
  { key: 'general_config', label: 'Configuración General', icon: Settings, description: 'Puede editar la configuración' },
  { key: 'invite_users', label: 'Invitar Usuarios', icon: Users, description: 'Puede invitar nuevos usuarios' },
];

export default function AdminPermissions({ user }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allUsers, allRoles] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.RoleConfig.filter({ is_active: true })
    ]);
    setUsers(allUsers);
    setRoles(allRoles);
    setLoading(false);
  };

  const loadUsers = async () => {
    const allUsers = await base44.entities.User.list();
    setUsers(allUsers);
  };

  const handleMakeAdmin = async (targetUser) => {
    try {
      await base44.entities.User.update(targetUser.id, {
        role: 'admin',
        admin_permissions: {
          view_packages: true,
          consolidate: true,
          validate_payments: true,
          view_rates: true,
          general_config: true,
          invite_users: true
        }
      });
      toast.success(`${targetUser.email} ahora es administrador`);
      loadUsers();
    } catch (error) {
      toast.error('Error al actualizar rol');
    }
  };

  const handleRevokeAdmin = async (targetUser) => {
    try {
      await base44.entities.User.update(targetUser.id, {
        role: 'user',
        admin_permissions: null
      });
      toast.success(`Permisos de ${targetUser.email} revocados`);
      loadUsers();
    } catch (error) {
      toast.error('Error al revocar permisos');
    }
  };

  const handleMakeEmployee = async (targetUser) => {
    try {
      await base44.entities.User.update(targetUser.id, {
        is_employee: true,
        role: 'user',
        admin_permissions: {
          view_packages: true,
          view_clients: true,
          consolidate: true,
          validate_payments: false,
          view_rates: true,
          general_config: false,
          invite_users: false
        }
      });
      toast.success(`${targetUser.email} ahora es empleado`);
      loadUsers();
    } catch (error) {
      toast.error('Error al actualizar rol');
    }
  };

  const handleRevokeEmployee = async (targetUser) => {
    try {
      await base44.entities.User.update(targetUser.id, {
        is_employee: false,
        custom_role: null,
        admin_permissions: null
      });
      toast.success(`Rol de empleado de ${targetUser.email} revocado`);
      loadUsers();
    } catch (error) {
      toast.error('Error al revocar permisos de empleado');
    }
  };

  const openPermissions = (targetUser) => {
    setSelectedUser(targetUser);
    setPermissions(targetUser.admin_permissions || {
      view_packages: true,
      view_clients: true,
      consolidate: true,
      validate_payments: true,
      view_rates: true,
      general_config: true,
      invite_users: true
    });
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);

    try {
      await base44.entities.User.update(selectedUser.id, {
        admin_permissions: permissions
      });
      toast.success('Permisos actualizados');
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      toast.error('Error al guardar');
    }
    setSaving(false);
  };

  const filteredUsers = users.filter(u => {
    const searchLower = search.toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(searchLower) ||
      (u.full_name || '').toLowerCase().includes(searchLower)
    );
  });

  const admins = filteredUsers.filter(u => u.role === 'admin');
  const employees = filteredUsers.filter(u => (u.is_employee || u.custom_role) && u.role === 'user');
  const regularUsers = filteredUsers.filter(u => !u.is_employee && !u.custom_role && u.role === 'user');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Administradores y Permisos</h1>
        <p className="text-slate-500">Gestiona roles y permisos de usuarios</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Administradores</p>
                <p className="text-3xl font-bold text-slate-800">{admins.length}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Crown className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Empleados</p>
                <p className="text-3xl font-bold text-slate-800">{employees.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Clientes</p>
                <p className="text-3xl font-bold text-slate-800">{regularUsers.length}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl">
                <UserIcon className="h-6 w-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Admins Section */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-amber-50/50">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-amber-600" />
            Administradores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {admins.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No hay administradores
            </div>
          ) : (
            <div className="divide-y">
              {admins.map((admin) => (
                <div key={admin.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold">
                      {(admin.full_name?.[0] || admin.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{admin.full_name || admin.email}</p>
                      <p className="text-sm text-slate-500">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openPermissions(admin)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Permisos
                    </Button>
                    {admin.id !== user.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <UserMinus className="h-4 w-4 mr-1" />
                            Revocar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Revocar permisos de administrador?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {admin.email} será convertido a usuario regular y perderá todos los permisos de administración.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleRevokeAdmin(admin)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Revocar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employees Section */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b bg-blue-50/50">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-blue-600" />
            Empleados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No hay empleados
            </div>
          ) : (
            <div className="divide-y">
              {employees.map((emp) => (
                <div key={emp.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold">
                      {(emp.full_name?.[0] || emp.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{emp.full_name || emp.email}</p>
                      <p className="text-sm text-slate-500">{emp.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openPermissions(emp)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Permisos
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleMakeAdmin(emp)}
                      className="border-amber-200 text-amber-600 hover:bg-amber-50"
                    >
                      <Crown className="h-4 w-4 mr-1" />
                      Hacer Admin
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <UserMinus className="h-4 w-4 mr-1" />
                          Revocar Empleado
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Revocar rol de empleado?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {emp.email} perderá sus permisos de empleado y será un usuario regular.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleRevokeEmployee(emp)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Revocar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regular Users Section */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserIcon className="h-5 w-5 text-slate-600" />
            Usuarios Regulares
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {regularUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No hay usuarios regulares
            </div>
          ) : (
            <div className="divide-y">
              {regularUsers.map((u) => (
                <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-xl flex items-center justify-center text-white font-bold">
                      {(u.full_name?.[0] || u.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{u.full_name || u.email}</p>
                      <p className="text-sm text-slate-500">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.custom_role && (
                      <Badge variant="outline" className="text-blue-600">
                        {roles.find(r => r.role_code === u.custom_role)?.role_name}
                      </Badge>
                    )}
                    <Select 
                      value={u.custom_role || 'none'}
                      onValueChange={async (value) => {
                        try {
                          await base44.entities.User.update(u.id, {
                            custom_role: value === 'none' ? null : value
                          });
                          toast.success('Rol actualizado');
                          loadUsers();
                        } catch (error) {
                          toast.error('Error al actualizar rol');
                        }
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Asignar rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin rol personalizado</SelectItem>
                        {roles.filter(r => r.role_code !== 'admin' && r.role_code !== 'user').map(role => (
                          <SelectItem key={role.id} value={role.role_code}>
                            {role.role_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleMakeAdmin(u)}
                      className="border-amber-200 text-amber-600 hover:bg-amber-50"
                    >
                      <Crown className="h-4 w-4 mr-1" />
                      Hacer Admin
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permissions Modal */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Permisos de Administrador
            </DialogTitle>
            <DialogDescription>
              Configura los permisos para {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {PERMISSIONS.map((perm) => {
              const Icon = perm.icon;
              return (
                <div key={perm.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{perm.label}</p>
                      <p className="text-xs text-slate-500">{perm.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={permissions[perm.key] !== false}
                    onCheckedChange={(checked) => setPermissions({ ...permissions, [perm.key]: checked })}
                  />
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Cancelar
            </Button>
            <Button onClick={savePermissions} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar Permisos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}