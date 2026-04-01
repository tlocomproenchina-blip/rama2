import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, CheckCircle, Upload, User as UserIcon, Plane, Ship, Image as ImageIcon, Loader2, AlertCircle, FileText, Box } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function RegisterPackageModal({ open, onOpenChange, onCreated }) {
  const [shippingMark, setShippingMark] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [description, setDescription] = useState('');
  const [shippingType, setShippingType] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState(null);
  const [trackingWarning, setTrackingWarning] = useState(null);
  const [checkingTracking, setCheckingTracking] = useState(false);
  // CBM Ingreso fields
  const [createCbmIngreso, setCreateCbmIngreso] = useState(false);
  const [cbmValue, setCbmValue] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

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
    setTrackingNumber('');
    setDescription('');
    const airOn = config?.shipping_type_air_enabled !== false;
    const seaOn = config?.shipping_type_sea_enabled !== false;
    setShippingType(airOn ? 'aereo' : seaOn ? 'maritimo' : '');
    setImageFiles([]);
    setTrackingWarning(null);
    setCreateCbmIngreso(false);
    setCbmValue('');
    setInvoiceNumber('');
  };

  const checkTrackingDuplicate = async (value) => {
    const t = String(value || '').trim();
    if (!t || t.length < 5) { setTrackingWarning(null); return true; }
    setCheckingTracking(true);
    try {
      const { data } = await base44.functions.invoke('checkDuplicates', {
        action: 'check_field',
        field: 'tracking',
        value: t
      });
      if (data?.duplicate) {
        const owner = data.matches?.[0];
        const info = owner ? ` (cliente: ${owner.client_email}, estado: ${owner.status})` : '';
        setTrackingWarning(`Este tracking ya existe${info}`);
        setCheckingTracking(false);
        return false;
      }
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
    if (!trackingNumber.trim()) { toast.error('Ingresa el número de tracking'); return; }
    if (!shippingType) { toast.error('Selecciona el tipo de envío'); return; }

    setSubmitting(true);

    // Verificar duplicado de tracking antes de crear
    const isUnique = await checkTrackingDuplicate(trackingNumber);
    if (!isUnique) {
      toast.error('No se puede registrar: el tracking ya existe en el sistema');
      setSubmitting(false);
      return;
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

      const created = await base44.entities.Package.create({
        tracking_number: trackingNumber.trim(),
        client_email: foundUser.email,
        shipping_mark: shippingMark.trim(),
        shipping_type: shippingType,
        description: description?.trim() || '',
        package_image_urls: (imageUrls || []).slice(0,3),
        package_image_url: (imageUrls && imageUrls[0]) ? imageUrls[0] : undefined,
        // status por defecto = pre_alerta (definido en el esquema)
      });

      // Optionally create CbmIngreso record
      if (createCbmIngreso && cbmValue) {
        const now = new Date();
        const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        try {
          await base44.entities.CbmIngreso.create({
            fecha: now.toISOString(),
            cbm: parseFloat(cbmValue) || 0,
            mes,
            client_email: foundUser.email,
            client_name: foundUser.full_name || foundUser.first_name || foundUser.email,
            shipping_mark: shippingMark.trim(),
            tracking_numbers: [trackingNumber.trim()],
            invoice_number: invoiceNumber.trim() || undefined,
            descripcion: `Ingreso desde registro de paquete - ${trackingNumber.trim()}`,
          });
          toast.success('Ingreso CBM registrado');
        } catch (cbmErr) {
          toast.error('Paquete creado, pero no se pudo registrar el ingreso CBM');
        }
      }

      toast.success('Paquete registrado');
      resetForm();
      if (typeof onCreated === 'function') onCreated(created);
    } catch (e) {
      toast.error('No se pudo registrar el paquete');
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange?.(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Paquete</DialogTitle>
          <DialogDescription>Busca al cliente por su Shipping Mark y completa los datos del paquete.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Buscar cliente por Shipping Mark */}
          <div className="space-y-2">
            <Label>Shipping Mark del cliente</Label>
            <div className="flex gap-2">
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
          <div className="space-y-2">
            <Label>Número de tracking</Label>
            <div className="relative">
              <Input
                placeholder="Ingresa el número de tracking"
                value={trackingNumber}
                onChange={(e) => { setTrackingNumber(e.target.value); setTrackingWarning(null); }}
                onBlur={() => checkTrackingDuplicate(trackingNumber)}
                className={trackingWarning ? 'border-red-300' : ''}
              />
              {checkingTracking && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}
            </div>
            {trackingWarning && (
              <p className="text-sm text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {trackingWarning}
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
                  <SelectItem value="aereo"><div className="flex items-center gap-2"><Plane className="h-4 w-4" /> Aéreo</div></SelectItem>
                )}
                {config?.shipping_type_sea_enabled !== false && (
                  <SelectItem value="maritimo"><div className="flex items-center gap-2"><Ship className="h-4 w-4" /> Marítimo</div></SelectItem>
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
          <Button onClick={handleSubmit} disabled={submitting || !foundUser || !trackingNumber.trim()} className="bg-blue-600 hover:bg-blue-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}