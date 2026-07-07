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
import BulkProgressIndicator from '@/components/admin/packages/BulkProgressIndicator';
import ClientsFiltersMobileTrigger from '@/components/admin/clients/ClientsFiltersMobileTrigger';
import ClientsList from '@/components/admin/clients/ClientsList';
import AddPackageDialog from '@/components/admin/clients/AddPackageDialog';
import EditClientDialog from '@/components/admin/clients/EditClientDialog';
import DeleteClientDialog from '@/components/admin/clients/DeleteClientDialog';
import useClientExports from '@/hooks/useClientExports';
import useAddClientPackage from '@/hooks/useAddClientPackage';

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
  const [stateConfigs, setStateConfigs] = useState([]);
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

  // Hooks especializados (extraídos para mantener este archivo enfocado)
  const { bulkProgress, handleExportRemarketing, handleExportFiltered } = useClientExports({
    debouncedSearch, exclusiveKey, stateFilter, fromDate, toDate, quickDate,
  });
  const {
    addingPackage, setAddingPackage,
    packageClient, setPackageClient,
    newPackage, setNewPackage,
    uploadingImage,
    saving: addPackageSaving,
    openAddPackage,
    handleImageUpload,
    handleAddPackage,
  } = useAddClientPackage({
    user,
    onPackageAdded: (email) => setPackagesCount((prev) => ({ ...prev, [email]: (prev[email] || 0) + 1 })),
  });

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

  const loadClients = async (append = false, forceRefresh = false) => {
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
        forceRefresh,
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
      // Refrescar counts globales (pendientes, con/sin shipping mark) tras editar
      loadClients(false, true);
    } catch (error) {
      toast.error('Error al guardar');
    }
    setSaving(false);
  };

  const handleCopyClientInfo = (client) => {
    const info = `Nombre: ${client.first_name || ''} ${client.last_name || ''}
Cédula: ${client.cedula || 'N/A'}
Estado: ${client.state || 'N/A'}
Ciudad: ${client.city || 'N/A'}
Dirección: ${client.address || 'N/A'}
WhatsApp: ${client.whatsapp || 'N/A'}
Email: ${client.email}
Shipping Mark: ${client.shipping_mark || 'N/A'}`;
    
    navigator.clipboard.writeText(info);
    toast.success('Información copiada al portapapeles');
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
        onExportFiltered={handleExportFiltered}
        onExportRemarketing={handleExportRemarketing}
        onBackfillStripe={handleBackfillStripeCustomers}
      />

      <ClientsStatsCards counts={counts} fallbackTotal={clients.length} />

      <BulkProgressIndicator progress={bulkProgress} />

      <ClientsFiltersMobileTrigger
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
        onAddPackage={openAddPackage}
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
        saving={addPackageSaving}
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