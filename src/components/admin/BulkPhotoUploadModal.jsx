import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, CheckCircle, AlertCircle, Image as ImageIcon, X, Search, User, AlertTriangle, Copy, FileText, Box, FileImage, ScanLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';

function extractTrackingFromFilename(filename) {
  // Remove extension
  const name = filename.replace(/\.(jpg|jpeg|png|gif|webp|bmp|heic|heif)$/i, '');
  // Only strip explicit multi-photo suffixes: _1, _2, -1, -2, (1), (2), _front, -back, etc.
  // The separator (_  or -) is REQUIRED so bare trailing digits are NOT removed.
  return name.replace(/[_-](\d{1,2}|front|back|lado|frente|atras)$/i, '').trim().replace(/\s+/g, '');
}

function getTrackingOverlapScore(a = '', b = '') {
  const left = String(a).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const right = String(b).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!left || !right) return 0;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  for (let size = shorter.length; size >= 9; size -= 1) {
    for (let start = 0; start <= shorter.length - size; start += 1) {
      const chunk = shorter.slice(start, start + size);
      if (longer.includes(chunk)) return size;
    }
  }
  return 0;
}

function SelectClientInline({ tracking, options, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 min-h-10 w-full rounded-xl border border-border/80 bg-white/90 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring"
    >
      <option value="">Selecciona cliente para {tracking}</option>
      {(options || []).map((user) => (
        <option key={user.id} value={user.email}>
          {(user.full_name || user.first_name || user.email)}{user.shipping_mark ? ` · ${user.shipping_mark}` : ''}
        </option>
      ))}
    </select>
  );
}

export default function BulkPhotoUploadModal({ open, onOpenChange, onCompleted }) {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedClientsByTracking, setSelectedClientsByTracking] = useState({});
  const [searchingClients, setSearchingClients] = useState(false);
  const searchTimeout = useRef(null);

  const [trackingMode, setTrackingMode] = useState('filename'); // 'filename' | 'scanner'
  // Scanner mode: list of trackings entered via barcode scanner
  const [scannerTrackingList, setScannerTrackingList] = useState([]);
  const [scannerStatusByCode, setScannerStatusByCode] = useState({});
  const [scannerExistingPkgs, setScannerExistingPkgs] = useState({});
  const [scannerCameraOpen, setScannerCameraOpen] = useState(false);

  const reset = () => {
    setFiles([]);
    setResults(null);
    setProgress(0);
    setClientSearch('');
    setClientResults([]);
    setSelectedClient(null);
    setSelectedClientsByTracking({});
    setCbmValue('');
    setInvoiceNumber('');
    setBarcodeResults({});
    setTrackingMode('filename');
    setScannerTrackingList([]);
    setScannerStatusByCode({});
    setScannerExistingPkgs({});
    setScannerCameraOpen(false);
  };

  useEffect(() => {
    if (!clientSearch || clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchingClients(true);
      try {
        let allUsers = [];
        let skip = 0;
        while (true) {
          const batch = await base44.entities.User.list('-created_date', 200, skip);
          if (!batch || batch.length === 0) break;
          allUsers = allUsers.concat(batch);
          if (batch.length < 200) break;
          skip += 200;
        }
        const q = clientSearch.toLowerCase();
        const matches = allUsers.filter(u => u.role === 'user' && (
          (u.full_name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.shipping_mark || '').toLowerCase().includes(q) ||
          (u.first_name || '').toLowerCase().includes(q) ||
          (u.last_name || '').toLowerCase().includes(q)
        )).slice(0, 10);
        setClientResults(matches);
      } catch (_) {
        setClientResults([]);
      }
      setSearchingClients(false);
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [clientSearch]);

  const handleFileSelect = async (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
    setResults(null);
    setBarcodeResults({});
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Scanner mode: check tracking exists
  const checkScannerTracking = async (value) => {
    const t = String(value || '').trim();
    if (!t || t.length < 5) return;
    setScannerStatusByCode((prev) => ({ ...prev, [t]: { state: 'checking', message: 'Revisando...' } }));
    try {
      const existing = await base44.entities.Package.filter({ tracking_number: t }, '-created_date', 1);
      const pkg = existing?.[0];
      if (pkg) {
        setScannerExistingPkgs((prev) => ({ ...prev, [t]: pkg }));
        setScannerStatusByCode((prev) => ({ ...prev, [t]: { state: 'exists', message: `Se marcará como recibido. Cliente: ${pkg.client_email} · Estado: ${pkg.status}` } }));
      } else {
        setScannerExistingPkgs((prev) => { const n = { ...prev }; delete n[t]; return n; });
        setScannerStatusByCode((prev) => ({ ...prev, [t]: { state: 'not_found', message: 'No existe en el sistema. Debe tener pre-alerta primero.' } }));
      }
    } catch {
      setScannerStatusByCode((prev) => ({ ...prev, [t]: { state: 'error', message: 'No se pudo validar.' } }));
    }
  };

  const handleScannerDetected = (code) => {
    const t = String(code || '').trim();
    if (!t) return;
    setScannerTrackingList((prev) => {
      if (prev.includes(t)) { toast.info('Tracking ya agregado'); return prev; }
      return [...prev, t];
    });
    checkScannerTracking(t);
  };

  // Scanner mode: process all trackings
  const handleScannerProcess = async () => {
    const validTrackings = scannerTrackingList.filter((t) => scannerExistingPkgs[t]);
    if (validTrackings.length === 0) {
      toast.error('Ninguno de los trackings existe en el sistema.');
      return;
    }
    setProcessing(true);
    setProgress(0);
    const resultsList = [];
    let imageUrls = [];
    if (files.length > 0) {
      for (const f of files.slice(0, 3)) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        imageUrls.push(file_url);
      }
    }
    for (let i = 0; i < validTrackings.length; i++) {
      const tracking = validTrackings[i];
      const pkg = scannerExistingPkgs[tracking];
      try {
        const response = await base44.functions.invoke('processReceptionPhoto', {
          tracking_number: tracking,
          client_email: pkg.client_email,
          package_image_url: imageUrls[0] || null,
          skip_email: true,
        });
        resultsList.push({ tracking, status: 'updated', photos: imageUrls.length, clientName: pkg.client_email, markedReceived: true });
      } catch (err) {
        resultsList.push({ tracking, status: 'error', photos: 0, clientName: null, error: err?.message || 'Error' });
      }
      setProgress(Math.round(((i + 1) / validTrackings.length) * 100));
    }
    const ignored = scannerTrackingList.filter((t) => !scannerExistingPkgs[t]);
    for (const t of ignored) {
      resultsList.push({ tracking: t, status: 'not_found', photos: 0, clientName: null });
    }
    setResults(resultsList);
    setProcessing(false);
    const ok = resultsList.filter(r => r.status === 'updated').length;
    const fail = resultsList.filter(r => r.status !== 'updated').length;
    if (ok > 0) toast.success(`${ok} paquete(s) marcado(s) como recibido(s)`);
    if (fail > 0) toast.warning(`${fail} tracking(s) ignorado(s) o con error`);
    if (typeof onCompleted === 'function') onCompleted();
  };

  const removeTrackingGroup = (trackingKey) => {
    setFiles(prev => prev.filter(f => extractTrackingFromFilename(f.name) !== trackingKey));
  };

  // --- Duplicate check state ---
  const [duplicateWarnings, setDuplicateWarnings] = useState({});
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  // CBM Ingreso fields
  const [cbmValue, setCbmValue] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  // Barcode scanner (kept for compatibility, but no AI scanning)
  const [barcodeResults, setBarcodeResults] = useState({});

  // Group files by tracking number (filename-based)
  const grouped = files.reduce((acc, file) => {
    const tracking = extractTrackingFromFilename(file.name);
    if (!acc[tracking]) acc[tracking] = [];
    acc[tracking].push(file);
    return acc;
  }, {});

  // Check for existing trackings when files or barcode results change
  const groupedKeys = Object.keys(grouped);
  const groupedKeysStr = groupedKeys.join(',');
  useEffect(() => {
    if (groupedKeys.length === 0) {
      setDuplicateWarnings({});
      return;
    }
    let cancelled = false;
    const checkDups = async () => {
      setCheckingDuplicates(true);
      const dups = {};
      for (let i = 0; i < groupedKeys.length; i += 10) {
        const batch = groupedKeys.slice(i, i + 10);
        const checks = batch.map(async (tn) => {
          try {
            const existing = await base44.entities.Package.filter({ tracking_number: tn }, '-created_date', 1);
            if (existing && existing.length > 0) {
              return { tn, pkg: existing[0] };
            }
          } catch (_) {}
          return null;
        });
        const results = await Promise.all(checks);
        if (cancelled) return;
        results.forEach(r => {
          if (r) dups[r.tn] = r.pkg;
        });
      }
      if (!cancelled) {
        setDuplicateWarnings(dups);
        setCheckingDuplicates(false);
      }
    };
    checkDups();
    return () => { cancelled = true; };
  }, [groupedKeysStr]);

  const duplicateCount = Object.keys(duplicateWarnings).length;

  const handleProcess = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setResults(null);
    setProgress(0);

    const trackings = Object.keys(grouped);
    const total = trackings.length;
    const resultsList = [];

    const usersByEmail = {};
    clientResults.filter(u => u.role === 'user').forEach(u => { usersByEmail[u.email] = u; });
    if (selectedClient?.email) {
      usersByEmail[selectedClient.email] = selectedClient;
    }

    // If a client is selected, filter only their packages
    const clientFilter = selectedClient ? selectedClient.email : null;

    for (let i = 0; i < trackings.length; i++) {
      const tracking = trackings[i];
      const photos = grouped[tracking].slice(0, 3); // max 3 photos per tracking

      try {
        const imageUrls = [];
        for (const photo of photos) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: photo });
          imageUrls.push(file_url);
        }

        const existing = await base44.entities.Package.filter({ tracking_number: tracking }, '-created_date', 1);
        const assignedClientEmail = selectedClientsByTracking[tracking] || clientFilter || '';

        if (!existing?.[0] && !assignedClientEmail) {
          resultsList.push({
            tracking,
            status: 'missing_client',
            photos: imageUrls.length,
            clientName: null,
            markedReceived: false
          });
        } else {
          const response = await base44.functions.invoke('processReceptionPhoto', {
            tracking_number: tracking,
            client_email: assignedClientEmail,
            package_image_url: imageUrls[0] || null,
            skip_email: true,
          });

          const processedPackage = response?.data?.package;
          const client = usersByEmail[processedPackage?.client_email] || usersByEmail[assignedClientEmail];

          resultsList.push({
            tracking,
            status: response?.data?.created ? 'created' : 'updated',
            photos: imageUrls.length,
            clientName: client?.full_name || client?.first_name || processedPackage?.client_email || assignedClientEmail,
            markedReceived: true
          });
        }
      } catch (err) {
        resultsList.push({
          tracking,
          status: 'error',
          photos: 0,
          clientName: null,
          error: err?.message || 'Error desconocido'
        });
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    // Create or update CbmIngreso record for ALL processed trackings
    if (cbmValue && parseFloat(cbmValue) > 0) {
      const successTrackings = resultsList
        .filter(r => r.status === 'updated' || r.status === 'created')
        .map(r => r.tracking);
      if (successTrackings.length > 0) {
        const now = new Date();
        const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const firstSuccess = resultsList.find(r => r.status === 'updated' || r.status === 'created');
        const clientEmail = clientFilter || '';
        const clientUser = clientEmail ? usersByEmail[clientEmail] : null;
        try {
          // If invoice_number is provided, check if a CbmIngreso already exists
          let existingCbm = null;
          if (invoiceNumber.trim()) {
            const existing = await base44.entities.CbmIngreso.filter({ invoice_number: invoiceNumber.trim() }, '-created_date', 1);
            if (existing && existing.length > 0) existingCbm = existing[0];
          }

          if (existingCbm) {
            // Merge trackings (add only new ones)
            const existingTrackings = Array.isArray(existingCbm.tracking_numbers) ? existingCbm.tracking_numbers : [];
            const merged = [...new Set([...existingTrackings, ...successTrackings])];
            await base44.entities.CbmIngreso.update(existingCbm.id, {
              cbm: parseFloat(cbmValue),
              tracking_numbers: merged,
              descripcion: `Ingreso masivo - ${merged.length} tracking(s)`,
              ...(clientEmail ? { client_email: clientEmail } : {}),
              ...(clientUser ? { client_name: clientUser.full_name || clientUser.first_name || clientEmail, shipping_mark: clientUser.shipping_mark || '' } : {}),
            });
            toast.info(`Factura ${invoiceNumber.trim()} actualizada con ${successTrackings.length} tracking(s) nuevos`);
          } else {
            await base44.entities.CbmIngreso.create({
              fecha: now.toISOString(),
              cbm: parseFloat(cbmValue),
              mes,
              client_email: clientEmail,
              client_name: clientUser?.full_name || clientUser?.first_name || firstSuccess?.clientName || clientEmail,
              shipping_mark: clientUser?.shipping_mark || '',
              tracking_numbers: successTrackings,
              invoice_number: invoiceNumber.trim() || undefined,
              descripcion: `Ingreso masivo - ${successTrackings.length} tracking(s)`,
            });
          }
        } catch (_) {}
      }
    }

    setResults(resultsList);
    setProcessing(false);

    const updatedCount = resultsList.filter(r => r.status === 'updated').length;
    const createdCount = resultsList.filter(r => r.status === 'created').length;
    const dupSkipped = resultsList.filter(r => r.status === 'duplicate_skipped').length;
    const failCount = resultsList.filter(r => r.status === 'not_found' || r.status === 'error' || r.status === 'missing_client').length;

    if (updatedCount > 0) {
      toast.success(`${updatedCount} paquete(s) actualizados con fotos`);
    }
    if (createdCount > 0) {
      toast.success(`${createdCount} paquete(s) creados con fotos`);
    }
    if (dupSkipped > 0) {
      toast.warning(`${dupSkipped} tracking(s) omitidos por duplicado`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} tracking(s) no encontrados o con error`);
    }

    if (typeof onCompleted === 'function') onCompleted();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange?.(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-600" />
            Carga Masiva de Fotos
          </DialogTitle>
          <DialogDescription>
            Sube fotos donde el nombre del archivo sea el número de tracking (ej: <code className="bg-slate-100 px-1 rounded text-xs">TRK123456.jpg</code>). Se asignarán automáticamente al paquete y se marcarán como recibidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client search */}
          {!results && !processing && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <User className="h-4 w-4" />
                Cliente (opcional)
              </label>
              {selectedClient ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{selectedClient.full_name || selectedClient.first_name || selectedClient.email}</p>
                    <p className="text-xs text-slate-500">{selectedClient.email} {selectedClient.shipping_mark ? `• ${selectedClient.shipping_mark}` : ''}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nombre, email o shipping mark..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-10"
                  />
                  {searchingClients && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
                  )}
                  {clientResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {clientResults.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedClient(c); setClientSearch(''); setClientResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800">{c.full_name || c.first_name || c.email}</p>
                            <p className="text-xs text-slate-500">{c.email}</p>
                          </div>
                          {c.shipping_mark && <Badge variant="outline" className="text-xs">{c.shipping_mark}</Badge>}
                        </button>
                      ))}
                    </div>
                  )}
                  {clientSearch.length >= 2 && !searchingClients && clientResults.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-center text-xs text-slate-500">
                      No se encontraron clientes
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tracking mode selector */}
          {!results && !processing && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Método de identificación</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setTrackingMode('filename'); setBarcodeResults({}); }}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                    trackingMode === 'filename'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <FileImage className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Nombre del archivo</p>
                    <p className="text-[11px] leading-tight opacity-75">El nombre = tracking</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setTrackingMode('scanner'); setBarcodeResults({}); }}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                    trackingMode === 'scanner'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <ScanLine className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Escaneo / Lectora</p>
                    <p className="text-[11px] leading-tight opacity-75">Escanea trackings con cámara o lectora USB</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* CBM Ingreso fields */}
          {!results && !processing && (
            <div className="space-y-2 border rounded-lg p-3 bg-slate-50/50">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Box className="h-4 w-4 text-blue-600" />
                Ingreso CBM (opcional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">CBM</label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.000"
                    value={cbmValue}
                    onChange={(e) => setCbmValue(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 flex items-center gap-1"><FileText className="h-3 w-3" /> Nº Factura</label>
                  <Input
                    placeholder="Ej: INV-001"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Scanner mode UI */}
          {trackingMode === 'scanner' && !results && !processing && (
            <div className="space-y-3">
              <BarcodeScannerModule
                title="Escaneo de trackings para recepción"
                description="Escanea con cámara o lectora USB. Cada lectura agrega el tracking a la lista."
                placeholder="Escanea o escribe el tracking"
                actionLabel="Agregar"
                cameraLabel="Cámara"
                autoStartCamera={false}
                value=""
                onValueChange={() => {}}
                onDetected={handleScannerDetected}
              />

              {/* Scanned tracking list */}
              {scannerTrackingList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">{scannerTrackingList.length} tracking(s) escaneados</p>
                    <Button variant="ghost" size="sm" onClick={() => { setScannerTrackingList([]); setScannerStatusByCode({}); setScannerExistingPkgs({}); }} className="text-red-500 h-7 px-2 text-xs">
                      <X className="h-3 w-3 mr-1" /> Limpiar
                    </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {[...scannerTrackingList].reverse().map((t) => {
                      const status = scannerStatusByCode[t];
                      return (
                        <div key={t} className="px-3 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={`font-mono text-sm font-medium ${
                              status?.state === 'exists' ? 'text-emerald-700' :
                              status?.state === 'not_found' ? 'text-red-600' :
                              status?.state === 'checking' ? 'text-slate-500' : 'text-slate-800'
                            }`}>{t}</p>
                            {status && status.state !== 'checking' && (
                              <p className={`text-xs ${
                                status.state === 'exists' ? 'text-emerald-600' :
                                status.state === 'not_found' ? 'text-red-500' : 'text-amber-600'
                              }`}>
                                {status.message}
                              </p>
                            )}
                            {status?.state === 'checking' && (
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Revisando...
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setScannerTrackingList((prev) => prev.filter((x) => x !== t));
                              setScannerStatusByCode((prev) => { const n = { ...prev }; delete n[t]; return n; });
                              setScannerExistingPkgs((prev) => { const n = { ...prev }; delete n[t]; return n; });
                            }}
                            className="h-6 w-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {scannerTrackingList.some((t) => scannerExistingPkgs[t]) && (
                    <p className="text-sm text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Los trackings encontrados se marcarán como recibidos con su cliente correspondiente.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* File selector */}
          {!results && trackingMode !== 'scanner' && (
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="bulk-photo-input"
                disabled={processing}
              />
              <label htmlFor="bulk-photo-input" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Click para seleccionar fotos</p>
                <p className="text-xs text-slate-500 mt-1">El nombre del archivo = número de tracking</p>
                <p className="text-xs text-slate-400 mt-1">Puedes subir varias fotos por tracking (ej: TRK123_1.jpg, TRK123_2.jpg)</p>
              </label>
            </div>
          )}

          {/* Preview grouped files */}
          {files.length > 0 && !results && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {files.length} foto(s) → {Object.keys(grouped).length} tracking(s)
                </p>
                <Button variant="ghost" size="sm" onClick={() => setFiles([])} className="text-red-500">
                  <X className="h-4 w-4 mr-1" /> Limpiar
                </Button>
              </div>

              {/* Duplicate warning banner */}
              {!checkingDuplicates && duplicateCount > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {duplicateCount} tracking(s) ya existen en el sistema
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Los duplicados se actualizarán con las fotos nuevas en vez de crear paquetes nuevos.
                    </p>
                  </div>
                </div>
              )}
              {checkingDuplicates && (
                <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Verificando duplicados...
                </div>
              )}

              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {Object.entries(grouped).map(([tracking, photos]) => {
                  const isDup = !!duplicateWarnings[tracking];
                  return (
                    <div key={tracking} className={`px-3 py-2 space-y-2 ${isDup ? 'bg-amber-50/50' : ''}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {isDup && <Copy className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                            <p className={`font-mono text-sm font-medium ${isDup ? 'text-amber-700' : 'text-slate-800'}`}>{tracking}</p>
                          </div>
                          <p className="text-xs text-slate-500">{photos.length} foto(s): {photos.map(f => f.name).join(', ')}</p>
                          {isDup && (
                            <p className="text-[10px] text-amber-600 mt-0.5">
                              Ya existe para: {duplicateWarnings[tracking].client_email} — se actualizará
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge variant={isDup ? 'secondary' : 'outline'} className={`text-xs ${isDup ? 'bg-amber-100 text-amber-700' : ''}`}>
                            {photos.length} 📷
                          </Badge>
                          <button
                            onClick={() => removeTrackingGroup(tracking)}
                            className="h-6 w-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Eliminar este tracking"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {!isDup && !selectedClient && (
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Cliente para paquete nuevo</Label>
                          <SelectClientInline
                            tracking={tracking}
                            options={clientResults}
                            value={selectedClientsByTracking[tracking] || ''}
                            onChange={(email) => setSelectedClientsByTracking((prev) => ({ ...prev, [tracking]: email }))}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress */}
          {processing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-slate-600">Procesando...</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-slate-500 text-center">{progress}%</p>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-lg font-bold text-green-700">{results.filter(r => r.status === 'updated').length}</p>
                <p className="text-xs text-green-600">Actualizados</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-lg font-bold text-blue-700">{results.filter(r => r.status === 'created').length}</p>
                <p className="text-xs text-blue-600">Creados</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-center">
                <p className="text-lg font-bold text-amber-700">{results.filter(r => r.status === 'duplicate_skipped').length}</p>
                <p className="text-xs text-amber-600">Dup. omitidos</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-lg font-bold text-slate-700">{results.filter(r => r.status === 'not_found').length}</p>
                <p className="text-xs text-slate-600">No encontrados</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg text-center">
                <p className="text-lg font-bold text-red-700">{results.filter(r => r.status === 'error').length}</p>
                <p className="text-xs text-red-600">Errores</p>
              </div>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {results.map((r, idx) => (
                  <div key={idx} className="px-3 py-2 flex items-center gap-3">
                    {r.status === 'updated' || r.status === 'created' ? (
                      <CheckCircle className={`h-4 w-4 flex-shrink-0 ${r.status === 'created' ? 'text-blue-600' : 'text-green-600'}`} />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm truncate">{r.tracking}</p>
                      {r.status === 'updated' && (
                        <p className="text-xs text-slate-500">
                          {r.clientName} • {r.photos} foto(s){r.markedReceived ? ' • Marcado como recibido' : ''}
                        </p>
                      )}
                      {r.status === 'created' && (
                        <p className="text-xs text-blue-600">
                          {r.clientName} • {r.photos} foto(s) • Paquete creado y recibido
                        </p>
                      )}
                      {r.status === 'duplicate_skipped' && (
                        <p className="text-xs text-amber-600">Omitido: tracking ya existe para {r.clientName}</p>
                      )}
                      {r.status === 'not_found' && (
                        <p className="text-xs text-slate-500">Tracking no encontrado en el sistema</p>
                      )}
                      {r.status === 'missing_client' && (
                        <p className="text-xs text-amber-600">Debes seleccionar un cliente para crear este paquete</p>
                      )}
                      {r.status === 'error' && (
                        <p className="text-xs text-red-600">{r.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {results ? (
            <Button onClick={() => { reset(); onOpenChange?.(false); }}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { reset(); onOpenChange?.(false); }} disabled={processing}>
                Cancelar
              </Button>
              {trackingMode === 'scanner' ? (
                <Button
                  onClick={handleScannerProcess}
                  disabled={processing || scannerTrackingList.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                  Recibir {scannerTrackingList.filter((t) => scannerExistingPkgs[t]).length} tracking(s)
                </Button>
              ) : (
                <Button
                  onClick={handleProcess}
                  disabled={processing || files.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Procesar {Object.keys(grouped).length} tracking(s)
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}