import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { ROLE_OPTIONS, ROLE_PRESETS } from '@/lib/rolePermissions';
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
  UserX,
  CreditCard,
  CalendarDays,
  Crown
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import ClientDetailsModal from '@/components/admin/ClientDetailsModal';
import ClientImportDialog from '@/components/imports/ClientImportDialog';
import { getDigits, sanitizeClientProfileData } from '@/lib/inputSanitizers';

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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [quickDate, setQuickDate] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [whatsappFilter, setWhatsappFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [exclusiveKey, setExclusiveKey] = useState('all');
  const canExport = user?.role === 'admin';
  const [backfilling, setBackfilling] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);
  const PAGE_SIZE = 50;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [globalCounts, setGlobalCounts] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce de la búsqueda (350ms) para no martillar el backend al teclear
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);


  useEffect(() => {
    loadStateConfigs();
  }, []);

  // Pre-fill search from URL (?q=... or ?email=...) — used by Global Search palette
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q') || params.get('email') || params.get('shipping_mark');
      if (q) setSearch(q);
    } catch (_) {}
  }, []);

  // Recarga lista cada vez que cambian filtros / búsqueda (todo server-side ahora)
  useEffect(() => {
    loadClients(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, exclusiveKey, stateFilter, fromDate, toDate, quickDate]);

  // Realtime directo sobre User desactivado para evitar errores de permisos en producción.


  const canViewClients = user?.role === 'admin';

  const loadStateConfigs = async () => {
    try {
      const states = await base44.entities.StateConfig.filter({ is_active: true });
      setStateConfigs(
        [...states].sort((a, b) => String(a.state_name || '').localeCompare(String(b.state_name || '')))
      );
    } catch (error) {
      console.error('Error loading states:', error);
    }
  };




  const loadClients = async (append = false) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      if (!canViewClients) {
        setClients([]);
        setHasMore(false);
        return;
      }

      const skip = append ? clients.length : 0;
      // Solo pedir counts globales en la PRIMERA carga (sin filtros aplicados aún) para no recalcular cada vez
      const includeCounts = !append;

      const res = await base44.functions.invoke('listClientsForSupport', {
        limit: PAGE_SIZE,
        skip,
        q: debouncedSearch,
        exclusiveKey,
        stateFilter,
        fromDate,
        toDate,
        quickDate,
        includeCounts,
      });

      const payload = res?.data || {};
      const users = Array.isArray(payload.data) ? payload.data : [];

      if (append) {
        setClients((prev) => [...prev, ...users]);
      } else {
        setClients(users);
      }
      setHasMore(!!payload.hasMore);
      setTotalFiltered(payload.total || 0);
      if (payload.counts) setGlobalCounts(payload.counts);
      if (payload.packageCounts) setPackagesCount(payload.packageCounts);
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
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
      const sanitizedEditData = sanitizeClientProfileData(editData);

      const waNorm = getDigits(sanitizedEditData.whatsapp || editClient.whatsapp || '');
      await base44.entities.User.update(editClient.id, { ...sanitizedEditData, whatsapp_normalized: waNorm });

      // Notify client about profile changes
      const changedFields = [];
      if (sanitizedEditData.first_name !== editClient.first_name) changedFields.push('Nombre');
      if (sanitizedEditData.last_name !== editClient.last_name) changedFields.push('Apellido');
      if (sanitizedEditData.city !== editClient.city) changedFields.push('Ciudad');
      if (sanitizedEditData.whatsapp !== editClient.whatsapp) changedFields.push('WhatsApp');
      
      if (changedFields.length > 0) {
        const { sendNotification } = await import('@/components/NotificationUtils');
        sendNotification({
          to: editClient.email,
          subject: '✏️ Actualización de Datos',
          body: `Se han actualizado los siguientes datos de tu cuenta:\n\n${changedFields.join(', ')}\n\nNombre: ${sanitizedEditData.first_name || ''} ${sanitizedEditData.last_name || ''}\nCiudad: ${sanitizedEditData.city || ''}\nWhatsApp: ${sanitizedEditData.whatsapp || ''}\n\nSi no solicitaste estos cambios, contacta con soporte.`,
          message: `Se actualizaron: ${changedFields.join(', ')}`,
          type: 'general',
          icon: 'alert'
          });
      }

      // If shipping mark was assigned, update existing packages and notify client
      if (sanitizedEditData.shipping_mark && !editClient.shipping_mark) {
        const clientPackages = await base44.entities.Package.filter({ client_email: editClient.email });
        // Paralelizar updates en lugar de await secuencial (mucho más rápido)
        await Promise.all(
          clientPackages.map((pkg) =>
            base44.entities.Package.update(pkg.id, { shipping_mark: sanitizedEditData.shipping_mark })
          )
        );

        // Notify client
        const { sendNotification } = await import('@/components/NotificationUtils');
        sendNotification({
          to: editClient.email,
          subject: '🎉 Shipping Mark Asignado',
          body: `¡Hola ${sanitizedEditData.first_name || 'Usuario'}!\n\nTu Shipping Mark ha sido asignado:\n\n${sanitizedEditData.shipping_mark}\n\nYa puedes comenzar a enviar tus paquetes. Usa este código en todas tus compras online.\n\nDirección del warehouse: Disponible en tu panel de control.`,
          message: `Tu Shipping Mark es: ${sanitizedEditData.shipping_mark}. Ya puedes realizar envíos.`,
          type: 'general',
          icon: 'check'
        });
      } else if (sanitizedEditData.shipping_mark && sanitizedEditData.shipping_mark !== editClient.shipping_mark) {
        // Shipping Mark modified
        const { sendNotification } = await import('@/components/NotificationUtils');
        sendNotification({
          to: editClient.email,
          subject: '🔄 Shipping Mark Modificado',
          body: `Tu Shipping Mark ha sido modificado:\n\nAnterior: ${editClient.shipping_mark}\nNuevo: ${sanitizedEditData.shipping_mark}\n\nPor favor usa el nuevo Shipping Mark para tus próximos envíos.`,
          message: `Nuevo Shipping Mark: ${sanitizedEditData.shipping_mark}`,
          type: 'general',
          icon: 'alert'
        });
      }

      const updatedClient = {
        ...editClient,
        ...sanitizedEditData,
        whatsapp_normalized: waNorm,
      };

      setClients((prev) => prev.map((client) => client.id === editClient.id ? updatedClient : client));
      setViewClient((prev) => prev?.id === editClient.id ? updatedClient : prev);
      setEditClient(null);
      toast.success('Cliente actualizado y notificado');
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





  // Pide al backend TODOS los clientes que coinciden con los filtros (sin paginar)
  const fetchAllFilteredClients = async () => {
    const res = await base44.functions.invoke('listClientsForSupport', {
      limit: 200, skip: 0,
      q: debouncedSearch, exclusiveKey, stateFilter, fromDate, toDate, quickDate,
      includeCounts: false,
    });
    let all = res?.data?.data || [];
    let total = res?.data?.total || all.length;
    while (all.length < total) {
      const more = await base44.functions.invoke('listClientsForSupport', {
        limit: 200, skip: all.length,
        q: debouncedSearch, exclusiveKey, stateFilter, fromDate, toDate, quickDate,
        includeCounts: false,
      });
      const batch = more?.data?.data || [];
      if (batch.length === 0) break;
      all = all.concat(batch);
    }
    return all;
  };

  const handleExportClients = async () => {
    try {
      const all = await fetchAllFilteredClients();
      const rows = [['Teléfono/WhatsApp']];

      all.forEach(client => {
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
      // Pedir TODOS los pendientes al backend (no solo la página actual)
      const res = await base44.functions.invoke('listClientsForSupport', {
        limit: 200, skip: 0, exclusiveKey: 'pending', includeCounts: false,
      });
      let pendingClients = res?.data?.data || [];
      const total = res?.data?.total || pendingClients.length;
      while (pendingClients.length < total) {
        const more = await base44.functions.invoke('listClientsForSupport', {
          limit: 200, skip: pendingClients.length, exclusiveKey: 'pending', includeCounts: false,
        });
        const batch = more?.data?.data || [];
        if (batch.length === 0) break;
        pendingClients = pendingClients.concat(batch);
      }

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
      // Pedir TODOS los clientes que coinciden con los filtros actuales (no solo la página)
      const all = await fetchAllFilteredClients();
      if (all.length === 0) {
        toast.error('No hay clientes para exportar');
        return;
      }
      const lines = [];
      all.forEach((client, index) => {
        const fullName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
        lines.push(`Nombre: ${fullName}`);
        lines.push(`Estado: ${client.state || ''}`);
        lines.push(`Ciudad: ${client.city || ''}`);
        lines.push(`Direccion: ${client.address || ''}`);
        lines.push(`WhatsApp: ${client.whatsapp || ''}`);
        lines.push(`Email: ${client.email}`);
        lines.push(`Codigo asignado: ${client.shipping_mark || ''}`);
        if (index < all.length - 1) lines.push('');
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
      if (fromDate || toDate) {
        const fromS = fromDate ? String(fromDate).replaceAll('-', '') : '00000000';
        const toS = toDate ? String(toDate).replaceAll('-', '') : todayStamp;
        dateSuffix = `${fromS}_${toS}`;
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
      toast.success(`${lines.filter(l => l.startsWith('Email:')).length} clientes exportados a TXT`);
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
      // Optimistic UI: remove immediately without full reload
      setClients(prev => prev.filter(c => c.id === deleteClient.id ? false : true));
      setPackagesCount(prev => { const next = { ...prev }; try { delete next[deleteClient.email]; } catch (_) {} return next; });
      setDeleteClient(null);
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
        // Optimistic: limpiar stripe_customer_id localmente sin recargar
        setClients((prev) => prev.map((c) => c.id === client.id ? { ...c, stripe_customer_id: null } : c));
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
      setPackagesCount((prev) => ({
        ...prev,
        [packageClient.email]: (prev[packageClient.email] || 0) + 1,
      }));
      // Optimistic: ya actualizamos packagesCount; no recargar toda la lista
    } catch (error) {
      toast.error('Error al agregar paquete');
    }
    setSaving(false);
  };

  const hasIncompleteData = (client) => {
    return !client.first_name || !client.last_name || !client.whatsapp || !client.state || !client.city || !client.address;
  };

  const hasValidShippingMark = (client) => {
    return !!(client.shipping_mark && client.shipping_mark.trim().length > 0);
  };

  // Flexible search helpers: ignore accents, case, spaces and symbols; numeric-only for phones
  const removeDiacritics = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizeText = (str) => removeDiacritics(str).toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizeAlnum = (str) => normalizeText(str).replace(/[^a-z0-9]/g, '');
  const getDigits = (str) => (str || '').replace(/\D/g, '');
  const stripSpecialCharacters = (str) => removeDiacritics(str).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  const resetAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
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

  const handleChangeRegisteredUserRole = async (client, nextRole) => {
    if (!client?.id) return;
    setRoleUpdatingId(client.id);
    try {
      const isAdminRole = nextRole !== 'user';
      await base44.entities.User.update(client.id, {
        role: isAdminRole ? 'admin' : 'user',
        custom_role: isAdminRole ? nextRole : null,
      });
      setClients((prev) => prev.map((item) => item.id === client.id ? {
        ...item,
        role: isAdminRole ? 'admin' : 'user',
        custom_role: isAdminRole ? nextRole : null,
      } : item));
      toast.success(isAdminRole ? 'Usuario movido a equipo con el rol seleccionado' : 'Usuario cambiado a cliente');
    } catch {
      toast.error('No se pudo cambiar el rol');
    }
    setRoleUpdatingId(null);
  };

  const registeredClients = useMemo(() => clients.filter((client) => client.custom_role !== 'super_admin_oculto'), [clients]);

  // Counts globales vienen del backend (calculados sobre TODOS los clientes, no solo la página)
  // Si aún no llegaron (primera carga), usar valores por defecto en cero
  const counts = globalCounts || {
    total: 0, withMark: 0, withoutMark: 0, pending: 0, incomplete: 0,
    active: 0, inactive: 0, withPackages: 0, withoutPackages: 0,
    withWhatsapp: 0, withoutWhatsapp: 0, totalPackages: 0,
  };

  // Ya no se filtra en cliente: el backend devuelve la página ya filtrada.
  // Solo excluimos super_admin_oculto que también viene filtrado en backend, pero por seguridad.
  const filteredClients = registeredClients;

  // Solo mostrar loader fullscreen en la primera carga (sin clientes todavía)
  if (loading && clients.length === 0) {
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
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">

            <Button 
              onClick={() => setImportModalOpen(true)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar Clientes
            </Button>
            <Button 
              onClick={handleExportFilteredClients}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              title="Exporta los clientes según los filtros actuales"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Selección (TXT)
            </Button>
            <Button 
              onClick={handleExportClients}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar para Remarketing
            </Button>
            <Button 
              variant="outline"
              onClick={handleBackfillStripeCustomers}
              disabled={backfilling}
              className="w-full sm:w-auto border-indigo-200 text-indigo-700 hover:bg-indigo-50"
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
                <p className="text-3xl font-bold text-slate-800">{counts.total || clients.length}</p>
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
                  {counts.withMark}
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
                  {counts.pending}
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
                  {counts.totalPackages}
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Filtrar por rango de fechas:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Desde</span>
                <Input
                  type="date"
                  value={fromDate || ''}
                  onChange={(e) => { setFromDate(e.target.value); setQuickDate('all'); }}
                  className="w-auto"
                />
                <span className="text-xs text-slate-500">Hasta</span>
                <Input
                  type="date"
                  value={toDate || ''}
                  onChange={(e) => { setToDate(e.target.value); setQuickDate('all'); }}
                  className="w-auto"
                />
                {(fromDate || toDate) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setFromDate(''); setToDate(''); }}
                  >
                    Limpiar
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={quickDate === 'all' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('all'); setFromDate(''); setToDate(''); }}>Todas</Button>
              <Button variant={quickDate === 'today' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('today'); setFromDate(''); setToDate(''); }}>Hoy</Button>
              <Button variant={quickDate === '7d' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('7d'); setFromDate(''); setToDate(''); }}>Últimos 7 días</Button>
              <Button variant={quickDate === '30d' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('30d'); setFromDate(''); setToDate(''); }}>Últimos 30 días</Button>
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
                Todos ({counts.total || registeredClients.length})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'with_mark'}
                size="sm"
                onClick={() => selectStatus(statusFilter === 'with_mark' ? 'all' : 'with_mark')}
                className={(exclusiveKey === 'with_mark') ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}
              >
                <CheckCircle className="h-3 w-3 mr-1" /> Con Shipping Mark ({counts.withMark})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'without_mark'}
                size="sm"
                onClick={() => selectStatus(statusFilter === 'without_mark' ? 'all' : 'without_mark')}
                className={(exclusiveKey === 'without_mark') ? 'bg-amber-100 text-amber-700 border-amber-200' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}
              >
                <AlertTriangle className="h-3 w-3 mr-1" /> Sin Shipping Mark ({counts.withoutMark})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'pending'}
                size="sm"
                onClick={() => selectStatus(statusFilter === 'pending' ? 'all' : 'pending')}
                className={(exclusiveKey === 'pending') ? 'bg-orange-100 text-orange-700 border-orange-200' : 'border-orange-200 text-orange-700 hover:bg-orange-50'}
              >
                <Clock className="h-3 w-3 mr-1" /> Pendientes ({counts.pending})
              </Button>
              <Button
                variant="outline"
                aria-pressed={exclusiveKey === 'incomplete'}
                size="sm"
                onClick={() => selectStatus(statusFilter === 'incomplete' ? 'all' : 'incomplete')}
                className={(exclusiveKey === 'incomplete') ? 'bg-red-100 text-red-700 border-red-200' : 'border-red-200 text-red-700 hover:bg-red-50'}
              >
                <AlertTriangle className="h-3 w-3 mr-1" /> Con Datos Faltantes ({counts.incomplete})
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
                <UserCheck className="h-3 w-3 mr-1" /> Activos ({counts.active})
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
                <UserX className="h-3 w-3 mr-1" /> Inactivos ({counts.inactive})
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
                <Package className="h-3 w-3 mr-1" /> Con Paquetes ({counts.withPackages})
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
                <Package className="h-3 w-3 mr-1" /> Sin Paquetes ({counts.withoutPackages})
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
                <Phone className="h-3 w-3 mr-1" /> Con WhatsApp ({counts.withWhatsapp})
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
                <Phone className="h-3 w-3 mr-1" /> Sin WhatsApp ({counts.withoutWhatsapp})
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
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-600" />
        )}
      </div>

      {/* Resultados info */}
      {totalFiltered > 0 && (
        <div className="text-sm text-slate-500 mb-2">
          Mostrando <span className="font-semibold">{filteredClients.length}</span> de <span className="font-semibold">{totalFiltered}</span> clientes que coinciden
        </div>
      )}

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
        <>
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
                      {(client.first_name?.[0] || client.email?.[0] || '?').toUpperCase()}
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
                    <Badge variant="outline" className="bg-slate-50">
                      Rol: {client.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1">
                          <Crown className="h-3 w-3 text-amber-500" />
                          {ROLE_PRESETS[client.custom_role]?.role_name || 'Administrador'}
                        </span>
                      ) : 'Cliente'}
                    </Badge>
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
                    {client.created_date && (
                      <Badge variant="outline" className="bg-slate-50">
                        <CalendarDays className="h-3 w-3 mr-1" />
                        {format(new Date(client.created_date), 'dd MMM yyyy', { locale: es })}
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex items-stretch gap-2 w-full">
                    <div className="flex items-center gap-2 pb-2 sm:pb-0 sm:pr-3 sm:border-r border-b sm:border-b-0 border-slate-200">
                      <span className="text-xs text-slate-600">Activo</span>
                      <Switch
                        checked={client.is_active !== false}
                        onCheckedChange={(checked) => handleToggleActive(client, checked)}
                      />
                    </div>
                    <Button 
                     variant="outline" 
                     size="sm"
                     className="w-full sm:w-auto"
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
                     className="w-full sm:w-auto bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Paquete
                    </Button>
                    <Button 
                     variant="outline" 
                     size="sm"
                     className="w-full sm:w-auto"
                     onClick={() => setViewClient(client)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <div className="w-full sm:w-auto min-w-[180px]">
                      <Select
                        value={client.role === 'admin' ? (client.custom_role || 'equipo_y_acceso') : 'user'}
                        onValueChange={(value) => handleChangeRegisteredUserRole(client, value)}
                        disabled={roleUpdatingId === client.id}
                      >
                        <SelectTrigger className="h-9 bg-white">
                          <SelectValue placeholder="Cambiar rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Cliente</SelectItem>
                          <SelectItem value="equipo_y_acceso">👑 Administrador</SelectItem>
                          {ROLE_OPTIONS.filter((role) => role !== 'super_admin_oculto' && role !== 'equipo_y_acceso').map((role) => (
                            <SelectItem key={role} value={role}>{ROLE_PRESETS[role]?.role_name || role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                     variant="outline" 
                     size="sm"
                     className="w-full sm:w-auto"
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
                        className="w-full sm:w-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Stripe
                      </Button>
                    )}
                    <Button 
                     variant="outline" 
                     size="sm"
                     onClick={() => setDeleteClient(client)}
                     className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {hasMore && (
          <Button variant="outline" className="w-full mt-4" onClick={() => loadClients(true)} disabled={loadingMore}>
            {loadingMore ? 'Cargando...' : 'Cargar más'}
          </Button>
        )}
        </>
      )}

      {/* Client Details Modal */}
      <ClientDetailsModal
        client={viewClient}
        open={!!viewClient}
        onClose={() => setViewClient(null)}
        onClientUpdated={loadClients}
      />

      <ClientImportDialog
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImported={loadClients}
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-h-[80vh]">
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

          <DialogFooter className="sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-t border-slate-200">
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