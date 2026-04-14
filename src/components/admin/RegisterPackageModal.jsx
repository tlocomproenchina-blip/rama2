import React, { useEffect, useState, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Camera } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, CheckCircle, Upload, User as UserIcon, Plane, Ship, Image as ImageIcon, Loader2, AlertCircle, FileText, Box, Plus, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { sanitizePackageData } from '@/lib/inputSanitizers';

function SimpleTrackingCameraScanner({ onDetected, cameraLoading, setCameraLoading }) {
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const detectorRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const activeRef = React.useRef(false);

  const stopCamera = React.useCallback(() => {
    activeRef.current = false;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleDetected = React.useCallback((value) => {
    const code = String(value || '').replace(/\r?\n/g, '').trim();
    if (!code) return;
    onDetected(code);
  }, [onDetected]);

  const scanFrame = React.useCallback(async () => {
    if (!activeRef.current || !videoRef.current || !detectorRef.current) return;
    if (videoRef.current.readyState >= 2) {
      const detected = await detectorRef.current.detect(videoRef.current).catch(() => []);
      const code = String(detected?.[0]?.rawValue || '').replace(/\r?\n/g, '').trim();
      if (code) {
        handleDetected(code);
        toast.success('Código detectado');
        stopCamera();
        return;
      }
    }
    frameRef.current = requestAnimationFrame(scanFrame);
  }, [handleDetected, stopCamera]);

  const startCamera = React.useCallback(async () => {
    if (!(typeof window !== 'undefined' && 'BarcodeDetector' in window && navigator?.mediaDevices?.getUserMedia)) {
      toast.error('La cámara no está disponible en este navegador');
      return;
    }

    setCameraLoading(true);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    }).catch(() => null);

    if (!stream) {
      setCameraLoading(false);
      toast.error('No se pudo abrir la cámara');
      return;
    }

    streamRef.current = stream;
    detectorRef.current = new window.BarcodeDetector({
      formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'qr_code'],
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => null);
    }

    activeRef.current = true;
    setCameraLoading(false);
    scanFrame();
  }, [scanFrame, setCameraLoading]);

  React.useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="relative overflow-hidden rounded-xl border bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
        <div className="h-28 w-full max-w-md rounded-2xl border-2 border-dashed border-white/80 bg-white/10" />
      </div>
      {cameraLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Activando cámara...
        </div>
      )}
    </div>
  );
}

export default function RegisterPackageModal({ open, onOpenChange, onCreated }) {
  const [shippingMark, setShippingMark] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [trackingNumbers, setTrackingNumbers] = useState(['']);
  const [description, setDescription] = useState('');
  const [shippingType, setShippingType] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState(null);
  const [trackingWarning, setTrackingWarning] = useState(null);
  const [checkingTracking, setCheckingTracking] = useState(false);
  const [existingPackagesByTracking, setExistingPackagesByTracking] = useState({});
  // CBM Ingreso fields
  const [createCbmIngreso, setCreateCbmIngreso] = useState(false);
  const [cbmValue, setCbmValue] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1).then(cfgs => {
      const cfg = cfgs?.[0] || {};
      setConfig(cfg);
      // Auto-seleccionar el primer tipo habilitado
      const airOn = cfg.shipping_type_air_enabled !== false;
      const seaOn = cfg.shipping_type_sea_enabled !== false;
      if (airOn) setShippingType('aereo');
      else if (seaOn) setShippingType('maritimo');
    });
  }, [open]);

  const resetForm = () => {
    setShippingMark('');
    setFoundUser(null);
    setSearchResults([]);
    setTrackingNumbers(['']);
    setDescription('');
    const airOn = config?.shipping_type_air_enabled !== false;
    const seaOn = config?.shipping_type_sea_enabled !== false;
    setShippingType(airOn ? 'aereo' : seaOn ? 'maritimo' : '');
    setImageFiles([]);
    setTrackingWarning(null);
    setCreateCbmIngreso(false);
    setCbmValue('');
    setInvoiceNumber('');
    setCameraOpen(false);
    setCameraLoading(false);
  };

  const checkTrackingDuplicate = async (value) => {
    const t = String(value || '').trim();
    if (!t || t.length < 5) {
      setTrackingWarning(null);
      setExistingPackagesByTracking((prev) => {
        const next = { ...prev };
        delete next[t];
        return next;
      });
      return true;
    }
    setCheckingTracking(true);
    try {
      const existing = await base44.entities.Package.filter({ tracking_number: t }, '-created_date', 1);
      const pkg = existing?.[0];
      if (pkg) {
        setExistingPackagesByTracking((prev) => ({ ...prev, [t]: pkg }));
        const info = ` (cliente: ${pkg.client_email}, estado: ${pkg.status})`;
        setTrackingWarning(`Este tracking ya existe${info}. Se reportará como recibido.`);
        setCheckingTracking(false);
        return false;
      }
      setExistingPackagesByTracking((prev) => {
        const next = { ...prev };
        delete next[t];
        return next;
      });
      setTrackingWarning(null);
      setCheckingTracking(false);
      return true;
    } catch (e) {
      setCheckingTracking(false);
      setTrackingWarning(null);
      return true;
    }
  };

  const handleSearch = async () => {
    if (!shippingMark.trim()) { toast.error('Ingresa un término de búsqueda'); return; }
    setSearching(true);
    setSearchResults([]);
    try {
      const query = shippingMark.trim().toLowerCase();
      // Buscar exacto primero
      let users = await base44.entities.User.filter({ shipping_mark: shippingMark.trim() }, '-created_date', 1);
      if (users && users.length === 1) {
        setFoundUser(users[0]);
        setShippingMark(users[0].shipping_mark || shippingMark.trim());
        setSearchResults([]);
        toast.success('Cliente encontrado');
        setSearching(false);
        return;
      }
      // Búsqueda parcial: recorrer todos los usuarios
      let allUsers = [];
      let skip = 0;
      const batchSize = 200;
      while (true) {
        const batch = await base44.entities.User.list('-created_date', batchSize, skip);
        if (!batch || batch.length === 0) break;
        allUsers = allUsers.concat(batch);
        if (batch.length < batchSize) break;
        skip += batchSize;
      }
      const matches = allUsers.filter(u =>
        u.role === 'user' && (
          (u.shipping_mark || '').toLowerCase().includes(query) ||
          (u.email || '').toLowerCase().includes(query) ||
          (u.full_name || '').toLowerCase().includes(query) ||
          (u.first_name || '').toLowerCase().includes(query) ||
          (u.last_name || '').toLowerCase().includes(query)
        )
      );
      if (matches.length === 1) {
        setFoundUser(matches[0]);
        setShippingMark(matches[0].shipping_mark || shippingMark.trim());
        setSearchResults([]);
        toast.success('Cliente encontrado');
      } else if (matches.length > 1) {
        setFoundUser(null);
        setSearchResults(matches.slice(0, 10));
        toast.info(`${matches.length} coincidencia(s) encontrada(s)`);
      } else {
        setFoundUser(null);
        setSearchResults([]);
        toast.error('No se encontró un cliente con ese criterio');
      }
    } catch (e) {
      toast.error('Error buscando cliente');
    }
    setSearching(false);
  };

  const handleSubmit = async () => {
    if (!foundUser) { toast.error('Busca y selecciona un cliente'); return; }
    const cleanedTrackingNumbers = trackingNumbers.map((item) => item.trim()).filter(Boolean);
    if (cleanedTrackingNumbers.length === 0) { toast.error('Ingresa al menos un número de tracking'); return; }
    if (!shippingType) { toast.error('Selecciona el tipo de envío'); return; }

    setSubmitting(true);

    for (const tracking of cleanedTrackingNumbers) {
      await checkTrackingDuplicate(tracking);
    }

    try {
      let imageUrls = [];
      if (imageFiles && imageFiles.length > 0) {
        const uploaded = [];
        for (const f of imageFiles.slice(0,3)) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
          uploaded.push(file_url);
        }
        imageUrls = uploaded;
      }

      const createdPackages = [];
      for (const tracking of cleanedTrackingNumbers) {
        const sanitizedPackage = sanitizePackageData({
          tracking_number: tracking,
        });

        const existingPackage = existingPackagesByTracking[tracking];
        if (existingPackage) {
          const response = await base44.functions.invoke('processReceptionPhoto', {
            tracking_number: sanitizedPackage.tracking_number,
            client_email: existingPackage.client_email || foundUser.email,
            package_image_url: (imageUrls && imageUrls[0]) ? imageUrls[0] : null,
            skip_email: true,
          });
          createdPackages.push(response?.data?.package || existingPackage);
          continue;
        }

        const response = await base44.functions.invoke('processReceptionPhoto', {
          tracking_number: sanitizedPackage.tracking_number,
          client_email: foundUser.email,
          package_image_url: (imageUrls && imageUrls[0]) ? imageUrls[0] : null,
          skip_email: true,
        });
        const created = response?.data?.package;
        createdPackages.push(created);
      }

      if (createCbmIngreso && cbmValue) {
        const now = new Date();
        const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        try {
          const sanitizedCbmData = sanitizePackageData({
            shipping_mark: shippingMark,
            invoice_number: invoiceNumber,
          });
          await base44.entities.CbmIngreso.create({
            fecha: now.toISOString(),
            cbm: parseFloat(cbmValue) || 0,
            mes,
            client_email: foundUser.email,
            client_name: foundUser.full_name || foundUser.first_name || foundUser.email,
            shipping_mark: sanitizedCbmData.shipping_mark,
            tracking_numbers: cleanedTrackingNumbers,
            invoice_number: sanitizedCbmData.invoice_number || undefined,
            descripcion: `Ingreso desde registro de paquete - ${cleanedTrackingNumbers.join(', ')}`,
          });
          toast.success('Ingreso CBM registrado');
        } catch (cbmErr) {
          toast.error('Paquetes creados, pero no se pudo registrar el ingreso CBM');
        }
      }

      const receivedExistingCount = cleanedTrackingNumbers.filter((tracking) => existingPackagesByTracking[tracking]).length;
      const newCount = cleanedTrackingNumbers.length - receivedExistingCount;
      if (receivedExistingCount > 0 && newCount > 0) {
        toast.success(`${newCount} paquete(s) registrados y ${receivedExistingCount} reportado(s) como recibido(s)`);
      } else if (receivedExistingCount > 0) {
        toast.success(`${receivedExistingCount} paquete(s) reportado(s) como recibido(s)`);
      } else {
        toast.success(cleanedTrackingNumbers.length === 1 ? 'Paquete registrado' : `${cleanedTrackingNumbers.length} paquetes registrados`);
      }
      resetForm();
      if (typeof onCreated === 'function') onCreated(createdPackages[0]);
    } catch (e) {
      toast.error('No se pudo registrar el paquete');
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange?.(v); }}>
      <DialogContent className="max-w-lg overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Registrar Paquete</DialogTitle>
          <DialogDescription>Busca al cliente por su Shipping Mark y completa los datos del paquete.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Buscar cliente por Shipping Mark */}
          <div className="space-y-2">
            <Label>Shipping Mark del cliente</Label>
            <div className="flex gap-2 min-w-0">
              <Input
                placeholder="Ej: TLEC-ABC123"
                value={shippingMark}
                onChange={(e) => setShippingMark(e.target.value)}
              />
              <Button onClick={handleSearch} variant="outline" className="gap-2" disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
              </Button>
            </div>
            {foundUser && (
              <div className="mt-2 p-3 rounded-lg border bg-blue-50 border-blue-200 text-slate-700 text-sm flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-blue-600" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{foundUser.full_name || 'Cliente'}</div>
                  <div className="font-mono text-xs text-slate-600">{foundUser.email}</div>
                  {foundUser.shipping_mark && <div className="font-mono text-xs text-blue-600">{foundUser.shipping_mark}</div>}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500" onClick={() => { setFoundUser(null); setSearchResults([]); }}>✕</Button>
              </div>
            )}
            {!foundUser && searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y bg-white">
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                    onClick={() => {
                      setFoundUser(u);
                      setShippingMark(u.shipping_mark || shippingMark);
                      setSearchResults([]);
                    }}
                  >
                    <p className="text-sm font-medium text-slate-800">{u.full_name || u.first_name || u.email}</p>
                    <p className="text-xs text-slate-500">{u.email} {u.shipping_mark ? `· ${u.shipping_mark}` : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tracking */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Número de tracking</Label>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCameraOpen(true)}
                >
                  <Camera className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setTrackingNumbers((prev) => [...prev, '']);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {trackingNumbers.map((tracking, index) => (
                <div key={index} className="flex items-center gap-2 min-w-0">
                  <div className="relative flex-1">
                    <Input
                      placeholder={`Ingresa el número de tracking ${index + 1}`}
                      value={tracking}
                      onChange={(e) => {
                        const next = [...trackingNumbers];
                        next[index] = e.target.value;
                        setTrackingNumbers(next);
                        setTrackingWarning(null);
                      }}
                      onBlur={() => checkTrackingDuplicate(tracking)}
                      className={trackingWarning && tracking.trim() ? 'border-red-300' : ''}
                    />
                    {checkingTracking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      </div>
                    )}
                  </div>
                  {trackingNumbers.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => {
                        const next = trackingNumbers.filter((_, itemIndex) => itemIndex !== index);
                        setTrackingNumbers(next.length ? next : ['']);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {trackingWarning && (
              <p className="text-sm text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {trackingWarning}
              </p>
            )}
            {trackingNumbers.some((tracking) => existingPackagesByTracking[tracking.trim()]) && (
              <p className="text-sm text-blue-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Los trackings ya registrados se marcarán como recibidos automáticamente.
              </p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Textarea rows={3} placeholder="Descripción del contenido o notas" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Tipo de envío */}
          <div className="space-y-2">
            <Label>Tipo de envío</Label>
            <Select value={shippingType} onValueChange={setShippingType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config?.shipping_type_air_enabled !== false && (
                  <SelectItem value="aereo">Aéreo</SelectItem>
                )}
                {config?.shipping_type_sea_enabled !== false && (
                  <SelectItem value="maritimo">Marítimo</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* CBM Ingreso */}
          <div className="space-y-3 border rounded-lg p-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-cbm"
                checked={createCbmIngreso}
                onCheckedChange={setCreateCbmIngreso}
              />
              <Label htmlFor="create-cbm" className="flex items-center gap-1.5 cursor-pointer text-sm font-medium">
                <Box className="h-4 w-4 text-blue-600" />
                Registrar ingreso CBM
              </Label>
            </div>
            {createCbmIngreso && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">CBM</Label>
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
                  <Label className="text-xs flex items-center gap-1"><FileText className="h-3 w-3" /> Nº Factura</Label>
                  <Input
                    placeholder="Ej: INV-001"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fotos (hasta 3) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Fotos del paquete (opcional, máx. 3)</Label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImageFiles(Array.from(e.target.files || []).slice(0,3))}
                className="hidden"
                id="reg-pkg-image"
              />
              <label htmlFor="reg-pkg-image" className="cursor-pointer">
                {imageFiles && imageFiles.length > 0 ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium text-sm">{imageFiles.length} archivo(s) seleccionados</span>
                  </div>
                ) : (
                  <div className="text-slate-500">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm">Click para subir hasta 3 fotos</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !foundUser || trackingNumbers.every((item) => !item.trim())} className="bg-blue-600 hover:bg-blue-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Escanear con cámara</DialogTitle>
            <DialogDescription>
              Cada lectura agregará automáticamente un nuevo número de tracking.
            </DialogDescription>
          </DialogHeader>
          <SimpleTrackingCameraScanner
            onDetected={(value) => {
              const code = String(value || '').trim();
              if (!code) return;
              setTrackingNumbers((prev) => {
                const filled = prev.filter((item) => item.trim() !== '');
                if (filled[filled.length - 1] === code) return [...filled, ''];
                return [...filled, code, ''];
              });
              setTrackingWarning(null);
              toast.success('Código detectado');
              setCameraOpen(false);
            }}
            cameraLoading={cameraLoading}
            setCameraLoading={setCameraLoading}
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}