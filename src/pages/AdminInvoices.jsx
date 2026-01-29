import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import InvoiceCard from '@/components/invoice/InvoiceCard';
import { FileText, Search, Loader2, Download, DollarSign, TrendingUp, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

export default function AdminInvoices({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    revenue: 0
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [consolidations, setConsolidations] = useState([]);
  const [selectedConsolidation, setSelectedConsolidation] = useState('');
  const [processing, setProcessing] = useState(false);
  const [deleteInvoice, setDeleteInvoice] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadInvoices();
    loadConsolidations();
  }, []);

  const loadInvoices = async () => {
    const data = await base44.entities.Invoice.list('-invoice_date');
    setInvoices(data);
    
    // Calculate stats
    const stats = {
      total: data.length,
      paid: data.filter(i => i.status === 'pagada').length,
      pending: data.filter(i => i.status === 'pendiente').length,
      revenue: data.filter(i => i.status === 'pagada').reduce((sum, i) => sum + i.total, 0)
    };
    setStats(stats);
    
    setLoading(false);
  };

  const loadConsolidations = async () => {
    const data = await base44.entities.Consolidation.list('-created_date');
    setConsolidations(data);
  };

  const handleCreateInvoice = async () => {
    if (!selectedConsolidation) {
      toast.error('Selecciona una consolidación');
      return;
    }

    setProcessing(true);
    try {
      const consolidation = consolidations.find(c => c.id === selectedConsolidation);
      const { generateInvoice } = await import('@/components/invoice/InvoiceGenerator');
      await generateInvoice(consolidation);
      
      toast.success('Factura creada exitosamente');
      setShowCreateModal(false);
      setSelectedConsolidation('');
      loadInvoices();
    } catch (error) {
      toast.error('Error al crear factura');
    }
    setProcessing(false);
  };

  const handleEditInvoice = async () => {
    if (!editingInvoice) return;

    setProcessing(true);
    try {
      await base44.entities.Invoice.update(editingInvoice.id, {
        status: editingInvoice.status,
        notes: editingInvoice.notes
      });
      
      toast.success('Factura actualizada');
      setShowEditModal(false);
      setEditingInvoice(null);
      loadInvoices();
    } catch (error) {
      toast.error('Error al actualizar factura');
    }
    setProcessing(false);
  };

  const handleDeleteInvoice = async () => {
    if (!deleteInvoice) return;
    
    setDeleting(true);
    try {
      await base44.entities.Invoice.delete(deleteInvoice.id);
      toast.success('Factura eliminada exitosamente');
      setDeleteInvoice(null);
      loadInvoices();
    } catch (error) {
      toast.error('Error al eliminar factura');
    }
    setDeleting(false);
  };

  const handleDownloadPDF = async (invoice) => {
    const doc = new jsPDF();
    
    // Get invoice config
    const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
    const appConfig = configs[0] || {};
    
    const companyName = appConfig.invoice_company_name || 'TLEC CARGO LTD';
    const companyTagline = appConfig.invoice_company_tagline || 'Sistema de Envios Internacionales';
    const logoUrl = appConfig.invoice_logo_url;
    
    let yPos = 20;
    
    // Header with logo if available
    if (logoUrl) {
      try {
        const imgData = await fetch(logoUrl).then(res => res.blob()).then(blob => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        });
        doc.addImage(imgData, 'PNG', 20, 10, 40, 15);
        yPos = 30;
      } catch (error) {
        console.error('Error loading logo:', error);
      }
    }
    
    // Company name and tagline
    doc.setFontSize(20);
    doc.text(companyName, logoUrl ? 65 : 20, logoUrl ? 17 : 20);
    doc.setFontSize(10);
    doc.text(companyTagline, logoUrl ? 65 : 20, logoUrl ? 24 : 27);
    
    doc.setFontSize(16);
    doc.text('FACTURA', 150, logoUrl ? 17 : 20);
    doc.setFontSize(10);
    doc.text(`No: ${invoice.invoice_number}`, 150, logoUrl ? 24 : 27);
    doc.text(`Fecha: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 150, logoUrl ? 31 : 33);
    
    yPos = logoUrl ? 45 : 50;
    
    // Client Info
    doc.setFontSize(12);
    doc.text('Cliente:', 20, yPos);
    doc.setFontSize(10);
    
    // Get client details for whatsapp
    const clientUsers = await base44.entities.User.filter({ email: invoice.client_email });
    const clientUser = clientUsers[0];
    
    doc.text(invoice.client_email, 20, yPos + 7);
    yPos += 13;
    
    // Parse notes for client details
    if (invoice.notes) {
      const notesLines = invoice.notes.split('\n').filter(line => 
        !line.startsWith('Paquetes:') && !line.startsWith('Trackings:')
      );
      notesLines.forEach(line => {
        doc.text(line, 20, yPos);
        yPos += 5;
      });
    }
    
    // WhatsApp
    if (clientUser?.whatsapp) {
      doc.text(`WhatsApp: ${clientUser.whatsapp}`, 20, yPos);
      yPos += 5;
    }
    
    // Get packages for this consolidation
    let packages = [];
    let totalFOB = 0;
    if (invoice.consolidation_id) {
      packages = await base44.entities.Package.filter({ 
        consolidation_id: invoice.consolidation_id 
      });
      totalFOB = packages.reduce((sum, pkg) => sum + (pkg.fob_value || 0), 0);
    }
    
    yPos += 5;
    
    // Show tracking list
    if (packages.length > 0) {
      doc.setFontSize(10);
      doc.text(`Paquetes: ${packages.length}`, 20, yPos);
      yPos += 5;
      doc.setFontSize(9);
      doc.text('Trackings:', 20, yPos);
      yPos += 5;
      
      packages.forEach((pkg) => {
        // Check if we need a new page
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        const fobText = pkg.fob_value ? `FOB: $${pkg.fob_value.toFixed(2)}` : 'Sin seguro';
        
        // Tracking number
        doc.text(pkg.tracking_number, 25, yPos);
        
        // Description (wrapped if too long)
        const descLines = doc.splitTextToSize(pkg.description || 'N/A', 100);
        descLines.forEach((line, idx) => {
          doc.text(line, 80, yPos + (idx * 4));
        });
        
        // FOB value aligned to the right
        doc.text(fobText, 190, yPos, { align: 'right' });
        
        yPos += Math.max(4, descLines.length * 4);
      });
      
      yPos += 5;
    }
    
    // Items Section
    doc.setFontSize(12);
    doc.text('Concepto', 20, yPos);
    doc.text('Total', 170, yPos);
    yPos += 5;
    doc.line(20, yPos, 190, yPos);
    yPos += 7;
    
    doc.setFontSize(10);
    invoice.items?.forEach(item => {
      // Check if we need a new page
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.text(item.description, 20, yPos);
      doc.text(`$${item.total.toFixed(2)}`, 170, yPos);
      yPos += 6;
      
      // Add insurance details if it's insurance item
      if (item.description.toLowerCase().includes('seguro')) {
        doc.setFontSize(8);
        doc.text(`  Total FOB Declarado: $${totalFOB.toFixed(2)}`, 20, yPos);
        yPos += 4;
        doc.text(`  Tasa de Seguro: 5%`, 20, yPos);
        yPos += 4;
        doc.setFontSize(10);
        yPos += 3;
      }
    });
    
    // Check if we need a new page for totals
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    yPos += 5;
    doc.line(20, yPos, 190, yPos);
    yPos += 7;
    doc.setFontSize(12);
    doc.text('TOTAL:', 130, yPos);
    doc.text(`$${invoice.total.toFixed(2)}`, 170, yPos);
    
    yPos += 10;
    doc.setFontSize(10);
    doc.text(`Estado: ${invoice.status.toUpperCase()}`, 20, yPos);
    
    if (invoice.payment_date) {
      yPos += 7;
      doc.text(`Pagado: ${new Date(invoice.payment_date).toLocaleDateString()}`, 20, yPos);
      if (invoice.payment_method) {
        yPos += 5;
        doc.text(`Metodo: ${invoice.payment_method}`, 20, yPos);
      }
    }
    
    doc.save(`factura-${invoice.invoice_number}.pdf`);
    toast.success('Factura descargada');
  };

  const handleExportAll = () => {
    const csv = ['Número,Cliente,Fecha,Total,Estado,Método de Pago'];
    invoices.forEach(inv => {
      csv.push([
        inv.invoice_number,
        inv.client_email,
        new Date(inv.invoice_date).toLocaleDateString(),
        inv.total.toFixed(2),
        inv.status,
        inv.payment_method || 'N/A'
      ].join(','));
    });
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `facturas-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('Reporte exportado');
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.client_email.toLowerCase().includes(search.toLowerCase()) ||
      inv.consolidation_tracking.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Facturas</h1>
          <p className="text-slate-500">Administra facturas y pagos de clientes</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Crear Factura
          </Button>
          <Button onClick={handleExportAll} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Facturas</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pagadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <FileText className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ingresos</p>
                <p className="text-2xl font-bold text-emerald-600">${stats.revenue.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, cliente o tracking..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
          <TabsTrigger value="pagada">Pagadas</TabsTrigger>
          <TabsTrigger value="vencida">Vencidas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Invoice List */}
      {filteredInvoices.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-slate-500">No se encontraron facturas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredInvoices.map(invoice => (
            <div key={invoice.id} className="relative group">
              <InvoiceCard
                invoice={invoice}
                onDownload={handleDownloadPDF}
                showPayButton={false}
              />
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingInvoice(invoice);
                    setShowEditModal(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteInvoice(invoice)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Invoice Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Factura Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Seleccionar Consolidación</Label>
              <Select value={selectedConsolidation} onValueChange={setSelectedConsolidation}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una consolidación" />
                </SelectTrigger>
                <SelectContent>
                  {consolidations.map(cons => (
                    <SelectItem key={cons.id} value={cons.id}>
                      {cons.consolidation_tracking} - {cons.client_email} - ${cons.total_cost.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateInvoice} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Crear Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Factura</DialogTitle>
          </DialogHeader>
          {editingInvoice && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select 
                  value={editingInvoice.status} 
                  onValueChange={(val) => setEditingInvoice({...editingInvoice, status: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagada">Pagada</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input
                  value={editingInvoice.notes || ''}
                  onChange={(e) => setEditingInvoice({...editingInvoice, notes: e.target.value})}
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditInvoice} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteInvoice} onOpenChange={() => setDeleteInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar la factura{' '}
              <span className="font-semibold text-slate-800">{deleteInvoice?.invoice_number}</span>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteInvoice();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Eliminar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}