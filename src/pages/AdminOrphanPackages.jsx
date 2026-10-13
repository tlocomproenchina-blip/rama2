import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, UserX, UserCheck, Package, MapPin, Calendar, Trash2, Pencil, AlertTriangle, X, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import useClientSearch from '@/hooks/useClientSearch';
import { useEnabledShippingTypes } from '@/components/ShippingTypeFilter';
import ImageViewerModal from '@/components/common/ImageViewerModal';
import moment from 'moment';
import { useOfflineWriteQueue } from '@/hooks/useOfflineWriteQueue';
import OfflineSyncBadge from '@/components/warehouse/OfflineSyncBadge';
import { getAll } from '@/lib/offlineDb';

const PAGE_SIZE = 50;

// Une las páginas ya cargadas con la nueva, sin repetir cargas.
const mergeRows = (prev, next) => {
  const map = new Map();
  for (const row of [...prev, ...next]) map.set(row.id, row);
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()
  );
};

// Una carga ya tiene dueño cuando trae su correo o su shipping mark de cliente: en
// cuanto se le asigna uno deja de ser huérfana y sale de esta lista, aunque todavía
// quede pendiente el aviso de recepción al mayorista.
const hasOwner = (pkg) => !!String(pkg?.client_email || '').trim() || !!String(pkg?.shipping_mark || '').trim();

export default function AdminOrphanPackages({ user }) {
  const [orphans, setOrphans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // { ids: [], multi: bool }
  const enabledTypes = useEnabledShippingTypes();
  const { query: clientQuery, setQuery: setClientQuery, results: clientResults, setResults: setClientResults, searching: searchingClients } = useClientSearch();
  const [selectedClient, setSelectedClient] = useState(null);
  const [shippingType, setShippingType] = useState('maritimo');
  const [assigning, setAssigning] = useState(false);

  // Multi-select y acciones en lote
  const [selectedIds, setSelectedIds] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [bulkAction, setBulkAction] = useState(null); // 'edit' | 'delete'
  const [bulkEdit, setBulkEdit] = useState({ shipping_type: '', risk_category: '', warehouse_id: '' });
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(null); // { current, total }
  const [viewerImage, setViewerImage] = useState(null); // url de imagen a ampliar
  const [statFilter, setStatFilter] = useState(null); // null | 'pendingAi' | 'notRegistered' | 'unreadable' | 'noPhoto'
  const [aiScanBusy, setAiScanBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState(null); // { processed, total, assigned, unreadable, notFound, errors }
  const [aiFinalSummary, setAiFinalSummary] = useState(null);
  const [aiBudget, setAiBudget] = useState({ credits_used: 0, monthly_budget: 200, route: 'claude_invoke' });
  const [budgetInput, setBudgetInput] = useState('200');
  const [savingBudget, setSavingBudget] = useState(false);

  const { pending: pendingAssigns, isOnline, isSyncing, enqueue: enqueueAssign } = useOfflineWriteQueue({
    queueType: 'orphan_assign',
    processor: async (item) => {
      const { data } = await base44.functions.invoke('assignOrphanPackage', item.payload);
      if (data?.error) throw new Error(data.error);
    },
  });

  const loadOrphans = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const s = reset ? 0 : skip;
      // Sin conexión: servir del cache de IndexedDB (no hay servidor disponible).
      // Con conexión: se espera siempre la lista del servidor, para no pintar primero
      // la copia guardada en el dispositivo (las fotos aparecían y desaparecían).
      if (reset && !navigator.onLine) {
        try {
          const cached = await getAll('packages');
          const cachedOrphans = cached
            .filter(p => p.is_orphan === true && !hasOwner(p))
            .sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())
            .slice(0, PAGE_SIZE);
          setOrphans(cachedOrphans);
          setHasMore(false);
          setSkip(cachedOrphans.length);
        } catch (_) {}
        setLoading(false);
        return;
      }
      const rows = await base44.entities.Package.filter({ is_orphan: true }, '-created_date', PAGE_SIZE, s);
      // Solo huérfanos sin titular: la carga que ya tiene cliente asignado cumplió
      // su ciclo aquí y no vuelve a aparecer en esta lista.
      setOrphans(mergeRows(reset ? [] : orphans, (rows || []).filter((p) => !hasOwner(p))));
      setHasMore(rows.length === PAGE_SIZE);
      setSkip(s + rows.length);
    } catch (e) {
      toast.error('No se pudieron cargar los huérfanos');
    }
    setLoading(false);
  }, [skip, orphans]);

  useEffect(() => { loadOrphans(true); }, []);

  // Cargar configuración de presupuesto IA de AppConfig
  const loadAiBudget = useCallback(async () => {
    try {
      const rows = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      const cfg = rows?.[0] || {};
      const used = typeof cfg.ai_reclaim_credits_used === 'number' ? cfg.ai_reclaim_credits_used : 0;
      const budget = typeof cfg.ai_reclaim_monthly_budget === 'number' ? cfg.ai_reclaim_monthly_budget : 200;
      setAiBudget({ credits_used: used, monthly_budget: budget, route: used >= budget * 0.5 ? 'openai_direct' : 'claude_invoke' });
      setBudgetInput(String(budget));
    } catch (_) {}
  }, []);
  useEffect(() => { loadAiBudget(); }, [loadAiBudget]);

  const saveBudget = async () => {
    const val = Number(budgetInput);
    if (!Number.isFinite(val) || val < 0) { toast.error('Presupuesto inválido'); return; }
    setSavingBudget(true);
    try {
      const rows = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      const cfg = rows?.[0];
      if (!cfg) throw new Error('Config no encontrada');
      await base44.entities.AppConfig.update(cfg.id, { ai_reclaim_monthly_budget: val });
      setAiBudget((prev) => ({ ...prev, monthly_budget: val, route: prev.credits_used >= val * 0.5 ? 'openai_direct' : 'claude_invoke' }));
      toast.success('Presupuesto IA guardado');
    } catch (e) { toast.error('No se pudo guardar el presupuesto'); }
    setSavingBudget(false);
  };

  // Suscripción en tiempo real: una carga sale de la lista en cuanto se le asigna un
  // cliente (correo o shipping mark), sin esperar al aviso de recepción al mayorista.
  useEffect(() => {
    const unsubscribe = base44.entities.Package.subscribe((event) => {
      if (event.type !== 'update') return;
      const updated = event.data;
      if (!updated || !updated.id) return;
      const stillOrphan = updated.is_orphan === true && !hasOwner(updated);
      if (stillOrphan) {
        setOrphans((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        return;
      }
      setOrphans((prev) => prev.filter((p) => p.id !== updated.id));
      setSelectedIds((prev) => prev.filter((id) => id !== updated.id));
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const w = await base44.entities.Warehouse.filter({ is_active: true }, 'name', 100);
        setWarehouses(w || []);
      } catch (_) {}
    })();
  }, []);

  // Estadísticas calculadas de los huérfanos cargados
  const stats = React.useMemo(() => {
    const total = orphans.length;
    let unreadable = 0, notRegistered = 0, pendingAi = 0, noPhoto = 0;
    for (const p of orphans) {
      if (p.ai_unreadable) { unreadable++; continue; }
      if (p.ai_attempted_date) { notRegistered++; continue; }
      const hasPhoto = (Array.isArray(p.package_image_urls) && p.package_image_urls.length > 0) || p.package_image_url;
      if (hasPhoto) pendingAi++;
      else noPhoto++;
    }
    return { total, unreadable, notRegistered, pendingAi, noPhoto };
  }, [orphans]);

  const filtered = orphans.filter((p) => {
    // Filtro por categoría de tarjeta
    if (statFilter) {
      const hasPhoto = (Array.isArray(p.package_image_urls) && p.package_image_urls.length > 0) || p.package_image_url;
      if (statFilter === 'pendingAi' && (p.ai_unreadable || p.ai_attempted_date || !hasPhoto)) return false;
      if (statFilter === 'notRegistered' && (!p.ai_attempted_date || p.ai_unreadable)) return false;
      if (statFilter === 'unreadable' && !p.ai_unreadable) return false;
      if (statFilter === 'noPhoto' && hasPhoto) return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (p.tracking_number || '').toLowerCase().includes(q) || (p.shipping_mark || '').toLowerCase().includes(q);
  });

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.includes(p.id));
  const toggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds((prev) => prev.filter((id) => !filtered.some((p) => p.id === id)));
    else setSelectedIds((prev) => [...new Set([...prev, ...filtered.map((p) => p.id)])]);
  };
  const clearSelection = () => setSelectedIds([]);

  const openAssign = (pkg) => {
    setAssignTarget({ ids: [pkg.id], multi: false });
    setSelectedClient(null);
    setClientQuery('');
    setClientResults([]);
    if (enabledTypes.maritimo) setShippingType('maritimo');
    else if (enabledTypes.aereo) setShippingType('aereo');
  };

  const openBulkAssign = () => {
    if (selectedIds.length === 0) return;
    setAssignTarget({ ids: [...selectedIds], multi: true });
    setSelectedClient(null);
    setClientQuery('');
    setClientResults([]);
    if (enabledTypes.maritimo) setShippingType('maritimo');
    else if (enabledTypes.aereo) setShippingType('aereo');
  };

  const handleAssign = async () => {
    if (!selectedClient || !assignTarget?.ids?.length) return;
    setAssigning(true);
    let ok = 0; let fail = 0; let unified = 0; let conflictMsg = '';
    let recibidos = 0;
    let avisoTxt = '';
    const leavingIds = [];
    for (const id of assignTarget.ids) {
      try {
        if (navigator.onLine) {
          const { data } = await base44.functions.invoke('assignOrphanPackage', {
            package_id: id,
            client_email: selectedClient.email,
            shipping_mark: selectedClient.shipping_mark || undefined,
            shipping_type: shippingType,
          });
          if (data?.error) throw new Error(data.error);
          if (data?.consolidated) unified++;
          if (data?.package?.status === 'recibido') recibidos++;
          // Ya tiene titular: sale de la lista, aunque quede pendiente el aviso de
          // recepción al mayorista (eso se sigue en el panel del mayorista).
          leavingIds.push(id);
          if (data?.aviso_mayorista && !avisoTxt) {
            const a = data.aviso_mayorista;
            avisoTxt = a.enviado
              ? (a.foto_pendiente ? ' · recepción avisada al mayorista, falta la foto' : ' · recepción confirmada al mayorista con foto')
              : (a.ya_avisado ? ' · ya se le había avisado al mayorista'
                : a.sin_mayorista ? ' · carga recibida, pero sin mayorista identificado: no se envió aviso'
                : ` · aviso al mayorista pendiente: ${String(a.mensaje || '').slice(0, 80)}`);
          }
          ok++;
        } else {
          // Sin conexión: la asignación queda en cola y la carga sale de la lista
          // igual, porque ya tiene titular.
          leavingIds.push(id);
          await enqueueAssign({
            payload: {
              package_id: id,
              client_email: selectedClient.email,
              shipping_mark: selectedClient.shipping_mark || undefined,
              shipping_type: shippingType,
            },
          });
          ok++;
        }
      } catch (e) {
        fail++;
        if (!conflictMsg) conflictMsg = e?.message || '';
      }
    }
    // Salen de la lista todos los que quedaron asignados (los que chocaron con un
    // paquete ya recibido se mantienen a la vista, sin asignar).
    setOrphans((prev) => prev.filter((p) => !leavingIds.includes(p.id)));
    setSelectedIds((prev) => prev.filter((id) => !leavingIds.includes(id)));
    const unifiedTxt = unified > 0 ? ` · ${unified} pre-alerta(s) unificada(s)` : '';
    const recibidoTxt = recibidos > 0
      ? (assignTarget.multi ? ` · ${recibidos} recibido(s) en almacén` : ' · quedó recibido en el almacén')
      : '';
    const failTxt = fail > 0 ? ` · ${fail} sin asignar${conflictMsg ? `: ${conflictMsg}` : ''}` : '';
    const msg = assignTarget.multi
      ? `${ok} huérfano(s) asignado(s) a ${selectedClient.email}${recibidoTxt}${unifiedTxt}${avisoTxt}${failTxt}${!isOnline ? ' (offline)' : ''}`
      : (ok > 0
        ? `Huérfano asignado a ${selectedClient.email}${recibidoTxt}${unifiedTxt}${avisoTxt}${!isOnline ? ' (offline)' : ''}`
        : `No se pudo asignar: ${conflictMsg || 'error desconocido'}`);
    if (ok === 0 && fail > 0) toast.error(msg);
    else toast.success(msg);
    setAssignTarget(null);
    setSelectedClient(null);
    setAssigning(false);
  };

  const handleBulkEdit = async () => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    const patch = {};
    if (bulkEdit.shipping_type) patch.shipping_type = bulkEdit.shipping_type;
    if (bulkEdit.risk_category) patch.risk_category = bulkEdit.risk_category;
    if (bulkEdit.warehouse_id) {
      const wh = warehouses.find((w) => w.id === bulkEdit.warehouse_id);
      patch.warehouse_id = bulkEdit.warehouse_id;
      if (wh) {
        patch.warehouse_name = wh.name;
        patch.warehouse_city = wh.city;
        patch.warehouse_country = wh.country;
      }
    }
    let ok = 0; let fail = 0;
    for (const id of selectedIds) {
      try {
        await base44.entities.Package.update(id, patch);
        ok++;
      } catch (e) { fail++; }
    }
    setOrphans((prev) => prev.map((p) => selectedIds.includes(p.id) ? { ...p, ...patch } : p));
    toast.success(`${ok} paquete(s) actualizado(s)${fail > 0 ? ` · ${fail} fallaron` : ''}`);
    setSelectedIds([]);
    setBulkAction(null);
    setBulkEdit({ shipping_type: '', risk_category: '', warehouse_id: '' });
    setBulkProcessing(false);
  };

  const handleAiReclaim = async () => {
    if (aiScanBusy) return;
    setAiScanBusy(true);
    setAiFinalSummary(null);
    setAiProgress({ processed: 0, total: null, assigned: 0, consolidated: 0, merged: 0, conflicts: 0, unreadable: 0, notFound: 0, errors: 0 });

    try {
      let totalAssigned = 0, totalUnreadable = 0, totalNotFound = 0, totalErrors = 0, totalProcessed = 0;
      let totalConsolidated = 0, totalConflicts = 0, totalMerged = 0;
      let totalAvisos = 0, totalAvisosPend = 0;
      let hasMore = true;
      let guard = 0; // safety limit to prevent infinite loops

      while (hasMore && guard < 200) {
        guard++;
        const payload = selectedIds.length > 0 && guard === 1
          ? { only_ids: selectedIds, limit: 3 }
          : { limit: 3 };
        const { data } = await base44.functions.invoke('aiReclaimOrphanPhotos', payload);
        if (data?.error) throw new Error(data.error);

        totalAssigned += data.assigned || 0;
        totalUnreadable += data.unreadable || 0;
        totalNotFound += data.not_found || 0;
        totalErrors += data.errors || 0;
        totalProcessed += data.batch_size || 0;
        totalConsolidated += data.consolidated || 0;
        totalMerged += data.merged || 0;
        totalConflicts += data.conflicts || 0;
        totalAvisos += data.avisos_enviados || 0;
        totalAvisosPend += data.avisos_pendientes || 0;

        // Actualizar presupuesto desde la respuesta del backend
        if (typeof data.credits_used === 'number' || typeof data.credits_budget === 'number' || data.route) {
          setAiBudget((prev) => ({
            credits_used: typeof data.credits_used === 'number' ? data.credits_used : prev.credits_used,
            monthly_budget: typeof data.credits_budget === 'number' ? data.credits_budget : prev.monthly_budget,
            route: data.route || prev.route,
          }));
        }

        setAiProgress({
          processed: totalProcessed,
          total: totalProcessed + (data.remaining || 0),
          assigned: totalAssigned,
          consolidated: totalConsolidated,
          merged: totalMerged,
          conflicts: totalConflicts,
          unreadable: totalUnreadable,
          notFound: totalNotFound,
          errors: totalErrors,
        });

        hasMore = data.has_more === true;
        // Si fue con only_ids, en la segunda iteración ya no filtramos por IDs
        // porque los asignados ya desaparecieron y los unreadable quedaron marcados
        if (guard === 1) setSelectedIds([]);
      }

      setAiFinalSummary({
        assigned: totalAssigned,
        consolidated: totalConsolidated,
        merged: totalMerged,
        conflicts: totalConflicts,
        unreadable: totalUnreadable,
        notFound: totalNotFound,
        errors: totalErrors,
        total: totalProcessed,
      });

      const unifTxt = totalConsolidated > 0 ? ` · ${totalConsolidated} pre-alerta(s) unificada(s)` : '';
      const mergedTxt = totalMerged > 0 ? ` · ${totalMerged} duplicado(s) fusionado(s)` : '';
      const confTxt = totalConflicts > 0 ? ` · ${totalConflicts} en conflicto` : '';
      const avisosTxt = totalAvisos > 0 || totalAvisosPend > 0
        ? ` · ${totalAvisos} recepción(es) avisada(s) al mayorista${totalAvisosPend > 0 ? `, ${totalAvisosPend} pendiente(s) de foto o conexión` : ''}`
        : '';
      if (totalAssigned > 0) {
        toast.success(`IA completada: ${totalAssigned} asignado(s)${unifTxt}${mergedTxt}${avisosTxt} · ${totalUnreadable} no legible(s) · ${totalNotFound} sin coincidencia${confTxt}`);
      } else if (totalProcessed > 0) {
        toast.info(`IA completada: ${totalUnreadable} no legible(s) · ${totalNotFound} sin coincidencia${mergedTxt}${confTxt}${avisosTxt} · ${totalErrors} error(es)`);
      } else {
        toast.info('No hay huérfanos con foto pendientes de escanear');
      }

      // Invalidar cache del ApiQueueManager para que los campos ai_unreadable /
      // ai_attempted_date se lean frescos desde el servidor (no de copia stale)
      if (typeof base44.invalidateEntityCache === 'function') {
        base44.invalidateEntityCache('Package');
      }
      setSkip(0);
      loadOrphans(true);
    } catch (e) {
      toast.error('Error al ejecutar el escaneo IA: ' + (e?.message || 'desconocido'));
    } finally {
      setAiScanBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    const ids = [...selectedIds];
    const total = ids.length;
    let ok = 0; let fail = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      setDeleteProgress({ current: i + 1, total });
      try {
        await base44.entities.Package.delete(id);
        ok++;
        // Elimina el paquete de la lista inmediatamente (feedback en tiempo real)
        setOrphans((prev) => prev.filter((p) => p.id !== id));
      } catch (e) { fail++; }
    }
    setSelectedIds([]);
    setBulkAction(null);
    setDeleteProgress(null);
    toast.success(`${ok} paquete(s) eliminado(s)${fail > 0 ? ` · ${fail} fallaron` : ''}`);
    setBulkProcessing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2"><UserX className="h-7 w-7 text-amber-600" /> Paquetes Huérfanos</h1>
          <p className="text-slate-500">Trackings recibidos sin pre-alerta. Asignalos a un cliente o espera a que el cliente los reclame con su pre-alerta.</p>
          <div className="mt-2"><OfflineSyncBadge pendingCount={pendingAssigns.length} isOnline={isOnline} isSyncing={isSyncing} onRetry={() => {}} /></div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={aiBudget.route === 'claude_invoke'
                ? 'gap-1 border-green-200 bg-green-50 text-green-700'
                : 'gap-1 border-amber-300 bg-amber-50 text-amber-700'}
              title={aiBudget.route === 'claude_invoke'
                ? 'Usando Claude Sonnet 4.6 (consume créditos de integración)'
                : 'Presupuesto al 50% — usando OpenAI directo (no consume créditos de integración)'}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${aiBudget.route === 'claude_invoke' ? 'bg-green-500' : 'bg-amber-500'}`} />
              {aiBudget.route === 'claude_invoke' ? 'Claude Sonnet' : 'OpenAI (fallback)'}
            </Badge>
            <Button
              onClick={handleAiReclaim}
              disabled={aiScanBusy || (orphans.length === 0 && selectedIds.length === 0)}
              variant="outline"
              className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
              title="Usa IA para leer el tracking de cada foto huérfana y asignarla al cliente si existe una pre-alerta con ese tracking. Procesa en lotes automáticos de 3."
            >
              {aiScanBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiScanBusy
                ? `Procesando ${aiProgress?.processed || 0}${aiProgress?.total ? `/${aiProgress.total}` : ''}...`
                : `Reclamar con IA${selectedIds.length > 0 ? ` (${selectedIds.length})` : ' (todos)'}`}
            </Button>
          </div>
          {aiScanBusy && aiProgress && (
            <div className="text-xs text-slate-600 text-right max-w-xs bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
              <div className="flex flex-wrap gap-3 justify-end">
                <span className="text-green-600 font-medium">{aiProgress.assigned} asignados</span>
                <span className="text-blue-600 font-medium">{aiProgress.consolidated || 0} pre-alertas unificadas</span>
                {(aiProgress.merged || 0) > 0 && <span className="text-teal-600 font-medium">{aiProgress.merged} duplicado(s) fusionado(s)</span>}
                {(aiProgress.conflicts || 0) > 0 && <span className="text-amber-600">{aiProgress.conflicts} en conflicto</span>}
                <span className="text-red-500">{aiProgress.unreadable} no legibles</span>
                <span className="text-slate-500">{aiProgress.notFound} sin coincidencia</span>
              </div>
            </div>
          )}
          {!aiScanBusy && aiFinalSummary && (
            <div className="text-xs text-slate-600 text-right max-w-xs bg-slate-50 border rounded-lg px-3 py-1.5">
              <span className="font-medium text-slate-700">Resumen IA:</span>{' '}
              <span className="text-green-600 font-medium">{aiFinalSummary.assigned} asignados</span>
              {aiFinalSummary.consolidated > 0 && (
                <>
                  {' · '}
                  <span className="text-blue-600 font-medium">{aiFinalSummary.consolidated} pre-alerta(s) unificada(s)</span>
                </>
              )}
              {aiFinalSummary.merged > 0 && (
                <>
                  {' · '}
                  <span className="text-teal-600 font-medium">{aiFinalSummary.merged} duplicado(s) fusionado(s)</span>
                </>
              )}
              {aiFinalSummary.conflicts > 0 && (
                <>
                  {' · '}
                  <span className="text-amber-600">{aiFinalSummary.conflicts} en conflicto</span>
                </>
              )}
              {' · '}
              <span className="text-red-500">{aiFinalSummary.unreadable} no legibles</span>
              {' · '}
              <span className="text-slate-500">{aiFinalSummary.notFound} sin coincidencia</span>
              {aiFinalSummary.errors > 0 && <> · <span className="text-red-500">{aiFinalSummary.errors} errores</span></>}
            </div>
          )}
        </div>
      </div>

      {/* Estadísticas de huérfanos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card
          className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${statFilter === null ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-100'}`}
          onClick={() => setStatFilter(null)}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2 shrink-0"><UserX className="h-5 w-5 text-amber-600" /></div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">Sin cliente</p>
              <p className="text-xl font-bold text-slate-800">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${statFilter === 'pendingAi' ? 'border-purple-400 ring-2 ring-purple-200' : 'border-purple-100'}`}
          onClick={() => setStatFilter(statFilter === 'pendingAi' ? null : 'pendingAi')}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2 shrink-0"><Sparkles className="h-5 w-5 text-purple-600" /></div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">Pendientes IA</p>
              <p className="text-xl font-bold text-slate-800">{stats.pendingAi}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${statFilter === 'notRegistered' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-200'}`}
          onClick={() => setStatFilter(statFilter === 'notRegistered' ? null : 'notRegistered')}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 shrink-0"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">No registrados</p>
              <p className="text-xl font-bold text-slate-800">{stats.notRegistered}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${statFilter === 'unreadable' ? 'border-red-400 ring-2 ring-red-200' : 'border-red-100'}`}
          onClick={() => setStatFilter(statFilter === 'unreadable' ? null : 'unreadable')}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2 shrink-0"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">No legibles IA</p>
              <p className="text-xl font-bold text-slate-800">{stats.unreadable}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${statFilter === 'noPhoto' ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-200'}`}
          onClick={() => setStatFilter(statFilter === 'noPhoto' ? null : 'noPhoto')}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2 shrink-0"><Package className="h-5 w-5 text-slate-500" /></div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">Sin foto</p>
              <p className="text-xl font-bold text-slate-800">{stats.noPhoto}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel de presupuesto IA */}
      <Card className="shadow-sm border-purple-100">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <p className="text-sm font-medium text-slate-700">Presupuesto IA de reclamo (créditos de integración)</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Label className="text-xs text-slate-500 whitespace-nowrap">Presupuesto mensual</Label>
              <Input
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-24 h-9"
                min={0}
              />
              <Button size="sm" variant="outline" onClick={saveBudget} disabled={savingBudget} className="h-9">
                {savingBudget ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
              </Button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>{aiBudget.credits_used} / {aiBudget.monthly_budget} créditos usados</span>
                <span className={aiBudget.route === 'openai_direct' ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                  {aiBudget.route === 'openai_direct' ? 'Fallback OpenAI activo' : `Conmuta a OpenAI al ${(aiBudget.monthly_budget * 0.5).toFixed(0)} (50%)`}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all ${aiBudget.route === 'openai_direct' ? 'bg-amber-500' : 'bg-purple-500'}`}
                  style={{ width: `${Math.min(100, (aiBudget.monthly_budget > 0 ? (aiBudget.credits_used / aiBudget.monthly_budget) * 100 : 0))}%` }}
                />
                {/* Marcador del 50% */}
                <div className="absolute top-0 bottom-0 w-px bg-amber-400" style={{ left: '50%' }} title="Umbral de conmutación (50%)" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar por tracking o shipping mark..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      {/* Barra de selección múltiple */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-2">
            <Checkbox id="select-all-orphans" checked={allSelected} onCheckedChange={toggleSelectAll} />
            <Label htmlFor="select-all-orphans" className="text-sm text-slate-600 cursor-pointer">
              {allSelected ? 'Quitar selección' : 'Seleccionar todos'}
            </Label>
          </div>
          {selectedIds.length > 0 && (
            <>
              <Badge variant="secondary" className="text-amber-700 bg-amber-50 border-amber-200">{selectedIds.length} seleccionado(s)</Badge>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <Button size="sm" onClick={openBulkAssign} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                  <UserCheck className="h-4 w-4" /> Asignar ({selectedIds.length})
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('edit')} className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50">
                  <Pencil className="h-4 w-4" /> Modificar ({selectedIds.length})
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('delete')} className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" /> Borrar ({selectedIds.length})
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection} className="text-slate-500 gap-1">
                  <X className="h-4 w-4" /> Limpiar
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {loading && orphans.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-slate-500">
          <UserX className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No hay paquetes huérfanos</p>
          <p className="text-sm">Los paquetes que lleguen sin pre-alerta aparecerán aquí.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <Card key={p.id} className={`shadow-sm transition-colors ${checked ? 'border-amber-300 bg-amber-50/40' : 'border-amber-100'}`}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-center gap-3 shrink-0">
                    <Checkbox checked={checked} onCheckedChange={() => toggleSelect(p.id)} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Package className={`h-4 w-4 shrink-0 ${p.ai_unreadable ? 'text-red-500' : 'text-amber-600'}`} />
                      <span className={`font-mono font-semibold break-all ${p.ai_unreadable ? 'text-red-600' : 'text-slate-800'}`}>{p.tracking_number}</span>
                      {p.is_orphan ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Sin cliente</Badge>
                      ) : (
                        <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50 gap-1">
                          <AlertTriangle className="h-3 w-3" /> Asignado · en seguimiento
                        </Badge>
                      )}
                      <Badge variant="secondary">{p.shipping_type === 'maritimo' ? 'Marítimo' : 'Aéreo'}</Badge>
                      {p.shipping_mark && <Badge variant="outline">SM: {p.shipping_mark}</Badge>}
                      {p.ai_unreadable && (
                        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 gap-1">
                          <AlertTriangle className="h-3 w-3" /> No legible por IA
                        </Badge>
                      )}
                      {!p.ai_unreadable && p.ai_attempted_date && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 gap-1">
                          <AlertTriangle className="h-3 w-3" /> No registrado
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {p.warehouse_name && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.warehouse_name}{p.warehouse_location_code ? ` · ${p.warehouse_location_code}` : ''}</span>}
                      {!p.is_orphan && p.client_email && <span className="truncate max-w-[200px]">{p.client_email}</span>}
                      {p.actual_weight_kg && <span>{p.actual_weight_kg} kg</span>}
                      {p.actual_cbm && <span>{p.actual_cbm.toFixed(4)} CBM</span>}
                      {p.received_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{moment(p.received_date).format('DD/MM/YYYY')}</span>}
                      {p.description && <span className="truncate max-w-[200px]">· {p.description}</span>}
                    </div>
                    {p.package_image_urls?.length > 0 && (
                      <div className="flex gap-1.5 mt-1">
                        {p.package_image_urls.map((url, i) => (
                          <button key={i} type="button" onClick={() => setViewerImage(url)} className="block rounded-md border overflow-hidden hover:ring-2 hover:ring-blue-400 transition" title="Ver foto">
                            <img src={url} alt={`Foto ${i + 1}`} className="h-12 w-12 object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={() => openAssign(p)} className="bg-blue-600 hover:bg-blue-700 gap-2 shrink-0">
                    <UserCheck className="h-4 w-4" /> Asignar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {hasMore && !search && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => loadOrphans(false)} disabled={loading}>Cargar más</Button>
            </div>
          )}
        </div>
      )}

      {/* Modal de asignación (individual o lote) */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-0 md:p-4 md:pt-20" onClick={() => setAssignTarget(null)}>
          <Card className="w-full md:max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="h-5 w-5 text-blue-600" />
                {assignTarget.multi ? `Asignar ${assignTarget.ids.length} huérfanos` : 'Asignar huérfano'}
              </CardTitle>
              {assignTarget.multi ? (
                <p className="text-sm text-slate-500">Se asignarán los {assignTarget.ids.length} paquetes seleccionados al mismo cliente.</p>
              ) : (
                <p className="text-sm text-slate-500 font-mono break-all">{orphans.find((p) => p.id === assignTarget.ids[0])?.tracking_number}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedClient ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Buscar cliente</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Nombre, email o shipping mark..." value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} className="pl-10" autoFocus />
                    {searchingClients && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}
                  </div>
                  {clientResults.length > 0 && (
                    <div className="border rounded-lg max-h-60 overflow-y-auto divide-y">
                      {clientResults.map((c) => (
                        <button key={c.id} onClick={() => { setSelectedClient(c); setClientQuery(''); setClientResults([]); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">{c.full_name || c.first_name || c.email}</p>
                            <p className="text-xs text-slate-500 truncate">{c.email}</p>
                          </div>
                          {c.shipping_mark && <Badge variant="outline" className="text-[10px] ml-2 shrink-0">{c.shipping_mark}</Badge>}
                        </button>
                      ))}
                    </div>
                  )}
                  {clientQuery.length >= 2 && !searchingClients && clientResults.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-2">No se encontraron clientes</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 bg-slate-50 border rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{selectedClient.full_name || selectedClient.first_name || selectedClient.email}</p>
                      <p className="text-xs text-slate-500 truncate">{selectedClient.email} {selectedClient.shipping_mark ? `· ${selectedClient.shipping_mark}` : ''}</p>
                    </div>
                    <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-red-500 text-sm shrink-0">Cambiar</button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tipo de envío</Label>
                    <Select value={shippingType} onValueChange={setShippingType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {enabledTypes.aereo && <SelectItem value="aereo">Aéreo</SelectItem>}
                        {enabledTypes.maritimo && <SelectItem value="maritimo">Marítimo</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancelar</Button>
                <Button onClick={handleAssign} disabled={!selectedClient || assigning} className="bg-blue-600 hover:bg-blue-700 gap-2">
                  {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                  {assignTarget.multi ? `Asignar ${assignTarget.ids.length}` : 'Asignar huérfano'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de edición en lote */}
      {bulkAction === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-0 md:p-4 md:pt-20" onClick={() => !bulkProcessing && setBulkAction(null)}>
          <Card className="w-full md:max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Pencil className="h-5 w-5 text-amber-600" /> Modificar {selectedIds.length} huérfano(s)</CardTitle>
              <p className="text-sm text-slate-500">Deja un campo vacío para no cambiarlo.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de envío</Label>
                <Select value={bulkEdit.shipping_type} onValueChange={(v) => setBulkEdit((prev) => ({ ...prev, shipping_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sin cambiar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aereo">Aéreo</SelectItem>
                    <SelectItem value="maritimo">Marítimo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de carga</Label>
                <Select value={bulkEdit.risk_category} onValueChange={(v) => setBulkEdit((prev) => ({ ...prev, risk_category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sin cambiar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="alto_riesgo">Alto riesgo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {warehouses.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Almacén</Label>
                  <Select value={bulkEdit.warehouse_id} onValueChange={(v) => setBulkEdit((prev) => ({ ...prev, warehouse_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sin cambiar" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name} · {w.city}, {w.country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setBulkAction(null)} disabled={bulkProcessing}>Cancelar</Button>
                <Button onClick={handleBulkEdit} disabled={bulkProcessing || (!bulkEdit.shipping_type && !bulkEdit.risk_category && !bulkEdit.warehouse_id)} className="bg-amber-600 hover:bg-amber-700 gap-2">
                  {bulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                  Aplicar a {selectedIds.length}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Diálogo de borrado en lote */}
      {bulkAction === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-0 md:p-4 md:pt-20" onClick={() => !bulkProcessing && setBulkAction(null)}>
          <Card className="w-full md:max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-red-50 rounded-full shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">¿Borrar {selectedIds.length} huérfano(s)?</h3>
                  <p className="text-sm text-slate-500 mt-1">Esta acción es permanente. Los paquetes seleccionados se eliminarán del sistema y no podrán reclamarse después.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setBulkAction(null)} disabled={bulkProcessing}>Cancelar</Button>
                <Button onClick={handleBulkDelete} disabled={bulkProcessing} variant="destructive" className="gap-2">
                  {bulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {bulkProcessing && deleteProgress
                    ? `Borrando ${deleteProgress.current}/${deleteProgress.total}...`
                    : `Sí, borrar ${selectedIds.length}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ImageViewerModal
        open={!!viewerImage}
        imageUrl={viewerImage}
        onClose={() => setViewerImage(null)}
        title="Foto del paquete huérfano"
      />
    </div>
  );
}