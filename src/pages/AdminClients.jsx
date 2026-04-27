import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ClientDetailsModal from '@/components/admin/ClientDetailsModal';
import ClientImportDialog from '@/components/imports/ClientImportDialog';
import { getDigits, sanitizeClientProfileData } from '@/lib/inputSanitizers';
import ClientsHeaderActions from '@/components/admin/clients/ClientsHeaderActions';
import ClientsStatsCards from '@/components/admin/clients/ClientsStatsCards';
import ClientsFiltersPanel from '@/components/admin/clients/ClientsFiltersPanel';
import ClientsList from '@/components/admin/clients/ClientsList';
import AddPackageDialog from '@/components/admin/clients/AddPackageDialog';
import EditClientDialog from '@/components/admin/clients/EditClientDialog';
import DeleteClientDialog from '@/components/admin/clients/DeleteClientDialog';

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
      <ClientsHeaderActions
        canExport={canExport}
        backfilling={backfilling}
        onOpenImport={() => setImportModalOpen(true)}
        onExportFiltered={handleExportFilteredClients}
        onExportRemarketing={handleExportClients}
        onBackfillStripe={handleBackfillStripeCustomers}
      />

      <ClientsStatsCards counts={counts} fallbackTotal={clients.length} />

      <ClientsFiltersPanel
        fromDate={fromDate} setFromDate={setFromDate}
        toDate={toDate} setToDate={setToDate}
        quickDate={quickDate} setQuickDate={setQuickDate}
        exclusiveKey={exclusiveKey}
        counts={counts}
        registeredCount={registeredClients.length}
        statusFilter={statusFilter}
        activeFilter={activeFilter}
        packageFilter={packageFilter}
        whatsappFilter={whatsappFilter}
        selectStatus={selectStatus}
        selectActive={selectActive}
        selectPackage={selectPackage}
        selectWhatsapp={selectWhatsapp}
        stateFilter={stateFilter}
        setStateFilter={setStateFilter}
        stateConfigs={stateConfigs}
        onResetFilters={resetAllFilters}
      />

      {/* Quick Search */}
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

      <ClientsList
        clients={filteredClients}
        packagesCount={packagesCount}
        roleUpdatingId={roleUpdatingId}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={() => loadClients(true)}
        onCopyInfo={handleCopyClientInfo}
        onAddPackage={(client) => { setPackageClient(client); setAddingPackage(true); }}
        onView={(client) => setViewClient(client)}
        onEdit={handleEdit}
        onDelete={(client) => setDeleteClient(client)}
        onDeleteStripeCustomer={handleDeleteStripeCustomer}
        onToggleActive={handleToggleActive}
        onChangeRole={handleChangeRegisteredUserRole}
      />

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

      <AddPackageDialog
        open={addingPackage}
        onOpenChange={setAddingPackage}
        packageClient={packageClient}
        newPackage={newPackage}
        setNewPackage={setNewPackage}
        uploadingImage={uploadingImage}
        onImageUpload={handleImageUpload}
        saving={saving}
        onSubmit={handleAddPackage}
      />

      <DeleteClientDialog
        deleteClient={deleteClient}
        deleting={deleting}
        onClose={() => setDeleteClient(null)}
        onConfirm={handleDelete}
      />

      <EditClientDialog
        open={!!editClient}
        onOpenChange={() => setEditClient(null)}
        editData={editData}
        setEditData={setEditData}
        stateConfigs={stateConfigs}
        saving={saving}
        onSave={handleSave}
      />
    </div>
  );
}