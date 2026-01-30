import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Package, 
  Plane, 
  Ship,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';

export default function RequestConsolidation({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({
    shipping_type: 'aereo',
    consolidation_period_days: 15,
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    const [pkgs, requests, configs] = await Promise.all([
      base44.entities.Package.filter({ 
        client_email: user.email, 
        status: 'recibido'
      }),
      base44.entities.ConsolidationRequest.filter({
        client_email: user.email,
        status: 'pendiente'
      }),
      base44.entities.AppConfig.filter({ config_key: 'main' })
    ]);
    
    // Get IDs of packages in pending requests
    const packagesInRequests = new Set();
    requests.forEach(req => {
      req.package_ids?.forEach(id => packagesInRequests.add(id));
    });
    
    // Filter out packages already in consolidations or pending requests
    const available = pkgs.filter(p => !p.consolidation_id && !packagesInRequests.has(p.id));
    
    setPackages(available);
    if (configs.length > 0) setConfig(configs[0]);
    setLoading(false);
  };

  const togglePackage = (pkgId) => {
    setSelectedPackages(prev => 
      prev.includes(pkgId) 
        ? prev.filter(id => id !== pkgId)
        : [...prev, pkgId]
    );
  };

  const selectAll = () => {
    if (selectedPackages.length === packages.length) {
      setSelectedPackages([]);
    } else {
      setSelectedPackages(packages.map(p => p.id));
    }
  };

  const handleSubmit = async () => {
    if (selectedPackages.length === 0) {
      toast.error('Selecciona al menos un paquete');
      return;
    }

    setSubmitting(true);
    try {
      const selectedPkgs = packages.filter(p => selectedPackages.includes(p.id));
      
      await base44.entities.ConsolidationRequest.create({
        client_email: user.email,
        shipping_mark: user.shipping_mark,
        package_ids: selectedPackages,
        tracking_numbers: selectedPkgs.map(p => p.tracking_number),
        shipping_type: formData.shipping_type,
        consolidation_period_days: formData.consolidation_period_days,
        notes: formData.notes,
        status: 'pendiente'
      });

      // Notify admins
      import('@/components/NotificationUtils').then(({ notifyAdmins }) => {
        notifyAdmins({
          subject: '📦 Nueva solicitud de consolidación',
          body: `${user.first_name} ${user.last_name} (${user.email}) ha solicitado consolidar ${selectedPackages.length} paquete(s).\n\nShipping Mark: ${user.shipping_mark}\nTipo: ${formData.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}\n\nRevisa la solicitud en el panel de administración.`,
          message: `Nueva solicitud de consolidación de ${user.shipping_mark}`,
          type: 'general',
          icon: 'package'
        });
      });

      toast.success('Solicitud enviada exitosamente');
      navigate(createPageUrl('Dashboard'));
    } catch (error) {
      toast.error('Error al enviar solicitud');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin paquetes disponibles</h3>
            <p className="text-slate-500">No tienes paquetes recibidos disponibles para consolidar</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Solicitar Consolidación</h1>
        <p className="text-slate-500">Selecciona los paquetes que deseas consolidar</p>
      </div>

      {/* Settings */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Configuración de Consolidación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Envío</Label>
              <Select 
                value={formData.shipping_type}
                onValueChange={(val) => setFormData({ ...formData, shipping_type: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aereo">
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4" /> Aéreo
                    </div>
                  </SelectItem>
                  <SelectItem value="maritimo">
                    <div className="flex items-center gap-2">
                      <Ship className="h-4 w-4" /> Marítimo
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Período de Consolidación</Label>
              <Select 
                value={formData.consolidation_period_days.toString()}
                onValueChange={(val) => setFormData({ ...formData, consolidation_period_days: parseInt(val) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(config?.consolidation_periods || [15, 20, 30]).map(days => (
                    <SelectItem key={days} value={days.toString()}>
                      {days} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Agrega cualquier nota o instrucción especial..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Package Selection */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle>Paquetes Disponibles ({packages.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selectedPackages.length === packages.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {packages.map((pkg) => (
              <div 
                key={pkg.id} 
                className={`p-4 flex items-center gap-4 cursor-pointer transition-colors ${
                  selectedPackages.includes(pkg.id) ? 'bg-purple-50' : 'hover:bg-slate-50'
                }`}
                onClick={() => togglePackage(pkg.id)}
              >
                <Checkbox 
                  checked={selectedPackages.includes(pkg.id)}
                  onCheckedChange={() => togglePackage(pkg.id)}
                />
                <div className="p-2 bg-slate-100 rounded-lg">
                  {pkg.shipping_type === 'aereo' 
                    ? <Plane className="h-5 w-5 text-blue-600" />
                    : <Ship className="h-5 w-5 text-blue-600" />
                  }
                </div>
                <div className="flex-1">
                  <p className="font-mono font-medium">{pkg.tracking_number}</p>
                  <p className="text-sm text-slate-500">{pkg.description || 'Sin descripción'}</p>
                </div>
                {pkg.has_insurance && (
                  <div className="text-right">
                    <p className="text-sm text-emerald-600 font-medium">Asegurado</p>
                    <p className="text-sm text-slate-500">FOB: ${pkg.fob_value}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">¿Qué sucede después?</p>
              <p>Tu solicitud será revisada por un administrador quien procesará la consolidación, calculará los costos y generará tu factura.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button 
          variant="outline" 
          onClick={() => navigate(createPageUrl('Dashboard'))}
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={submitting || selectedPackages.length === 0}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
          ) : (
            <><CheckCircle className="h-4 w-4 mr-2" /> Enviar Solicitud ({selectedPackages.length} paquetes)</>
          )}
        </Button>
      </div>
    </div>
  );
}