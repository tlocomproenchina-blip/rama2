import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  Search, 
  Plus, 
  Plane, 
  Ship,
  Shield,
  Image as ImageIcon,
  Loader2,
  ExternalLink
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MyPackages({ user }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    loadPackages();
    
    // Real-time updates
    if (user) {
      const unsubscribe = base44.entities.Package.subscribe((event) => {
        loadPackages();
      });
      
      return () => unsubscribe();
    }
  }, [user]);

  const loadPackages = async () => {
    if (!user) return;
    try {
      const pkgs = await base44.entities.Package.list('-created_date');
      setPackages(pkgs);
    } catch (error) {
      console.error('Error loading packages:', error);
    }
    setLoading(false);
  };

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = pkg.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
                         (pkg.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mis Paquetes</h1>
          <p className="text-slate-500">Gestiona y rastrea todos tus paquetes</p>
        </div>
        {user?.shipping_mark && (
          <Link to={createPageUrl('PreAlert')}>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Pre-alerta
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por tracking o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full lg:w-auto">
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="pre_alerta">Pre-alerta</TabsTrigger>
                <TabsTrigger value="recibido">Recibido</TabsTrigger>
                <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
                <TabsTrigger value="en_transito">En Tránsito</TabsTrigger>
                <TabsTrigger value="entregado">Entregado</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Packages List */}
      {filteredPackages.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay paquetes</h3>
            <p className="text-slate-500 mb-4">
              {search ? 'No se encontraron paquetes con ese criterio' : 'Aún no tienes paquetes registrados'}
            </p>
            {user?.shipping_mark && !search && (
              <Link to={createPageUrl('PreAlert')}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Pre-alerta
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPackages.map((pkg) => (
            <Card key={pkg.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Main Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        {pkg.shipping_type === 'aereo' 
                          ? <Plane className="h-5 w-5 text-blue-600" />
                          : <Ship className="h-5 w-5 text-blue-600" />
                        }
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 font-mono">{pkg.tracking_number}</h3>
                        <p className="text-sm text-slate-500 capitalize">
                          {pkg.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}
                        </p>
                      </div>
                    </div>
                    {pkg.description && (
                      <p className="text-sm text-slate-600 mt-2">{pkg.description}</p>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {pkg.has_insurance && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        <Shield className="h-3 w-3 mr-1" />
                        Asegurado
                      </Badge>
                    )}
                    {pkg.package_image_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedImage(pkg.package_image_url)}
                        className="text-slate-600"
                      >
                        <ImageIcon className="h-4 w-4 mr-1" />
                        Ver Foto
                      </Button>
                    )}
                    <StatusBadge status={pkg.status} />
                  </div>

                  {/* Date */}
                  <div className="text-sm text-slate-500">
                    {new Date(pkg.created_date).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto del Paquete</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <img 
              src={selectedImage} 
              alt="Paquete recibido" 
              className="w-full rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}