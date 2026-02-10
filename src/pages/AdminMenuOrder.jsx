import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Save, RotateCcw, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Package,
  Layers,
  Users,
  Settings,
  CreditCard,
  Shield,
  FileText,
  ShieldCheck,
  Truck,
  MessageCircle,
  Calculator,
  Trash2,
  AlertTriangle,
  HelpCircle,
  BarChart3,
  Tag,
  TrendingUp,
  CheckCircle2,
  Mail
} from 'lucide-react';

const iconMap = {
  LayoutDashboard,
  Package,
  Layers,
  Users,
  Settings,
  CreditCard,
  Shield,
  FileText,
  ShieldCheck,
  Truck,
  MessageCircle,
  Calculator,
  Trash2,
  AlertTriangle,
  HelpCircle,
  BarChart3,
  Tag,
  TrendingUp,
  CheckCircle2,
  Mail
};

const defaultAdminMenuItems = [
  { name: 'Dashboard Admin', page: 'AdminDashboard', icon: 'LayoutDashboard', permission: 'view_packages' },
  { name: 'Reportes', page: 'AdminReports', icon: 'BarChart3', permission: 'view_packages' },
  { name: 'Paquetes', page: 'AdminPackages', icon: 'Package', permission: 'view_packages' },
  { name: 'Aprobaciones', page: 'AdminConsolidate', icon: 'Layers', permission: 'consolidate' },
  { name: 'Consolidar', page: 'AdminShipmentApprovals', icon: 'CheckCircle2', permission: 'consolidate' },
  { name: 'Facturas', page: 'AdminInvoices', icon: 'FileText', permission: 'validate_payments' },
  { name: 'Validar Pagos', page: 'AdminPayments', icon: 'CreditCard', permission: 'validate_payments' },
  { name: 'Enviar Emails', page: 'AdminEmailCampaigns', icon: 'Mail', permission: 'general_config' },
  { name: 'Plantillas Email', page: 'AdminEmailTemplates', icon: 'FileText', permission: 'general_config' },
  { name: 'Alertas de Pago', page: 'AdminPaymentAlerts', icon: 'AlertTriangle', permission: 'validate_payments' },
  { name: 'Promociones', page: 'AdminPromotions', icon: 'Tag', permission: 'general_config' },
  { name: 'Marketing', page: 'AdminMarketing', icon: 'TrendingUp', permission: 'general_config' },
  { name: 'Seguimiento', page: 'ShipmentTracking', icon: 'Truck', permission: 'view_packages' },
  { name: 'Calculadora', page: 'ShippingCalculator', icon: 'Calculator', permission: 'view_packages' },
  { name: 'Tracking Asegurados', page: 'AdminInsured', icon: 'ShieldCheck', permission: 'view_packages' },
  { name: 'Tickets Soporte', page: 'AdminSupportTickets', icon: 'MessageCircle', permission: 'view_packages' },
  { name: 'Gestionar FAQ', page: 'AdminFAQ', icon: 'HelpCircle', permission: 'general_config' },
  { name: 'Clientes', page: 'AdminClients', icon: 'Users', permission: 'view_packages' },
  { name: 'Eliminar', page: 'AdminDelete', icon: 'Trash2', permission: 'view_packages' },
  { name: 'Administradores', page: 'AdminPermissions', icon: 'Shield', permission: 'invite_users' },
  { name: 'Configuración', page: 'AdminSettings', icon: 'Settings', permission: 'general_config' }
];

export default function AdminMenuOrder({ user }) {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMenuOrder();
  }, []);

  const loadMenuOrder = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      if (currentUser.menu_order && Array.isArray(currentUser.menu_order)) {
        // Use saved order
        const orderedItems = currentUser.menu_order.map(page => 
          defaultAdminMenuItems.find(item => item.page === page)
        ).filter(Boolean);
        
        // Add any new items that aren't in the saved order
        const existingPages = new Set(currentUser.menu_order);
        const newItems = defaultAdminMenuItems.filter(item => !existingPages.has(item.page));
        
        setMenuItems([...orderedItems, ...newItems]);
      } else {
        // Use default order
        setMenuItems([...defaultAdminMenuItems]);
      }
    } catch (error) {
      console.error('Error loading menu order:', error);
      toast.error('Error al cargar el orden del menú');
    }
    setLoading(false);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(menuItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setMenuItems(items);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const menuOrder = menuItems.map(item => item.page);
      await base44.auth.updateMe({ menu_order: menuOrder });
      toast.success('Orden del menú guardado correctamente');
    } catch (error) {
      console.error('Error saving menu order:', error);
      toast.error('Error al guardar el orden del menú');
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm('¿Estás seguro de restablecer el orden predeterminado del menú?')) return;
    
    setSaving(true);
    try {
      await base44.auth.updateMe({ menu_order: null });
      setMenuItems([...defaultAdminMenuItems]);
      toast.success('Orden del menú restablecido');
    } catch (error) {
      console.error('Error resetting menu order:', error);
      toast.error('Error al restablecer el orden del menú');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Ordenar Menú</h1>
        <p className="text-slate-500 mt-2">Arrastra y suelta los elementos para reordenar el menú del sidebar</p>
      </div>

      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800 mb-1">Instrucciones:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Arrastra los elementos por el ícono de líneas</li>
                <li>Suelta el elemento en la posición deseada</li>
                <li>Haz clic en "Guardar Orden" para aplicar los cambios</li>
                <li>Usa "Restablecer" para volver al orden predeterminado</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Elementos del Menú</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={saving}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restablecer
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar Orden
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="menu-items">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`space-y-2 ${snapshot.isDraggingOver ? 'bg-slate-50 rounded-lg p-2' : ''}`}
                >
                  {menuItems.map((item, index) => {
                    const Icon = iconMap[item.icon] || FileText;
                    return (
                      <Draggable key={item.page} draggableId={item.page} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-3 p-4 bg-white border rounded-lg transition-all ${
                              snapshot.isDragging 
                                ? 'shadow-lg border-blue-500 bg-blue-50' 
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                            >
                              <GripVertical className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${
                                snapshot.isDragging ? 'bg-blue-100' : 'bg-slate-100'
                              }`}>
                                <Icon className={`h-5 w-5 ${
                                  snapshot.isDragging ? 'text-blue-600' : 'text-slate-600'
                                }`} />
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">{item.name}</p>
                                <p className="text-xs text-slate-500">{item.page}</p>
                              </div>
                            </div>
                            <div className="text-sm text-slate-400">
                              #{index + 1}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>
    </div>
  );
}