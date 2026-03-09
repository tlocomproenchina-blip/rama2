import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, CheckCircle, Upload, User as UserIcon, Plane, Ship, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPackageModal({ open, onOpenChange, onCreated }) {
  const [shippingMark, setShippingMark] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [description, setDescription] = useState('');
  const [shippingType, setShippingType] = useState('aereo');
  const [imageFile, setImageFile] = useState(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setShippingMark('');
    setFoundUser(null);
    setTrackingNumber('');
    setDescription('');
    setShippingType('aereo');
    setImageFile(null);
  };

  const handleSearch = async () => {
    if (!shippingMark.trim()) { toast.error('Ingresa el Shipping Mark'); return; }
    setSearching(true);
    try {
      // Búsqueda exacta por shipping_mark en el User
      const users = await base44.entities.User.filter({ shipping_mark: shippingMark.trim() }, '-created_date', 1);
      if (users && users[0]) {
        setFoundUser(users[0]);
        toast.success('Cliente encontrado');
      } else {
        setFoundUser(null);
        toast.error('No se encontró un cliente con ese Shipping Mark');
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
    try {
      let imageUrl = null;
      if (imageFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        imageUrl = file_url;
      }

      const created = await base44.entities.Package.create({
        tracking_number: trackingNumber.trim(),
        client_email: foundUser.email,
        shipping_mark: shippingMark.trim(),
        shipping_type: shippingType,
        description: description?.trim() || '',
        package_image_url: imageUrl || undefined,
        // status por defecto = pre_alerta (definido en el esquema)
      });

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
              <div className="mt-2 p-3 rounded-lg border bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-slate-500" />
                <div>
                  <div className="font-medium">{foundUser.full_name || 'Cliente'}</div>
                  <div className="font-mono text-xs text-slate-600">{foundUser.email}</div>
                </div>
              </div>
            )}
          </div>

          {/* Tracking */}
          <div className="space-y-2">
            <Label>Número de tracking</Label>
            <Input placeholder="Ingresa el número de tracking" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
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
                <SelectItem value="aereo"><div className="flex items-center gap-2"><Plane className="h-4 w-4" /> Aéreo</div></SelectItem>
                <SelectItem value="maritimo"><div className="flex items-center gap-2"><Ship className="h-4 w-4" /> Marítimo</div></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Foto */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Foto del paquete (opcional)</Label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="hidden"
                id="reg-pkg-image"
              />
              <label htmlFor="reg-pkg-image" className="cursor-pointer">
                {imageFile ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium text-sm">{imageFile.name}</span>
                  </div>
                ) : (
                  <div className="text-slate-500">
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm">Click para subir foto</p>
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