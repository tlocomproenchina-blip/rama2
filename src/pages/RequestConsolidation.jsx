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
      <div className="space-y-4 md:space-y-5 lg:space-y-6 w-full">
        <div className="h-8 bg-slate-200 rounded w-32 animate-pulse" />
        <div className="h-40 bg-slate-200 rounded animate-pulse" />
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
    <div className="space-y-4 md:space-y-5 lg:space-y-6 w-full">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Solicitar Consolidación</h1>
        <p className="text-xs md:text-sm text-slate-500">Selecciona los paquetes que deseas consolidar</p>
      </div>

      {/* Settings */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="p-3 md:p-4 lg:p-6">
          <CardTitle className="text-base md:text-lg">Configuración de Consolidación</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 lg:p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs md:text-sm">Tipo de Envío</Label>
            <Select 
              value={formData.shipping_type}
              onValueChange={(val) => setFormData({ ...formData, shipping_type: val })}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aereo">
                  <div className="flex items-center gap-2">
                    <Plane className="h-3 w-3 md:h-4" /> Aéreo
                  </div>
                </SelectItem>
                <SelectItem value="maritimo">
                  <div className="flex items-center gap-2">
                    <Ship className="h-3 w-3 md:h-4" /> Marítimo
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3">
              <p className="text-xs md:text-sm text-blue-800">
                <strong>Período:</strong> 30 días desde la recepción del primer paquete
              </p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label className="text-xs md:text-sm">Notas (opcional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Agrega cualquier nota..."
              rows={2}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Package Selection */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b p-3 md:p-4 lg:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
            <CardTitle className="text-base md:text-lg">Paquetes Disponibles ({packages.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={selectAll} className="w-full md:w-auto text-xs md:text-sm">
              {selectedPackages.length === packages.length ? 'Deseleccionar' : 'Seleccionar'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-96 overflow-y-auto">
            {packages.map((pkg) => (
              <div 
                key={pkg.id} 
                className={`p-3 md:p-4 flex items-start md:items-center gap-3 cursor-pointer transition-colors ${
                  selectedPackages.includes(pkg.id) ? 'bg-purple-50' : 'hover:bg-slate-50'
                }`}
                onClick={() => togglePackage(pkg.id)}
              >
                <Checkbox 
                  checked={selectedPackages.includes(pkg.id)}
                  onCheckedChange={() => togglePackage(pkg.id)}
                  className="mt-1 md:mt-0 flex-shrink-0"
                />
                <div className="p-2 bg-slate-100 rounded-lg flex-shrink-0">
                  {pkg.shipping_type === 'aereo' 
                    ? <Plane className="h-4 w-4 md:h-5 text-blue-600" />
                    : <Ship className="h-4 w-4 md:h-5 text-blue-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-medium text-xs md:text-sm truncate">{pkg.tracking_number}</p>
                  <p className="text-xs md:text-sm text-slate-500 line-clamp-1">{pkg.description || 'Sin descripción'}</p>
                </div>
                {pkg.has_insurance && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs md:text-sm text-emerald-600 font-medium">Asegurado</p>
                    <p className="text-xs md:text-sm text-slate-500">FOB: ${pkg.fob_value}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-3 md:p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 md:h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs md:text-sm text-blue-800 min-w-0">
              <p className="font-medium mb-1">¿Qué sucede después?</p>
              <p>Un administrador revisará tu solicitud, procesará la consolidación y generará tu factura.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:justify-end">
        <Button 
          variant="outline" 
          onClick={() => navigate(createPageUrl('Dashboard'))}
          className="w-full md:w-auto"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={submitting || selectedPackages.length === 0}
          className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto"
        >
          {submitting ? (
            <><Loader2 className="h-3 w-3 md:h-4 mr-2 animate-spin" /> Enviando...</>
          ) : (
            <><CheckCircle className="h-3 w-3 md:h-4 mr-2" /> Enviar ({selectedPackages.length})</>
          )}
        </Button>
      </div>
    </div>
  );
}