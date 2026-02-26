import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, 
  Search, 
  Eye,
  Loader2,
  DollarSign,
  FileText,
  Package,
  ExternalLink
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminInsured({ user }) {
  const [packages, setPackages] = useState([]);
  const [consolidations, setConsolidations] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewInvoice, setViewInvoice] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [pkgs, cons, configs] = await Promise.all([
      base44.entities.Package.filter({ has_insurance: true }, '-created_date'),
      base44.entities.Consolidation.list(),
      base44.entities.AppConfig.filter({ config_key: 'main' })
    ]);

    setPackages(pkgs);
    setConsolidations(cons);
    if (configs.length > 0) setConfig(configs[0]);
    setLoading(false);
  };

  const getConsolidation = (pkgId) => {
    return consolidations.find(c => c.package_ids?.includes(pkgId));
  };

  const calculateInsurance = (fob) => {
    return fob * ((config?.insurance_percentage || 5) / 100);
  };

  const filteredPackages = packages.filter(pkg => {
    const searchLower = search.toLowerCase();
    return (
      pkg.tracking_number.toLowerCase().includes(searchLower) ||
      (pkg.client_email || '').toLowerCase().includes(searchLower) ||
      (pkg.shipping_mark || '').toLowerCase().includes(searchLower)
    );
  });

  const totalFOB = packages.reduce((sum, p) => sum + (p.fob_value || 0), 0);
  const totalInsurance = packages.reduce((sum, p) => sum + calculateInsurance(p.fob_value || 0), 0);

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
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Tracking Asegurados</h1>
        <p className="text-slate-500">Gestiona los envíos con seguro</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Asegurados</p>
                <p className="text-3xl font-bold text-slate-800">{packages.length}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total FOB</p>
                <p className="text-3xl font-bold text-slate-800">${totalFOB.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Seguros</p>
                <p className="text-3xl font-bold text-slate-800">${totalInsurance.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <ShieldCheck className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">% Seguro</p>
                <p className="text-3xl font-bold text-slate-800">{config?.insurance_percentage || 5}%</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <FileText className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por tracking, email o shipping mark..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Insured Packages Table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left p-4 font-medium text-slate-600">Tracking</th>
                <th className="text-left p-4 font-medium text-slate-600">Cliente</th>
                <th className="text-left p-4 font-medium text-slate-600">FOB</th>
                <th className="text-left p-4 font-medium text-slate-600">Seguro</th>
                <th className="text-left p-4 font-medium text-slate-600">Consolidación</th>
                <th className="text-left p-4 font-medium text-slate-600">Estado</th>
                <th className="text-left p-4 font-medium text-slate-600">Factura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPackages.map((pkg) => {
                const consolidation = getConsolidation(pkg.id);
                return (
                  <tr key={pkg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-400" />
                        <span className="font-mono font-medium text-slate-800">{pkg.tracking_number}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-slate-800">{pkg.client_email}</p>
                        <p className="text-sm text-slate-500 font-mono">{pkg.shipping_mark}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-slate-800">${pkg.fob_value?.toFixed(2)}</span>
                    </td>
                    <td className="p-4">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        ${calculateInsurance(pkg.fob_value).toFixed(2)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {consolidation ? (
                        <span className="font-mono text-sm text-slate-600">
                          {consolidation.consolidation_tracking}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={pkg.status} size="sm" />
                    </td>
                    <td className="p-4">
                      {pkg.invoice_url ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setViewInvoice(pkg.invoice_url)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPackages.length === 0 && (
          <div className="p-12 text-center">
            <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No se encontraron envíos asegurados</p>
          </div>
        )}
      </Card>

      {/* Invoice Modal */}
      <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Factura
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {viewInvoice?.endsWith('.pdf') ? (
              <div className="flex flex-col items-center gap-4">
                <FileText className="h-16 w-16 text-slate-400" />
                <a 
                  href={viewInvoice} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir PDF
                </a>
              </div>
            ) : (
              <img src={viewInvoice} alt="Factura" className="w-full rounded-lg" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}