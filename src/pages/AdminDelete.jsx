import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Trash2, 
  Search, 
  Loader2, 
  AlertTriangle,
  Package,
  Box,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/StatusBadge';

export default function AdminDelete({ user }) {
  const [packages, setPackages] = useState([]);
  const [consolidations, setConsolidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, item: null });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [pkgs, cons] = await Promise.all([
      base44.entities.Package.list('-created_date'),
      base44.entities.Consolidation.list('-created_date')
    ]);
    setPackages(pkgs);
    setConsolidations(cons);
    setLoading(false);
  };

  const handleDeletePackage = async (pkg) => {
    setDeleting(true);
    try {
      // If package is in a consolidation, update the consolidation
      if (pkg.consolidation_id) {
        const consolidations = await base44.entities.Consolidation.filter({ id: pkg.consolidation_id });
        if (consolidations.length > 0) {
          const cons = consolidations[0];
          
          // Remove package from consolidation arrays
          const updatedPackageIds = (cons.package_ids || []).filter(id => id !== pkg.id);
          const updatedTrackingNumbers = (cons.tracking_numbers || []).filter(tn => tn !== pkg.tracking_number);
          
          // If no packages left, delete the consolidation
          if (updatedPackageIds.length === 0) {
            await base44.entities.Consolidation.delete(cons.id);
            
            // Delete related invoice if exists
            const invoices = await base44.entities.Invoice.filter({ consolidation_id: cons.id });
            for (const invoice of invoices) {
              await base44.entities.Invoice.delete(invoice.id);
            }
            
            toast.success('Paquete y consolidación vacía eliminados');
          } else {
            // Update consolidation to remove this package
            await base44.entities.Consolidation.update(cons.id, {
              package_ids: updatedPackageIds,
              tracking_numbers: updatedTrackingNumbers
            });
            toast.success('Paquete eliminado y consolidación actualizada');
          }
        }
      }

      // Delete the package
      await base44.entities.Package.delete(pkg.id);
      
      loadData();
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error('Error al eliminar el paquete');
    }
    setDeleting(false);
    setDeleteDialog({ open: false, type: null, item: null });
  };

  const handleDeleteConsolidation = async (cons) => {
    setDeleting(true);
    try {
      // Update packages to remove consolidation reference
      for (const pkgId of (cons.package_ids || [])) {
        try {
          await base44.entities.Package.update(pkgId, { 
            consolidation_id: null,
            status: 'recibido'
          });
        } catch (err) {
          console.error('Error updating package:', err);
        }
      }

      // Delete related invoices
      const invoices = await base44.entities.Invoice.filter({ consolidation_id: cons.id });
      for (const invoice of invoices) {
        await base44.entities.Invoice.delete(invoice.id);
      }

      // Delete the consolidation
      await base44.entities.Consolidation.delete(cons.id);
      
      // Notify client
      base44.integrations.Core.SendEmail({
        to: cons.client_email,
        subject: '⚠️ Consolidación Cancelada',
        body: `Tu consolidación ${cons.consolidation_tracking} ha sido cancelada.\n\nTus paquetes han sido devueltos al estado "Recibido" y estarán disponibles para una nueva consolidación.\n\nLas facturas relacionadas también han sido eliminadas.\n\nPor favor contáctanos si tienes dudas.`
      }).catch(err => console.error('Email error:', err));

      base44.entities.Notification.create({
        user_email: cons.client_email,
        title: '⚠️ Consolidación Cancelada',
        message: `La consolidación ${cons.consolidation_tracking} ha sido cancelada. Tus paquetes están disponibles.`,
        type: 'consolidation',
        icon: 'alert'
      }).catch(err => console.error('Notification error:', err));

      toast.success('Consolidación, facturas relacionadas eliminadas y cliente notificado');
      loadData();
    } catch (error) {
      console.error('Error deleting consolidation:', error);
      toast.error('Error al eliminar la consolidación');
    }
    setDeleting(false);
    setDeleteDialog({ open: false, type: null, item: null });
  };

  const filteredPackages = packages.filter(pkg => 
    pkg.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
    (pkg.shipping_mark || '').toLowerCase().includes(search.toLowerCase()) ||
    (pkg.client_email || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredConsolidations = consolidations.filter(cons => 
    (cons.consolidation_tracking || '').toLowerCase().includes(search.toLowerCase()) ||
    (cons.shipping_mark || '').toLowerCase().includes(search.toLowerCase()) ||
    (cons.client_email || '').toLowerCase().includes(search.toLowerCase())
  );

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
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold text-red-800">Gestión de Eliminaciones</h1>
            <p className="text-red-600 text-sm mt-1">
              ⚠️ Zona de peligro: Las eliminaciones son permanentes y no se pueden deshacer.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por tracking, shipping mark o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="packages" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="packages">Paquetes</TabsTrigger>
          <TabsTrigger value="consolidations">Consolidaciones</TabsTrigger>
        </TabsList>

        {/* Packages Tab */}
        <TabsContent value="packages" className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-600" />
                Eliminar Paquetes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredPackages.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No se encontraron paquetes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPackages.map((pkg) => (
                    <div key={pkg.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono font-medium text-slate-800">{pkg.tracking_number}</span>
                          {pkg.has_insurance && (
                            <Shield className="h-4 w-4 text-emerald-600" />
                          )}
                          <StatusBadge status={pkg.status} size="sm" />
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span>{pkg.client_email}</span>
                          <span>•</span>
                          <span>{pkg.shipping_mark || 'Sin shipping mark'}</span>
                          {pkg.consolidation_id && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600 font-medium">En consolidación (se actualizará)</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteDialog({ open: true, type: 'package', item: pkg })}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consolidations Tab */}
        <TabsContent value="consolidations" className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="h-5 w-5 text-slate-600" />
                Eliminar Consolidaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredConsolidations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Box className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No se encontraron consolidaciones</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredConsolidations.map((cons) => (
                    <div key={cons.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono font-medium text-slate-800">{cons.consolidation_tracking}</span>
                          <StatusBadge status={cons.status} size="sm" />
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span>{cons.client_email}</span>
                          <span>•</span>
                          <span>{cons.shipping_mark || 'Sin shipping mark'}</span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">${cons.total_cost?.toFixed(2)}</span>
                          <span>•</span>
                          <span>{cons.package_ids?.length || 0} paquetes</span>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteDialog({ open: true, type: 'consolidation', item: cons })}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !deleting && setDeleteDialog({ open, type: null, item: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              ¿Estás seguro?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {deleteDialog.type === 'package' ? (
                <>
                  <p>Estás a punto de eliminar el paquete:</p>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-mono font-medium text-slate-800">{deleteDialog.item?.tracking_number}</p>
                    <p className="text-sm text-slate-600">{deleteDialog.item?.client_email}</p>
                  </div>
                  {deleteDialog.item?.consolidation_id && (
                    <p className="text-blue-600 font-medium">ℹ️ Este paquete está en una consolidación. Se actualizará automáticamente la consolidación.</p>
                  )}
                </>
              ) : (
                <>
                  <p>Estás a punto de eliminar la consolidación:</p>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-mono font-medium text-slate-800">{deleteDialog.item?.consolidation_tracking}</p>
                    <p className="text-sm text-slate-600">{deleteDialog.item?.client_email}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      {deleteDialog.item?.package_ids?.length || 0} paquetes serán liberados
                    </p>
                  </div>
                  <p className="text-red-600 font-medium">El cliente será notificado de la cancelación.</p>
                </>
              )}
              <p className="text-red-600 font-bold">Esta acción no se puede deshacer.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog.type === 'package') {
                  handleDeletePackage(deleteDialog.item);
                } else {
                  handleDeleteConsolidation(deleteDialog.item);
                }
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</>
              ) : (
                <>Eliminar Permanentemente</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}