import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, Check, X, Settings } from 'lucide-react';
import { toast } from 'sonner';

const PERMISSION_LABELS = {
  view_dashboard: 'Ver Dashboard',
  view_packages: 'Ver Paquetes',
  receive_packages: 'Recibir Paquetes',
  view_clients: 'Ver Clientes',
  edit_clients: 'Editar Clientes',
  consolidate: 'Consolidar',
  approve_consolidations: 'Aprobar Consolidaciones',
  validate_payments: 'Validar Pagos',
  view_invoices: 'Ver Facturas',
  create_invoices: 'Crear Facturas',
  send_emails: 'Enviar Emails',
  manage_faq: 'Gestionar FAQ',
  manage_support: 'Gestionar Soporte',
  view_reports: 'Ver Reportes',
  manage_promotions: 'Gestionar Promociones',
  manage_settings: 'Gestionar Configuración',
  invite_users: 'Invitar Usuarios',
  manage_roles: 'Gestionar Roles',
  delete_records: 'Eliminar Registros',
  export_data: 'Exportar Datos'
};

const PAGE_LABELS = {
  'Dashboard': 'Dashboard',
  'AdminDashboard': 'Dashboard Admin',
  'EmployeeDashboard': 'Dashboard Empleado',
  'AdminPackages': 'Paquetes',
  'AdminClients': 'Clientes',
  'AdminConsolidate': 'Aprobaciones',
  'AdminShipmentApprovals': 'Consolidar',
  'AdminPayments': 'Validar Pagos',
  'AdminInvoices': 'Facturas',
  'AdminEmailCampaigns': 'Enviar Emails',
  'AdminEmailTemplates': 'Plantillas Email',
  'AdminPaymentAlerts': 'Alertas de Pago',
  'AdminPromotions': 'Promociones',
  'AdminMarketing': 'Marketing',
  'AdminInsured': 'Tracking Asegurados',
  'AdminSupportTickets': 'Tickets Soporte',
  'AdminFAQ': 'Gestionar FAQ',
  'AdminDelete': 'Eliminar',
  'AdminPermissions': 'Administradores',
  'AdminSettings': 'Configuración',
  'AdminTenants': 'Tenants',
  'AdminBilling': 'Facturación SaaS',
  'AdminReports': 'Reportes',
  'WarehouseDashboard': 'Dashboard Almacén',
  'WarehouseReceive': 'Recepción Almacén',
  'WarehouseLocations': 'Ubicaciones y Sedes Almacén',
  'WarehousePickPackShip': 'Picking y Packing',
  'ShipmentTracking': 'Seguimiento',
  'ShippingCalculator': 'Calculadora'
};

export default function AdminRoles({ user }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      let allRoles = await base44.entities.RoleConfig.list();

      // Create default roles if they don't exist
      if (allRoles.length === 0) {
        await createDefaultRoles();
        allRoles = await base44.entities.RoleConfig.list();
      }

      // Ensure agent/agente roles exist
      await ensureAgentRoles();
      allRoles = await base44.entities.RoleConfig.list();

      // Hide duplicate alias: if both 'agente' and 'agent' exist, prefer showing only 'agente'
      const deduped = (() => {
        const hasAgente = allRoles.some(r => r.role_code === 'agente');
        const hasAgent = allRoles.some(r => r.role_code === 'agent');
        if (hasAgente && hasAgent) {
          return allRoles.filter(r => r.role_code !== 'agent');
        }
        return allRoles;
      })();
      setRoles(deduped);
      if (deduped.length > 0) {
        setSelectedRole(deduped[0]);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      toast.error('Error al cargar roles');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultRoles = async () => {
    const defaultRoles = [
      {
        role_code: 'admin',
        role_name: 'Administrador',
        description: 'Acceso total al sistema',
        is_active: true,
        permissions: Object.keys(PERMISSION_LABELS).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
        visible_pages: Object.keys(PAGE_LABELS)
      },
      {
        role_code: 'user',
        role_name: 'Cliente',
        description: 'Usuario cliente final',
        is_active: true,
        permissions: { view_dashboard: true },
        visible_pages: ['Dashboard', 'Profile', 'MyPackages', 'PreAlert', 'RequestConsolidation', 'MyConsolidations', 'MyInvoices', 'ShipmentTracking', 'ShippingCalculator', 'Rates', 'FAQ', 'Support']
      },
      {
        role_code: 'operations_manager',
        role_name: 'Gerente de Operaciones',
        description: 'Gestión completa de operaciones logísticas',
        is_active: true,
        permissions: {
          view_dashboard: true,
          view_packages: true,
          receive_packages: true,
          view_clients: true,
          edit_clients: true,
          consolidate: true,
          approve_consolidations: true,
          view_invoices: true,
          view_reports: true,
          manage_support: true
        },
        visible_pages: ['AdminDashboard', 'AdminPackages', 'WarehouseDashboard', 'WarehouseReceive', 'WarehouseLocations', 'WarehousePickPackShip', 'AdminClients', 'AdminConsolidate', 'AdminShipmentApprovals', 'AdminInvoices', 'AdminReports', 'AdminSupportTickets', 'ShipmentTracking', 'ShippingCalculator']
      },
      {
        role_code: 'customer_service',
        role_name: 'Servicio al Cliente',
        description: 'Atención y soporte a clientes',
        is_active: true,
        permissions: {
          view_dashboard: true,
          view_packages: true,
          view_clients: true,
          manage_support: true,
          manage_faq: true
        },
        visible_pages: ['EmployeeDashboard', 'AdminClients', 'AdminPackages', 'AdminSupportTickets', 'AdminFAQ', 'ShipmentTracking']
      },
      {
        role_code: 'warehouse',
        role_name: 'Personal de Almacén',
        description: 'Recepción y gestión de paquetes en almacén',
        is_active: true,
        permissions: {
          view_dashboard: true,
          view_packages: true,
          receive_packages: true
        },
        visible_pages: ['EmployeeDashboard', 'AdminPackages', 'WarehouseDashboard', 'WarehouseReceive', 'WarehouseLocations', 'WarehousePickPackShip', 'ShipmentTracking']
      },
      {
        role_code: 'accounting',
        role_name: 'Contabilidad',
        description: 'Gestión financiera y validación de pagos',
        is_active: true,
        permissions: {
          view_dashboard: true,
          validate_payments: true,
          view_invoices: true,
          create_invoices: true,
          view_reports: true
        },
        visible_pages: ['EmployeeDashboard', 'AdminPayments', 'AdminInvoices', 'AdminPaymentAlerts', 'AdminReports']
      }
    ];

    for (const role of defaultRoles) {
      await base44.entities.RoleConfig.create(role);
    }
  };

  const ensureAgentRoles = async () => {
    const existing = await base44.entities.RoleConfig.list();
    const codes = new Set(existing.map(r => r.role_code));
    if (!codes.has('agente')) {
      await base44.entities.RoleConfig.create({
        role_code: 'agente',
        role_name: 'Agente',
        description: 'Rol de agente para programa de referidos',
        is_active: true,
        permissions: { view_dashboard: true, view_clients: true, view_reports: true },
        visible_pages: ['AdminDashboard', 'AdminClients', 'AdminReports']
      });
    }
  };

  const handlePermissionToggle = (permission) => {
    if (!selectedRole) return;
    
    const updatedRole = {
      ...selectedRole,
      permissions: {
        ...selectedRole.permissions,
        [permission]: !selectedRole.permissions?.[permission]
      }
    };
    
    setSelectedRole(updatedRole);
  };

  const handlePageToggle = (page) => {
    if (!selectedRole) return;
    
    const visiblePages = selectedRole.visible_pages || [];
    const updatedPages = visiblePages.includes(page)
      ? visiblePages.filter(p => p !== page)
      : [...visiblePages, page];
    
    setSelectedRole({
      ...selectedRole,
      visible_pages: updatedPages
    });
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    
    try {
      setSaving(true);
      await base44.entities.RoleConfig.update(selectedRole.id, {
        permissions: selectedRole.permissions,
        visible_pages: selectedRole.visible_pages,
        is_active: selectedRole.is_active
      });
      
      // Update local state
      setRoles(roles.map(r => r.id === selectedRole.id ? selectedRole : r));
      
      toast.success('Rol actualizado correctamente');
    } catch (error) {
      console.error('Error saving role:', error);
      toast.error('Error al guardar el rol');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleStatusToggle = async () => {
    if (!selectedRole) return;
    
    const updatedRole = {
      ...selectedRole,
      is_active: !selectedRole.is_active
    };
    
    setSelectedRole(updatedRole);
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
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          Gestión de Roles y Permisos
        </h1>
        <p className="text-slate-500">Configura los permisos y páginas visibles para cada rol</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Role List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedRole?.id === role.id
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'border-2 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{role.role_name}</p>
                    <p className="text-xs text-slate-500">{role.role_code}</p>
                  </div>
                  {role.is_active ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Role Configuration */}
        {selectedRole && (
          <div className="lg:col-span-3 space-y-6">
            {/* Role Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedRole.role_name}</CardTitle>
                    <CardDescription>{selectedRole.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label>Estado:</Label>
                      <Switch
                        checked={selectedRole.is_active}
                        onCheckedChange={handleRoleStatusToggle}
                        disabled={selectedRole.role_code === 'admin' || selectedRole.role_code === 'user'}
                      />
                      <span className={`text-sm font-medium ${selectedRole.is_active ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedRole.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Permisos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <Label htmlFor={`perm-${key}`} className="text-sm cursor-pointer flex-1">
                        {label}
                      </Label>
                      <Switch
                        id={`perm-${key}`}
                        checked={selectedRole.permissions?.[key] || false}
                        onCheckedChange={() => handlePermissionToggle(key)}
                        disabled={selectedRole.role_code === 'admin'}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Visible Pages */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Páginas Visibles</CardTitle>
                <CardDescription>Selecciona las páginas que puede ver este rol</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(PAGE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <Label htmlFor={`page-${key}`} className="text-sm cursor-pointer flex-1">
                        {label}
                      </Label>
                      <Switch
                        id={`page-${key}`}
                        checked={selectedRole.visible_pages?.includes(key) || false}
                        onCheckedChange={() => handlePageToggle(key)}
                        disabled={selectedRole.role_code === 'admin'}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving || selectedRole.role_code === 'admin'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}