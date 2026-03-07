import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Search, 
  Edit2,
  Save,
  X,
  Loader2,
  Package,
  MapPin,
  Phone,
  Mail,
  Tag,
  CheckCircle,
  Clock,
  Eye,
  Trash2,
  AlertTriangle,
  Copy,
  Plus,
  Upload,
  Plane,
  Ship,
  Download,
  Filter,
  UserCheck,
  UserX
,
  CreditCard
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import ClientDetailsModal from '@/components/admin/ClientDetailsModal';

export default function AdminClients({ user }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editClient, setEditClient] = useState(null);
  const [viewClient, setViewClient] = useState(null);
  const [deleteClient, setDeleteClient] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [packagesCount, setPackagesCount] = useState({});
  const [addingPackage, setAddingPackage] = useState(false);
  const [packageClient, setPackageClient] = useState(null);
  const [stateConfigs, setStateConfigs] = useState([]);
  const [newPackage, setNewPackage] = useState({
    tracking_number: '',
    description: '',
    shipping_type: 'aereo',
    has_insurance: false,
    fob_value: '',
    package_image_url: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [quickDate, setQuickDate] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [whatsappFilter, setWhatsappFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [exclusiveKey, setExclusiveKey] = useState('all');
  const [canExport, setCanExport] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState([]);
  const latestExport = React.useMemo(() => exportHistory[0] || null, [exportHistory]);
  const olderExports = React.useMemo(() => exportHistory.slice(1), [exportHistory]);

  useEffect(() => {
    loadClients();
    loadStateConfigs();
    loadRolePermissions();
    loadExportHistory();
  }, []);

  const canViewClients = (user?.role === 'admin') || (user?.custom_role === 'customer_service');

  const loadStateConfigs = async () => {
    try {
      const states = await base44.entities.StateConfig.filter({ is_active: true });
      // Usar nombres canónicos y ordenados
      const { normalizeStates } = await import('@/components/utils/states');
      setStateConfigs(normalizeStates(states));
    } catch (error) {
      console.error('Error loading states:', error);
    }
  };

  const loadRolePermissions = async () => {
    try {
      // Los administradores siempre pueden exportar
      if (user?.role === 'admin') { setCanExport(true); return; }

      const roleCode = user?.custom_role || null;
      if (!roleCode) { setCanExport(false); return; }

      const roles = await base44.entities.RoleConfig.filter({ role_code: roleCode, is_active: true });
      const allowed = roles.length > 0 ? !!(roles[0]?.permissions?.export_data) : false;
      setCanExport(allowed);
    } catch (e) {
      setCanExport(user?.role === 'admin');
    }
  };

  const loadExportHistory = async () => {
    try {
      const items = await base44.entities.ClientExportHistory.filter({}, '-created_date', 30);
      setExportHistory(items || []);
    } catch (e) {
      setExportHistory([]);
    }
  };


   const loadClients = async () => {
    try {
      const usersPromise = canViewClients
        ? (user?.role === 'admin'
            ? base44.entities.User.filter({ role: 'user' })
            : base44.functions.invoke('listClientsForSupport').then(res => res.data))
        : Promise.resolve([]);

      const results = await Promise.allSettled([
        usersPromise,
        base44.entities.Package.list()
      ]);

      const users = results[0].status === 'fulfilled' ? results[0].value : [];
      const packages = results[1].status === 'fulfilled' ? results[1].value : [];

      const counts = {};
      packages.forEach(pkg => {
        counts[pkg.client_email] = (counts[pkg.client_email] || 0) + 1;
      });
      setPackagesCount(counts);
      setClients(users);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (client) => {
    setEditClient(client);
    setEditData({
      first_name: client.first_name || '',
      last_name: client.last_name || '',
      state: client.state || '',
      city: client.city || '',
      address: client.address || '',
      whatsapp: client.whatsapp || '',
      shipping_mark: client.shipping_mark || ''
    });
  };

  const handleSave = async () => {
    if (!editClient) return;
    setSaving(true);

    try {
      // Shipping Mark manual: sin prefijo forzado ni validación de formato
      if (typeof editData.shipping_mark === 'string') {
        editData.shipping_mark = editData.shipping_mark.trim();
      }

      const waNorm = getDigits(editData.whatsapp || editClient.whatsapp || '');
      await base44.entities.User.update(editClient.id, { ...editData, whatsapp_normalized: waNorm });

      // Notify client about profile changes
      const changedFields = [];
      if (editData.first_name !== editClient.first_name) changedFields.push('Nombre');
      if (editData.last_name !== editClient.last_name) changedFields.push('Apellido');
      if (editData.city !== editClient.city) changedFields.push('Ciudad');
      if (editData.whatsapp !== editClient.whatsapp) changedFields.push('WhatsApp');
      
      if (changedFields.length > 0) {
        const { sendNotification } = await import('@/components/NotificationUtils');
        sendNotification({
          to: editClient.email,
          subject: '✏️ Actualización de Datos',
          body: `Se han actualizado los siguientes datos de tu cuenta:\n\n${changedFields.join(', ')}\n\nNombre: ${editData.first_name || ''} ${editData.last_name || ''}\nCiudad: ${editData.city || ''}\nWhatsApp: ${editData.whatsapp || ''}\n\nSi no solicitaste estos cambios, contacta con soporte.`,
          message: `Se actualizaron: ${changedFields.join(', ')}`,
          type: 'general',
          icon: 'alert'
        });
      }

      // If shipping mark was assigned, update existing packages and notify client
      if (editData.shipping_mark && !editClient.shipping_mark) {
        const clientPackages = await base44.entities.Package.filter({ client_email: editClient.email });
        for (const pkg of clientPackages) {
          await base44.entities.Package.update(pkg.id, { shipping_mark: editData.shipping_mark });
        }

        // Notify client
        const { sendNotification } = await import('@/components/NotificationUtils');
        sendNotification({
          to: editClient.email,
          subject: '🎉 Shipping Mark Asignado',
          body: `¡Hola ${editData.first_name || 'Usuario'}!\n\nTu Shipping Mark ha sido asignado:\n\n${editData.shipping_mark}\n\nYa puedes comenzar a enviar tus paquetes. Usa este código en todas tus compras online.\n\nDirección del warehouse: Disponible en tu panel de control.`,
          message: `Tu Shipping Mark es: ${editData.shipping_mark}. Ya puedes realizar envíos.`,
          type: 'general',
          icon: 'check'
        });
      } else if (editData.shipping_mark && editData.shipping_mark !== editClient.shipping_mark) {
        // Shipping Mark modified
        const { sendNotification } = await import('@/components/NotificationUtils');
        sendNotification({
          to: editClient.email,
          subject: '🔄 Shipping Mark Modificado',
          body: `Tu Shipping Mark ha sido modificado:\n\nAnterior: ${editClient.shipping_mark}\nNuevo: ${editData.shipping_mark}\n\nPor favor usa el nuevo Shipping Mark para tus próximos envíos.`,
          message: `Nuevo Shipping Mark: ${editData.shipping_mark}`,
          type: 'general',
          icon: 'alert'
        });
      }

      toast.success('Cliente actualizado y notificado');
      setEditClient(null);
      loadClients();
    } catch (error) {
      toast.error('Error al guardar');
    }
    setSaving(false);
  };

  const handleCopyClientInfo = (client) => {
    const info = `Nombre: ${client.first_name || ''} ${client.last_name || ''}
Estado: ${client.state || 'N/A'}
Ciudad: ${client.city || 'N/A'}
Dirección: ${client.address || 'N/A'}
WhatsApp: ${client.whatsapp || 'N/A'}
Email: ${client.email}`;
    
    navigator.clipboard.writeText(info);
    toast.success('Información copiada al portapapeles');
  };

  const handleGenerateDailyClientsReport = async () => {
    try {
      setExportLoading(true);
      const res = await base44.functions.invoke('generateClientsReport');
      const data = res?.data;
      const headers = res?.headers || {};
      let filename = 'clientes_nuevos.csv';
      const cd = headers['content-disposition'] || headers['Content-Disposition'];
      if (cd) {
        const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
        const name = decodeURIComponent(m?.[1] || m?.[2] || '');
        if (name) filename = name;
      }
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Reporte generado');
      await loadExportHistory();
    } catch (e) {
      toast.error('No se pudo generar el reporte');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDownloadHistoryItem = async (item) => {
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: item.file_uri, expires_in: 300 });
      const a = document.createElement('a');
      a.href = signed_url;
      a.download = item.filename || 'clientes_nuevos.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error('No se pudo descargar el archivo');
    }
  };

  const handleExportClients = async () => {
    try {
      const rows = [['Teléfono/WhatsApp']];

      filteredClients.forEach(client => {
        if (client.whatsapp) {
          rows.push([client.whatsapp]);
        }
      });

      const csvContent = rows.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contactos-remarketing-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success(`${rows.length - 1} contactos exportados`);
    } catch (error) {
      toast.error('Error al exportar datos');
    }
  };

  const handleExportAllClients = async () => {
    try {
      const response = await base44.functions.invoke('exportClientsToTxt');
      
      const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clientes_${new Date().toISOString().split('T')[0]}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success(`${clients.length} clientes exportados a TXT`);
    } catch (error) {
      toast.error('Error al exportar datos');
    }
  };

  const handleBackfillStripeCustomers = async () => {
    setBackfilling(true);
    try {
      const res = await base44.functions.invoke('backfillStripeCustomers');
      const data = res?.data || {};
      const msg = `Stripe backfill: creados ${data.created || 0}, omitidos ${data.skipped || 0}, fallidos ${data.failed || 0}`;
      toast.success(msg);
      await loadClients();
    } catch (e) {
      toast.error('Error al ejecutar backfill de Stripe');
    }
    setBackfilling(false);
  };

  const handleExportPendingClients = async () => {
    try {
      const pendingClients = clients.filter(c => !hasValidShippingMark(c) && c.profile_completed && !hasIncompleteData(c));

      if (pendingClients.length === 0) {
        toast.error('No hay clientes pendientes de Shipping Mark');
        return;
      }

      const lines = [];
      pendingClients.forEach((client, index) => {
        lines.push(`Nombre: ${(client.first_name || '') + ' ' + (client.last_name || '')}`.trim());
        lines.push(`Estado: ${client.state || ''}`);
        lines.push(`Ciudad: ${client.city || ''}`);
        lines.push(`Direccion: ${client.address || ''}`);
        lines.push(`WhatsApp: ${client.whatsapp || ''}`);
        lines.push(`Email: ${client.email}`);
        lines.push(`Codigo asignado: ${client.shipping_mark || ''}`);
        if (index < pendingClients.length - 1) {
          lines.push('');
        }
      });

      const txtContent = lines.join('\n');
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clientes-pendientes-shipping-mark-${new Date().toISOString().split('T')[0]}.txt`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`${pendingClients.length} clientes pendientes exportados a TXT`);
    } catch (error) {
      toast.error('Error al exportar datos');
    }
  };

  const handleExportFilteredClients = async () => {
    try {
      if (filteredClients.length === 0) {
        toast.error('No hay clientes para exportar');
        return;
      }
      const lines = [];
      filteredClients.forEach((client, index) => {
        const fullName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
        lines.push(`Nombre: ${fullName}`);
        lines.push(`Estado: ${client.state || ''}`);
        lines.push(`Ciudad: ${client.city || ''}`);
        lines.push(`Direccion: ${client.address || ''}`);
        lines.push(`WhatsApp: ${client.whatsapp || ''}`);
        lines.push(`Email: ${client.email}`);
        lines.push(`Codigo asignado: ${client.shipping_mark || ''}`);
        if (index < filteredClients.length - 1) lines.push('');
      });
      const txtContent = lines.join('\n');
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Construir nombre con filtro y fecha (America/Caracas)
      const filterMap = {
        all: 'todos',
        with_mark: 'con_shipping_mark',
        without_mark: 'sin_shipping_mark',
        pending: 'pendientes',
        incomplete: 'con_datos_faltantes',
        active: 'activos',
        inactive: 'inactivos',
        with_packages: 'con_paquetes',
        without_packages: 'sin_paquetes',
        with_whatsapp: 'con_whatsapp',
        without_whatsapp: 'sin_whatsapp'
      };
      const filterLabel = filterMap[exclusiveKey] || 'seleccion';

      const now = new Date();
      const veFmt = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const [dd, mm, yyyy] = veFmt.split('/');
      const todayStamp = `${yyyy}${mm}${dd}`; // yyyymmdd

      let dateSuffix = todayStamp;
      if (dateFilter) {
        dateSuffix = String(dateFilter).replaceAll('-', ''); // yyyymmdd exacta
      } else if (quickDate === 'today') {
        dateSuffix = `${todayStamp}_hoy`;
      } else if (quickDate === '7d') {
        dateSuffix = `${todayStamp}_ultimos_7d`;
      } else if (quickDate === '30d') {
        dateSuffix = `${todayStamp}_ultimos_30d`;
      }

      link.download = `clientes_${filterLabel}_${dateSuffix}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${filteredClients.length} clientes exportados a TXT`);
    } catch (error) {
      toast.error('Error al exportar datos');
    }
  };

   const handleDelete = async () => {
    if (!deleteClient) return;
    setDeleting(true);

    try {
      // Primero intentamos eliminar en Stripe (si existe), pero no bloquea el borrado local
      if (deleteClient?.stripe_customer_id) {
        try {
          await base44.functions.invoke('deleteStripeCustomer', { user_id: deleteClient.id });
        } catch (_) {
          // Continuar aunque falle la eliminación en Stripe
        }
      }

      const res = await base44.functions.invoke('deleteUserCascade', { email: deleteClient.email });
      if (res?.data?.success) {
        toast.success('Cliente, datos asociados y (si aplica) cliente Stripe eliminados');
      } else {
        toast.error(res?.data?.error || 'No se pudo eliminar');
      }
      setDeleteClient(null);
      loadClients();
    } catch (error) {
      toast.error('Error al eliminar el cliente');
    }
    setDeleting(false);
  };

  const handleDeleteStripeCustomer = async (client) => {
    if (!client?.stripe_customer_id) {
      toast.error('El cliente no tiene cliente Stripe');
      return;
    }
    const ok = window.confirm('¿Borrar cliente en Stripe? Esto no afecta su cuenta en el sistema.');
    if (!ok) return;
    try {
      const res = await base44.functions.invoke('deleteStripeCustomer', { user_id: client.id });
      if (res?.data?.success) {
        toast.success('Cliente Stripe eliminado');
        loadClients();
      } else {
        toast.error(res?.data?.error || 'No se pudo eliminar en Stripe');
      }
    } catch (e) {
      toast.error('Error al eliminar en Stripe');
    }
  };

  const handleToggleActive = async (client, nextActive) => {
    try {
      await base44.entities.User.update(client.id, { is_active: nextActive });
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_active: nextActive } : c));
      if (!nextActive) {
        toast.success('Cliente desactivado');
      } else {
        toast.success('Cliente activado');
      }
    } catch (error) {
      toast.error('No se pudo actualizar el estado');
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setNewPackage({ ...newPackage, package_image_url: file_url });
      toast.success('Imagen subida');
    } catch (error) {
      toast.error('Error al subir imagen');
    }
    setUploadingImage(false);
  };

  const handleAddPackage = async () => {
    if (!newPackage.tracking_number || !newPackage.description) {
      toast.error('Completa tracking y descripción');
      return;
    }

    setSaving(true);
    try {
      // Validar si el tracking ya existe
      const existingPackages = await base44.entities.Package.filter({ 
        tracking_number: newPackage.tracking_number 
      });

      if (existingPackages.length > 0) {
        toast.error('Este número de tracking ya está registrado en el sistema');
        setSaving(false);
        return;
      }

      await base44.entities.Package.create({
        tracking_number: newPackage.tracking_number,
        client_email: packageClient.email,
        shipping_mark: packageClient.shipping_mark || '',
        shipping_type: newPackage.shipping_type,
        description: newPackage.description,
        status: 'recibido',
        has_insurance: newPackage.has_insurance,
        fob_value: newPackage.has_insurance ? parseFloat(newPackage.fob_value) || 0 : 0,
        package_image_url: newPackage.package_image_url || '',
        received_date: new Date().toISOString(),
        received_by: user?.email
      });

      // Notify client
      const { sendNotification } = await import('@/components/NotificationUtils');
      sendNotification({
        to: packageClient.email,
        subject: '📦 Paquete recibido en warehouse',
        body: `Tu paquete ${newPackage.tracking_number} ha sido recibido en nuestro warehouse.\n\nDescripción: ${newPackage.description}\nTipo: ${newPackage.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}\n\nIngresa al sistema para más detalles.`,
        type: 'package',
        icon: 'package',
        referenceId: newPackage.tracking_number
      });

      toast.success('Paquete agregado exitosamente');
      setAddingPackage(false);
      setPackageClient(null);
      setNewPackage({
        tracking_number: '',
        description: '',
        shipping_type: 'aereo',
        has_insurance: false,
        fob_value: '',
        package_image_url: ''
      });
      loadClients();
    } catch (error) {
      toast.error('Error al agregar paquete');
    }
    setSaving(false);
  };

  const hasIncompleteData = (client) => {
    return !client.first_name || !client.last_name || !client.phone || !client.whatsapp || !client.state || !client.city;
  };

  const hasValidShippingMark = (client) => {
    return !!(client.shipping_mark && client.shipping_mark.trim().length > 0);
  };

  // Flexible search helpers: ignore accents, case, spaces and symbols; numeric-only for phones
  const removeDiacritics = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizeText = (str) => removeDiacritics(str).toLowerCase().trim();
  const normalizeAlnum = (str) => normalizeText(str).replace(/[^a-z0-9]/g, '');
  const getDigits = (str) => (str || '').replace(/\D/g, '');

  const resetAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDateFilter('');
    setQuickDate('all');
    setActiveFilter('all');
    setPackageFilter('all');
    setWhatsappFilter('all');
    setStateFilter('all');
    setExclusiveKey('all');
  };

  // Make category filters globally exclusive (one or another)
  const selectStatus = (value) => {
    setStatusFilter(value);
    setActiveFilter('all');
    setPackageFilter('all');
    setWhatsappFilter('all');
    setExclusiveKey(value === 'all' ? 'all' : value);
  };
  const selectActive = (value) => {
    setActiveFilter(value);
    setStatusFilter('all');
    setPackageFilter('all');
    setWhatsappFilter('all');
    setExclusiveKey(value === 'all' ? 'all' : value);
  };
  const selectPackage = (value) => {
    setPackageFilter(value);
    setStatusFilter('all');
    setActiveFilter('all');
    setWhatsappFilter('all');
    setExclusiveKey(value === 'all' ? 'all' : value);
  };
  const selectWhatsapp = (value) => {
    setWhatsappFilter(value);
    setStatusFilter('all');
    setActiveFilter('all');
    setPackageFilter('all');
    setExclusiveKey(value === 'all' ? 'all' : (value === 'with' ? 'with_whatsapp' : 'without_whatsapp'));
  };

  const filteredClients = clients.filter(client => {
  // Map stored value (code or name) to code for filtering
  const clientStateCode = (client.state && client.state.includes(' ')) ? null : client.state;
    // Normalized search: text (accent/case-insensitive), alphanumeric (no spaces/symbols), and digits-only
    const qText = normalizeText(search);
    const qAlnum = normalizeAlnum(search);
    const qDigits = getDigits(search);

    const email = normalizeText(client.email || '');
    const first = normalizeText(client.first_name || '');
    const last = normalizeText(client.last_name || '');
    const full = `${first} ${last}`.trim();
    const cityNorm = normalizeText(client.city || '');
    const whatsappDigits = getDigits(client.whatsapp || '');
    const shippingMarkNorm = normalizeAlnum(client.shipping_mark || '');

    const matchesText = qText === '' || email.includes(qText) || first.includes(qText) || last.includes(qText) || full.includes(qText) || cityNorm.includes(qText);
    const matchesDigits = qDigits !== '' && whatsappDigits.includes(qDigits);
    const matchesAlnum = qAlnum !== '' && shippingMarkNorm.includes(qAlnum);

    const matchesSearch = matchesText || matchesDigits || matchesAlnum;

    // Date filters
    let matchesDate = true;
    if (dateFilter) {
      const clientDate = new Date(client.created_date).toISOString().split('T')[0];
      matchesDate = clientDate === dateFilter;
    }

    let matchesQuick = true;
    if (!dateFilter && quickDate !== 'all') {
      const now = new Date();
      const startOfToday = new Date();
      startOfToday.setHours(0,0,0,0);
      let threshold = startOfToday;
      if (quickDate === '7d') threshold = new Date(now.getTime() - 7*24*60*60*1000);
      if (quickDate === '30d') threshold = new Date(now.getTime() - 30*24*60*60*1000);
      if (quickDate === 'today') threshold = startOfToday;
      matchesQuick = new Date(client.created_date) >= threshold;
    }

    // Single exclusive category filter
    const pkgCount = packagesCount[client.email] || 0;
    const matchesCategory = (() => {
      switch (exclusiveKey) {
        case 'with_mark': return hasValidShippingMark(client);
        case 'without_mark': return !hasValidShippingMark(client);
        case 'pending': return (!hasValidShippingMark(client) && client.profile_completed && !hasIncompleteData(client));
        case 'incomplete': return hasIncompleteData(client);
        case 'active': return client.is_active !== false;
        case 'inactive': return client.is_active === false;
        case 'with_packages': return pkgCount > 0;
        case 'without_packages': return pkgCount === 0;
        case 'with_whatsapp': return !!client.whatsapp;
        case 'without_whatsapp': return !client.whatsapp;
        case 'all':
        default: return true;
      }
    })();

    // State
    const matchesState = stateFilter === 'all' ? true : clientStateCode === stateFilter;

    return matchesSearch && matchesDate && matchesQuick && matchesCategory && matchesState;
  });

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Clientes</h1>
          <p className="text-slate-500">Administra los usuarios y asigna Shipping Marks</p>
        </div>
        {canExport && (
          <div className="flex gap-2">
            <Button 
              onClick={handleGenerateDailyClientsReport}
              disabled={exportLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
              title="Genera y descarga CSV con clientes nuevos de 8am a 8am (America/Caracas)"
            >
              {exportLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Exportar 8am–8am (Excel XLSX)
            </Button>
            <Button 
              onClick={handleExportFilteredClients}
              className="bg-blue-600 hover:bg-blue-700"
              title="Exporta los clientes según los filtros actuales"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Selección (TXT)
            </Button>
            <Button 
              onClick={handleExportClients}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar para Remarketing
            </Button>
            <Button 
              variant="outline"
              onClick={handleBackfillStripeCustomers}
              disabled={backfilling}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              title="Crear clientes en Stripe para todos los usuarios sin uno"
            >
              {backfilling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Backfill Stripe
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Clientes</p>
                <p className="text-3xl font-bold text-slate-800">{clients.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Con Shipping Mark</p>
                <p className="text-3xl font-bold text-slate-800">
                  {clients.filter(c => hasValidShippingMark(c)).length}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendientes</p>
                <p className="text-3xl font-bold text-slate-800">
                  {clients.filter(c => !hasValidShippingMark(c) && c.profile_completed && !hasIncompleteData(c)).length}
                </p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Paquetes</p>
                <p className="text-3xl font-bold text-slate-800">
                  {Object.values(packagesCount).reduce((a, b) => a + b, 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4 space-y-3">

          
          {/* Date Filter */}
          <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Filtrar por fecha exacta:</span>
              <Input
                type="date"
                value={dateFilter || ''}
                onChange={(e) => { setDateFilter(e.target.value); setQuickDate('all'); }}
                className="w-auto"
              />
              {dateFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateFilter('')}
                >
                  Limpiar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={quickDate === 'all' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('all'); setDateFilter(''); }}>Todas</Button>
              <Button variant={quickDate === 'today' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('today'); setDateFilter(''); }}>Hoy</Button>
              <Button variant={quickDate === '7d' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('7d'); setDateFilter(''); }}>Últimos 7 días</Button>
              <Button variant={quickDate === '30d' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('30d'); setDateFilter(''); }}>Últimos 30 días</Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'all'}
                size="sm"
                onClick={() => selectStatus('all')}
                className={(exclusiveKey === 'all') ? 'bg-slate-900 text-white border-slate-900' : ''}
              >
                Todos ({clients.length})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'with_mark'}
                size="sm"
                onClick={() => selectStatus(statusFilter === 'with_mark' ? 'all' : 'with_mark')}
                className={(exclusiveKey === 'with_mark') ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}
              >
                <CheckCircle className="h-3 w-3 mr-1" /> Con Shipping Mark ({clients.filter(c => hasValidShippingMark(c)).length})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'without_mark'}
                size="sm"
                onClick={() => selectStatus(statusFilter === 'without_mark' ? 'all' : 'without_mark')}
                className={(exclusiveKey === 'without_mark') ? 'bg-amber-100 text-amber-700 border-amber-200' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}
              >
                <AlertTriangle className="h-3 w-3 mr-1" /> Sin Shipping Mark ({clients.filter(c => !hasValidShippingMark(c)).length})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'pending'}
                size="sm"
                onClick={() => selectStatus(statusFilter === 'pending' ? 'all' : 'pending')}
                className={(exclusiveKey === 'pending') ? 'bg-orange-100 text-orange-700 border-orange-200' : 'border-orange-200 text-orange-700 hover:bg-orange-50'}
              >
                <Clock className="h-3 w-3 mr-1" /> Pendientes ({clients.filter(c => !hasValidShippingMark(c) && c.profile_completed && !hasIncompleteData(c)).length})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'incomplete'}
                size="sm"
                onClick={() => selectStatus(statusFilter === 'incomplete' ? 'all' : 'incomplete')}
                className={(exclusiveKey === 'incomplete') ? 'bg-red-100 text-red-700 border-red-200' : 'border-red-200 text-red-700 hover:bg-red-50'}
              >
                <AlertTriangle className="h-3 w-3 mr-1" /> Con Datos Faltantes ({clients.filter(c => hasIncompleteData(c)).length})
              </Button>
              {/* New Filters */}
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'active'}
                size="sm"
                onClick={() => selectActive(activeFilter === 'active' ? 'all' : 'active')}
                className={(exclusiveKey === 'active')
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}
              >
                <UserCheck className="h-3 w-3 mr-1" /> Activos ({clients.filter(c => c.is_active !== false).length})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'inactive'}
                size="sm"
                onClick={() => selectActive(activeFilter === 'inactive' ? 'all' : 'inactive')}
                className={(exclusiveKey === 'inactive')
                  ? 'bg-rose-100 text-rose-700 border-rose-200'
                  : 'border-rose-200 text-rose-700 hover:bg-rose-50'}
              >
                <UserX className="h-3 w-3 mr-1" /> Inactivos ({clients.filter(c => c.is_active === false).length})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'with_packages'}
                size="sm"
                onClick={() => selectPackage(packageFilter === 'with_packages' ? 'all' : 'with_packages')}
                className={(exclusiveKey === 'with_packages')
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}
              >
                <Package className="h-3 w-3 mr-1" /> Con Paquetes ({clients.filter(c => (packagesCount[c.email] || 0) > 0).length})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'without_packages'}
                size="sm"
                onClick={() => selectPackage(packageFilter === 'without_packages' ? 'all' : 'without_packages')}
                className={(exclusiveKey === 'without_packages')
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'}
              >
                <Package className="h-3 w-3 mr-1" /> Sin Paquetes ({clients.filter(c => (packagesCount[c.email] || 0) === 0).length})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'with_whatsapp'}
                size="sm"
                onClick={() => selectWhatsapp(whatsappFilter === 'with' ? 'all' : 'with')}
                className={(exclusiveKey === 'with_whatsapp')
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'border-green-200 text-green-700 hover:bg-green-50'}
              >
                <Phone className="h-3 w-3 mr-1" /> Con WhatsApp ({clients.filter(c => !!c.whatsapp).length})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'without_whatsapp'}
                size="sm"
                onClick={() => selectWhatsapp(whatsappFilter === 'without' ? 'all' : 'without')}
                className={(exclusiveKey === 'without_whatsapp')
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'}
              >
                <Phone className="h-3 w-3 mr-1" /> Sin WhatsApp ({clients.filter(c => !c.whatsapp).length})
              </Button>
            </div>
          </div>
          {/* State Filter */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-slate-600">Estado:</span>
            <Select value={stateFilter} onValueChange={(v) => setStateFilter(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {stateConfigs.map((s) => (
                  <SelectItem key={s.state_code} value={s.state_code}>{s.state_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={resetAllFilters} className="ml-auto">Limpiar filtros</Button>
            </div>

            {/* Export History (latest + collapsible rest) */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-slate-700">Historial de exportaciones</div>
                <div className="text-xs text-slate-500">Ventana: 8:00am ↔ 8:00am (America/Caracas)</div>
              </div>
              {(!latestExport) ? (
                <div className="text-sm text-slate-500">Aún no hay exportaciones.</div>
              ) : (
                <div className="space-y-3">
                  {/* Último generado */}
                  <div className="p-3 bg-white rounded-md border shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{latestExport.filename}</div>
                        <div className="text-xs text-slate-500 truncate">
                          Registros: {latestExport.record_count || 0} · Desde {new Date(latestExport.from_iso).toLocaleString('es-VE', { timeZone: 'America/Caracas' })} hasta {new Date(latestExport.to_iso).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {latestExport.triggered_by ? (
                            <>Manual • {new Date(latestExport.created_date).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}</>
                          ) : (
                            <>Automático</>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleDownloadHistoryItem(latestExport)}>
                        <Download className="h-4 w-4 mr-1" /> Descargar
                      </Button>
                    </div>
                  </div>

                  {/* Resto en desplegable */}
                  {olderExports.length > 0 && (
                    <Accordion type="single" collapsible>
                      <AccordionItem value="older">
                        <AccordionTrigger className="text-sm">Ver exportaciones anteriores ({olderExports.length})</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 mt-2">
                            {olderExports.map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-3 p-2 bg-white rounded-md border">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-slate-800 truncate">{item.filename}</div>
                                  <div className="text-xs text-slate-500 truncate">
                                    Registros: {item.record_count || 0} · Desde {new Date(item.from_iso).toLocaleString('es-VE', { timeZone: 'America/Caracas' })} hasta {new Date(item.to_iso).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {item.triggered_by ? (
                                      <>Manual • {new Date(item.created_date).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}</>
                                    ) : (
                                      <>Automático</>
                                    )}
                                  </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => handleDownloadHistoryItem(item)}>
                                  <Download className="h-4 w-4 mr-1" /> Descargar
                                </Button>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
              )}
            </div>
               </CardContent>
               </Card>

      {/* Quick Search (moved below filters) */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por nombre, email, ciudad, WhatsApp o Shipping Mark..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Clients List */}
      {filteredClients.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin clientes</h3>
            <p className="text-slate-500">No se encontraron clientes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => (
            <Card 
              key={client.id} 
              className={`border-0 shadow-md hover:shadow-lg transition-shadow ${
                !hasValidShippingMark(client) && client.profile_completed && !hasIncompleteData(client) ? 'border-l-4 border-l-amber-400' : ''
              }`}
            >
              <CardContent className="p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Avatar & Name */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {(client.first_name?.[0] || client.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        {client.first_name && client.last_name 
                          ? `${client.first_name} ${client.last_name}`
                          : client.email
                        }
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {client.city && (
                      <Badge variant="outline" className="bg-slate-50">
                        <MapPin className="h-3 w-3 mr-1" />
                        {client.city}
                      </Badge>
                    )}
                    {client.whatsapp && (
                      <Badge variant="outline" className="bg-slate-50">
                        <Phone className="h-3 w-3 mr-1" />
                        {client.whatsapp}
                      </Badge>
                    )}
                    {hasValidShippingMark(client) ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        <Tag className="h-3 w-3 mr-1" />
                        {client.shipping_mark}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Sin Shipping Mark
                      </Badge>
                    )}
                    <Badge variant="outline">
                      <Package className="h-3 w-3 mr-1" />
                      {packagesCount[client.email] || 0} paquetes
                    </Badge>
                    {client.is_active === false && (
                      <Badge className="bg-red-100 text-red-700 border-red-200">Inactivo</Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
                      <span className="text-xs text-slate-600">Activo</span>
                      <Switch
                        checked={client.is_active !== false}
                        onCheckedChange={(checked) => handleToggleActive(client, checked)}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyClientInfo(client);
                      }}
                      title="Copiar información"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setPackageClient(client);
                        setAddingPackage(true);
                      }}
                      className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Paquete
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setViewClient(client)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(client)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    {client.stripe_customer_id && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteStripeCustomer(client)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Stripe
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDeleteClient(client)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Client Details Modal */}
      <ClientDetailsModal
        client={viewClient}
        open={!!viewClient}
        onClose={() => setViewClient(null)}
        onClientUpdated={loadClients}
      />

      {/* Add Package Dialog */}
      <Dialog open={addingPackage} onOpenChange={setAddingPackage}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar Paquete Recibido</DialogTitle>
            <DialogDescription>
              Crear paquete directamente como recibido para {packageClient?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Número de Tracking *</Label>
              <Input
                value={newPackage.tracking_number}
                onChange={(e) => setNewPackage({ ...newPackage, tracking_number: e.target.value })}
                placeholder="Ej: 1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Textarea
                value={newPackage.description}
                onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                placeholder="Describe el contenido del paquete"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Envío</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewPackage({ ...newPackage, shipping_type: 'aereo' })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    newPackage.shipping_type === 'aereo'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Plane className={`h-5 w-5 mx-auto mb-1 ${
                    newPackage.shipping_type === 'aereo' ? 'text-blue-600' : 'text-slate-400'
                  }`} />
                  <span className="text-sm font-medium">Aéreo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewPackage({ ...newPackage, shipping_type: 'maritimo' })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    newPackage.shipping_type === 'maritimo'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Ship className={`h-5 w-5 mx-auto mb-1 ${
                    newPackage.shipping_type === 'maritimo' ? 'text-blue-600' : 'text-slate-400'
                  }`} />
                  <span className="text-sm font-medium">Marítimo</span>
                </button>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <Checkbox
                id="package-insurance"
                checked={newPackage.has_insurance}
                onCheckedChange={(checked) => setNewPackage({ ...newPackage, has_insurance: checked })}
              />
              <div className="flex-1">
                <label htmlFor="package-insurance" className="font-medium text-slate-800 cursor-pointer">
                  Asegurar Carga
                </label>
                {newPackage.has_insurance && (
                  <div className="mt-2 space-y-2">
                    <Label>Valor FOB (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newPackage.fob_value}
                      onChange={(e) => setNewPackage({ ...newPackage, fob_value: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Imagen del Paquete (Opcional)</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files[0])}
                  disabled={uploadingImage}
                />
                {uploadingImage && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
              </div>
              {newPackage.package_image_url && (
                <img src={newPackage.package_image_url} alt="Preview" className="h-32 rounded-lg border" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingPackage(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddPackage} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Agregar Paquete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteClient} onOpenChange={() => setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              ¿Eliminar Cliente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar a{' '}
              <span className="font-semibold text-slate-800">
                {deleteClient?.first_name && deleteClient?.last_name
                  ? `${deleteClient.first_name} ${deleteClient.last_name}`
                  : deleteClient?.email}
              </span>
              . Esta acción no se puede deshacer.
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm font-medium">
                  ⚠️ Se eliminarán en cascada TODOS los datos asociados (paquetes, consolidaciones, facturas, tickets, notificaciones, notas, etc.).
                  Además, si existe un cliente en Stripe vinculado, también se eliminará.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Eliminar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      <Dialog open={!!editClient} onOpenChange={() => setEditClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Actualiza la información del cliente y asigna o modifica su Shipping Mark
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editData.first_name}
                  onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                  placeholder="Nombre"
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input
                  value={editData.last_name}
                  onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                  placeholder="Apellido"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Estado
              </Label>
              <select
                value={editData.state}
                onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona un estado</option>
                {stateConfigs.map((state) => (
                  <option key={state.state_code} value={state.state_code}>
                    {state.state_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Ciudad
              </Label>
              <Input
                value={editData.city}
                onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                placeholder="Ciudad de entrega"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Dirección
              </Label>
              <Textarea
                value={editData.address}
                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                placeholder="Dirección completa"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> WhatsApp
              </Label>
              <Input
                value={editData.whatsapp}
                onChange={(e) => setEditData({ ...editData, whatsapp: e.target.value })}
                placeholder="+58 412 1234567"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" /> Shipping Mark
              </Label>
              <Input
                value={editData.shipping_mark || ''}
                onChange={(e) => setEditData({ ...editData, shipping_mark: e.target.value })}
                placeholder="Ingresa el Shipping Mark completo"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}