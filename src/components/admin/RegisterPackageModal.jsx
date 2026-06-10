import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import { Button } from '@/components/ui/button';
import { CheckCircle, Image as ImageIcon, Loader2, AlertCircle, Plus, Trash2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import QuickPreAlertForm from '@/components/admin/QuickPreAlertForm';



export default function RegisterPackageModal({ open, onOpenChange, onCreated }) {
  const [trackingNumbers, setTrackingNumbers] = useState(['']);
  const [imageFiles, setImageFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [trackingStatusByCode, setTrackingStatusByCode] = useState({});
  const [existingPackagesByTracking, setExistingPackagesByTracking] = useState({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [quickPreAlertOpen, setQuickPreAlertOpen] = useState({});

  const removeScannedTracking = (index) => {
    const code = (trackingNumbers[index] || '').trim();
    const next = trackingNumbers.filter((_, i) => i !== index);
    setTrackingNumbers(next.length ? next : ['']);
    if (code && !next.some((t) => t.trim() === code)) {
      setTrackingStatusByCode((prev) => { const c = { ...prev }; delete c[code]; return c; });
      setExistingPackagesByTracking((prev) => { const c = { ...prev }; delete c[code]; return c; });
    }
  };

  const resetForm = () => {
    setTrackingNumbers(['']);
    setImageFiles([]);
    setTrackingStatusByCode({});
    setExistingPackagesByTracking({});
    setCameraOpen(false);
    setQuickPreAlertOpen({});
  };

  const checkTrackingDuplicate = async (value) => {
    const t = String(value || '').trim();
    if (!t) {
      return;
    }

    setTrackingStatusByCode((prev) => ({
      ...prev,
      [t]: { state: 'checking', message: 'Revisando tracking...' }
    }));

    try {
      const existing = await base44.entities.Package.filter({ tracking_number: t }, '-created_date', 1);
      const pkg = existing?.[0];
      if (pkg) {
        setExistingPackagesByTracking((prev) => ({ ...prev, [t]: pkg }));
        const info = `Cliente: ${pkg.client_email} · Estado: ${pkg.status}`;
        const alreadyReceived = ['recibido', 'rechazado', 'consolidado', 'en_transito', 'disponible', 'entregado'].includes(pkg.status);
        if (alreadyReceived) {
          setTrackingStatusByCode((prev) => ({
            ...prev,
            [t]: { state: 'already_received', message: `⚠️ Ya fue procesado (${pkg.status}). ${info}` }
          }));
        } else {
          setTrackingStatusByCode((prev) => ({
            ...prev,
            [t]: { state: 'exists', message: `Se marcará como recibido. ${info}` }
          }));
        }
      } else {
        setExistingPackagesByTracking((prev) => {
          const next = { ...prev };
          delete next[t];
          return next;
        });
        setTrackingStatusByCode((prev) => ({
          ...prev,
          [t]: { state: 'not_found', message: 'No existe en el sistema. Debe tener pre-alerta primero.' }
        }));
      }
    } catch (e) {
      setTrackingStatusByCode((prev) => ({
        ...prev,
        [t]: { state: 'error', message: 'No se pudo validar este tracking ahora.' }
      }));
    }
  };

  const handleSubmit = async () => {
    const cleanedTrackingNumbers = trackingNumbers.map((item) => item.trim()).filter(Boolean);
    if (cleanedTrackingNumbers.length === 0) { toast.error('Ingresa al menos un número de tracking'); return; }

    // Check all trackings first
    for (const tracking of cleanedTrackingNumbers) {
      await checkTrackingDuplicate(tracking);
    }

    // Only process trackings that exist AND are not already received
    const alreadyReceivedStatuses = ['recibido', 'rechazado', 'consolidado', 'en_transito', 'disponible', 'entregado'];
    const validTrackings = cleanedTrackingNumbers.filter((t) => {
      const pkg = existingPackagesByTracking[t];
      return pkg && !alreadyReceivedStatuses.includes(pkg.status);
    });
    const invalidTrackings = cleanedTrackingNumbers.filter((t) => !existingPackagesByTracking[t]);
    const skippedTrackings = cleanedTrackingNumbers.filter((t) => {
      const pkg = existingPackagesByTracking[t];
      return pkg && alreadyReceivedStatuses.includes(pkg.status);
    });

    if (validTrackings.length === 0) {
      if (skippedTrackings.length > 0) {
        toast.info(`${skippedTrackings.length} tracking(s) ya fueron recibidos. No hay nada nuevo que procesar.`);
      } else {
        toast.error('Ninguno de los trackings existe en el sistema. Deben tener pre-alerta primero.');
      }
      return;
    }

    setSubmitting(true);

    try {
      let imageUrls = [];
      if (imageFiles && imageFiles.length > 0) {
        for (const f of imageFiles.slice(0, 3)) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
          imageUrls.push(file_url);
        }
      }

      const processedPackages = [];
      for (const tracking of validTrackings) {
        const existingPackage = existingPackagesByTracking[tracking];
        const response = await base44.functions.invoke('processReceptionPhoto', {
          tracking_number: tracking,
          client_email: existingPackage.client_email,
          package_image_url: (imageUrls && imageUrls[0]) ? imageUrls[0] : null,
          skip_email: true,
        });
        processedPackages.push(response?.data?.package || existingPackage);
      }

      let msg = `${validTrackings.length} paquete(s) marcado(s) como recibido(s)`;
      if (skippedTrackings.length > 0) {
        msg += `. ${skippedTrackings.length} ignorado(s) (ya recibidos)`;
      }
      if (invalidTrackings.length > 0) {
        msg += `. ${invalidTrackings.length} ignorado(s) (no existen)`;
      }
      toast.success(msg);
      resetForm();
      if (typeof onCreated === 'function') onCreated(processedPackages[0]);
    } catch (e) {
      toast.error('No se pudo procesar la recepción');
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange?.(v); }}>
      <DialogContent className="max-w-lg overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y">
        <DialogHeader>
          <DialogTitle>Recepción de Paquetes</DialogTitle>
          <DialogDescription>Ingresa los números de tracking para marcarlos como recibidos. Cada paquete se asigna automáticamente a su cliente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
              {[...trackingNumbers].reverse().map((tracking, revIndex) => {
                const index = trackingNumbers.length - 1 - revIndex;
                return (
                <div key={index} className="flex items-center gap-2 min-w-0">
                  <div className="relative flex-1">
                    <Input
                      placeholder={`Ingresa el número de tracking ${index + 1}`}
                      value={tracking}
                      autoFocus={index === trackingNumbers.length - 1}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        const next = [...trackingNumbers];
                        const previousValue = tracking.trim();
                        next[index] = nextValue;
                        setTrackingNumbers(next);

                        if (previousValue && previousValue !== nextValue.trim()) {
                          setTrackingStatusByCode((prev) => {
                            const copy = { ...prev };
                            delete copy[previousValue];
                            return copy;
                          });
                          setExistingPackagesByTracking((prev) => {
                            const copy = { ...prev };
                            delete copy[previousValue];
                            return copy;
                          });
                        }

                        const trimmed = nextValue.trim();
                        if (trimmed) {
                          checkTrackingDuplicate(trimmed);
                        }
                      }}
                      className={
                        trackingStatusByCode[tracking.trim()]?.state === 'exists'
                          ? 'border-emerald-300'
                          : trackingStatusByCode[tracking.trim()]?.state === 'already_received'
                          ? 'border-amber-400'
                          : trackingStatusByCode[tracking.trim()]?.state === 'not_found'
                          ? 'border-red-300'
                          : trackingStatusByCode[tracking.trim()]?.state === 'error'
                          ? 'border-amber-300'
                          : ''
                      }
                    />
                    {trackingStatusByCode[tracking.trim()]?.state === 'checking' && (
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
                );
              })}
            </div>
            <div className="space-y-2">
              {[...trackingNumbers].reverse().map((tracking, revIndex) => {
                const index = trackingNumbers.length - 1 - revIndex;
                const trimmed = tracking.trim();
                const status = trackingStatusByCode[trimmed];
                if (!trimmed || !status || status.state === 'checking') return null;

                return (
                  <div key={`${tracking}-${index}`} className="space-y-1">
                    <div className={`text-sm flex items-center gap-1 ${
                      status.state === 'exists'
                        ? 'text-emerald-600'
                        : status.state === 'already_received'
                        ? 'text-amber-600 font-medium'
                        : status.state === 'not_found'
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }`}>
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{tracking}: {status.message}</span>
                      {status.state === 'not_found' && !quickPreAlertOpen[trimmed] && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0 ml-1"
                          onClick={() => setQuickPreAlertOpen(prev => ({ ...prev, [trimmed]: true }))}
                        >
                          + Pre-alerta
                        </Button>
                      )}
                    </div>
                    {status.state === 'not_found' && quickPreAlertOpen[trimmed] && (
                      <QuickPreAlertForm
                        trackingNumber={trimmed}
                        onCreated={(client) => {
                          setQuickPreAlertOpen(prev => { const n = { ...prev }; delete n[trimmed]; return n; });
                          // Re-check tracking to update status
                          checkTrackingDuplicate(trimmed);
                        }}
                        onCancel={() => setQuickPreAlertOpen(prev => { const n = { ...prev }; delete n[trimmed]; return n; })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {trackingNumbers.some((tracking) => existingPackagesByTracking[tracking.trim()]) && (
              <p className="text-sm text-blue-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Los trackings encontrados se marcarán como recibidos con su cliente correspondiente.
              </p>
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
          <Button onClick={handleSubmit} disabled={submitting || trackingNumbers.every((item) => !item.trim())} className="bg-blue-600 hover:bg-blue-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Registrar Recepción
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Escanear con cámara</DialogTitle>
            <DialogDescription>
              Cada lectura agregará automáticamente un nuevo número de tracking.
            </DialogDescription>
          </DialogHeader>
          <BarcodeScannerModule
            title="Escaneo de tracking"
            description="Usa la misma cámara del buscador QR para agregar trackings al registro."
            placeholder="Escanea o escribe el tracking"
            actionLabel="Agregar tracking"
            cameraLabel="Usar cámara"
            autoStartCamera={cameraOpen}
            continuous
            value=""
            onValueChange={() => {}}
            onDetected={(value) => {
              const code = String(value || '').trim();
              if (!code) return;
              setTrackingNumbers((prev) => {
                const filled = prev.filter((item) => item.trim() !== '');
                if (filled[filled.length - 1] === code) return [...filled, ''];
                return [...filled, code, ''];
              });
              checkTrackingDuplicate(code);
            }}
          />

          {/* Códigos escaneados */}
          {(() => {
            const scanned = trackingNumbers
              .map((t, i) => ({ code: t.trim(), index: i }))
              .filter((item) => item.code);
            if (scanned.length === 0) return null;
            const reversed = [...scanned].reverse();
            return (
              <div className="space-y-2 max-h-48 overflow-y-auto border-t pt-3">
                <p className="text-sm font-medium text-slate-700">
                  Escaneados ({scanned.length})
                </p>
                {reversed.map((item, idx) => {
                  const status = trackingStatusByCode[item.code];
                  const isLast = idx === 0;
                  return (
                    <div
                      key={`${item.code}-${item.index}`}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                        isLast ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <CheckCircle className={`h-4 w-4 shrink-0 ${isLast ? 'text-blue-600' : 'text-emerald-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-semibold text-slate-800 truncate">
                          {item.code} {isLast && <span className="text-xs font-sans font-medium text-blue-600">(último)</span>}
                        </p>
                        {status && status.state !== 'checking' && (
                          <p className={`text-xs truncate ${
                            status.state === 'exists' ? 'text-emerald-600'
                            : status.state === 'already_received' ? 'text-amber-600'
                            : status.state === 'not_found' ? 'text-red-600'
                            : 'text-amber-600'
                          }`}>{status.message}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeScannedTracking(item.index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}