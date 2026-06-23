import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CANONICAL_STATE_NAMES } from '@/components/utils/states';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Package, 
  Layers, 
  DollarSign, 
  User,
  Loader2,
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Plus,
  Trash2
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import OptimizedImage from '@/components/OptimizedImage';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ClientDetailsModal({ client, open, onClose, onClientUpdated }) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [consolidations, setConsolidations] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [newNote, setNewNote] = useState({ text: '', type: 'general' });
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (open && client) {
      loadClientData();
    }
  }, [open, client]);

  const loadClientData = async () => {
    setLoading(true);
    const [pkgs, cons, clientNotes] = await Promise.all([
      base44.entities.Package.filter({ client_email: client.email }),
      base44.entities.Consolidation.filter({ client_email: client.email }),
      base44.entities.ClientNote.filter({ client_email: client.email })
    ]);
    setPackages(pkgs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setConsolidations(cons.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setNotes(clientNotes.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setLoading(false);
  };

  const reloadNotes = async () => {
    const clientNotes = await base44.entities.ClientNote.filter({ client_email: client.email });
    setNotes(clientNotes.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
  };

  const handleAddNote = async () => {
    if (!newNote.text.trim()) {
      toast.error('Escribe una nota primero');
      return;
    }
    setSavingNote(true);
    try {
      const currentUser = await base44.auth.me();
      await base44.entities.ClientNote.create({
        client_email: client.email,
        note: newNote.text,
        note_type: newNote.type,
        created_by: currentUser.email
      });
      setNewNote({ text: '', type: 'general' });
      toast.success('Nota agregada');
      reloadNotes();
    } catch (error) {
      toast.error('Error al agregar nota');
    }
    setSavingNote(false);
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await base44.entities.ClientNote.delete(noteId);
      toast.success('Nota eliminada');
      // Optimistic UI: quitar localmente sin recargar
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (error) {
      toast.error('Error al eliminar nota');
    }
  };

  if (!client) return null;

  const totalPaid = consolidations
    .filter(c => c.payment_validated)
    .reduce((sum, c) => sum + (c.payment_amount || 0), 0);

  const pendingPayments = consolidations
    .filter(c => c.status === 'pendiente_pago' || c.status === 'pago_pendiente_validacion')
    .reduce((sum, c) => sum + (c.total_cost || 0), 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold">
                {(client.first_name?.[0] || client.email[0]).toUpperCase()}
              </div>
              <div>
                <div className="text-lg">
                  {client.first_name && client.last_name 
                    ? `${client.first_name} ${client.last_name}`
                    : client.email
                  }
                </div>
                <div className="text-sm text-slate-500 font-normal">{client.email}</div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Client Info Section */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg mb-4">
            <div>
              <p className="text-xs text-slate-600 font-medium mb-1">Estado</p>
              <p className="text-sm text-slate-800">{CANONICAL_STATE_NAMES[client.state] || client.state || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium mb-1">Ciudad</p>
              <p className="text-sm text-slate-800">{client.city || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium mb-1">Cédula</p>
              <p className="text-sm text-slate-800">{client.cedula || client.id_number || client.identification || '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-600 font-medium mb-1">Dirección</p>
              <p className="text-sm text-slate-800">{client.address || '—'}</p>
            </div>
            {client.whatsapp && (
              <div className="col-span-2">
                <p className="text-xs text-slate-600 font-medium mb-1">WhatsApp</p>
                <p className="text-sm text-slate-800">{client.whatsapp}</p>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 my-4">
            <Card className="border-0 shadow-sm bg-blue-50">
              <CardContent className="p-4 text-center">
                <Package className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-bold text-slate-800">{packages.length}</p>
                <p className="text-xs text-slate-600">Paquetes</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-purple-50">
              <CardContent className="p-4 text-center">
                <Layers className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                <p className="text-2xl font-bold text-slate-800">{consolidations.length}</p>
                <p className="text-xs text-slate-600">Consolidaciones</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-emerald-50">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                <p className="text-2xl font-bold text-slate-800">${totalPaid.toFixed(2)}</p>
                <p className="text-xs text-slate-600">Total Pagado</p>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <Tabs defaultValue="packages" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="packages">Paquetes</TabsTrigger>
                <TabsTrigger value="consolidations">Consolidaciones</TabsTrigger>
                <TabsTrigger value="payments">Pagos</TabsTrigger>
                <TabsTrigger value="notes">Notas</TabsTrigger>
              </TabsList>

              {/* Packages Tab */}
              <TabsContent value="packages" className="space-y-3 mt-4">
                {packages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    <p>No hay paquetes registrados</p>
                  </div>
                ) : (
                  packages.map((pkg) => (
                    <Card key={pkg.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-mono font-medium text-slate-800">{pkg.tracking_number}</p>
                              <StatusBadge status={pkg.status} size="sm" />
                              {pkg.has_insurance && (
                                <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                  Asegurado ${pkg.fob_value}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                              <span className="capitalize">
                                {pkg.shipping_type === 'aereo' ? '✈️ Aéreo' : '🚢 Marítimo'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(pkg.created_date), 'dd/MM/yyyy')}
                              </span>
                            </div>
                            {pkg.description && (
                              <p className="text-sm text-slate-500 mt-1">{pkg.description}</p>
                            )}
                          </div>
                          {pkg.package_image_url && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedImage(pkg.package_image_url)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Consolidations Tab */}
              <TabsContent value="consolidations" className="space-y-3 mt-4">
                {consolidations.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Layers className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    <p>No hay consolidaciones</p>
                  </div>
                ) : (
                  consolidations.map((con) => (
                    <Card key={con.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                     <CardContent className="p-4">
                       <div className="flex items-start justify-between">
                         <div className="flex-1">
                           <div className="flex items-center gap-3 mb-2">
                             <p className="font-mono font-medium text-slate-800">
                               {con.consolidation_tracking}
                             </p>
                             <StatusBadge status={con.status} size="sm" />
                           </div>
                           <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                             <span>Peso: {con.billable_weight} kg</span>
                             <span>Costo: ${con.total_cost?.toFixed(2)}</span>
                             <span>
                               {con.tracking_numbers?.length || 0} paquetes
                             </span>
                             <span className="flex items-center gap-1">
                               <Calendar className="h-3 w-3" />
                               {format(new Date(con.created_date), 'dd/MM/yyyy')}
                             </span>
                           </div>
                           {con.estimated_delivery && (
                             <p className="text-sm text-slate-500 mt-2">
                               Entrega estimada: {format(new Date(con.estimated_delivery), 'dd/MM/yyyy')}
                             </p>
                           )}

                           {/* Timeline */}
                           <div className="mt-4 space-y-2">
                             <div className={`flex items-center gap-2 text-xs ${
                               con.status === 'en_transito' || con.status === 'pago_validado' || con.status === 'disponible' || con.status === 'entregado' 
                                 ? 'text-emerald-600' : 'text-slate-400'
                             }`}>
                               <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                 con.status === 'en_transito' || con.status === 'pago_validado' || con.status === 'disponible' || con.status === 'entregado'
                                   ? 'bg-emerald-100' : 'bg-slate-100'
                               }`}>
                                 {(con.status === 'en_transito' || con.status === 'pago_validado' || con.status === 'disponible' || con.status === 'entregado') && 
                                   <CheckCircle className="h-3 w-3" />
                                 }
                               </div>
                               <span className="font-medium">Consolidación Creada</span>
                               <span className="text-slate-500">
                                 {format(new Date(con.created_date), 'dd/MM/yyyy HH:mm')}
                               </span>
                             </div>

                             <div className={`flex items-center gap-2 text-xs ${
                               con.status === 'en_transito' || con.status === 'pago_validado' || con.status === 'disponible' || con.status === 'entregado' 
                                 ? 'text-blue-600' : 'text-slate-400'
                             }`}>
                               <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                 con.status === 'en_transito' || con.status === 'pago_validado' || con.status === 'disponible' || con.status === 'entregado'
                                   ? 'bg-blue-100' : 'bg-slate-100'
                               }`}>
                                 {(con.status === 'en_transito' || con.status === 'pago_validado' || con.status === 'disponible' || con.status === 'entregado') && 
                                   <CheckCircle className="h-3 w-3" />
                                 }
                               </div>
                               <span className="font-medium">En Tránsito</span>
                             </div>

                             <div className={`flex items-center gap-2 text-xs ${
                               con.status === 'pago_validado' || con.status === 'disponible' || con.status === 'entregado' 
                                 ? 'text-emerald-600' : 'text-slate-400'
                             }`}>
                               <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                 con.status === 'pago_validado' || con.status === 'disponible' || con.status === 'entregado'
                                   ? 'bg-emerald-100' : 'bg-slate-100'
                               }`}>
                                 {(con.status === 'pago_validado' || con.status === 'disponible' || con.status === 'entregado') && 
                                   <CheckCircle className="h-3 w-3" />
                                 }
                               </div>
                               <span className="font-medium">Pago Validado</span>
                               {con.payment_validation_date && (
                                 <span className="text-slate-500">
                                   {format(new Date(con.payment_validation_date), 'dd/MM/yyyy HH:mm')}
                                 </span>
                               )}
                             </div>

                             <div className={`flex items-center gap-2 text-xs ${
                               con.status === 'disponible' || con.status === 'entregado' 
                                 ? 'text-amber-600' : 'text-slate-400'
                             }`}>
                               <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                 con.status === 'disponible' || con.status === 'entregado'
                                   ? 'bg-amber-100' : 'bg-slate-100'
                               }`}>
                                 {(con.status === 'disponible' || con.status === 'entregado') && 
                                   <CheckCircle className="h-3 w-3" />
                                 }
                               </div>
                               <span className="font-medium">Disponible para Retiro</span>
                             </div>

                             <div className={`flex items-center gap-2 text-xs ${
                               con.status === 'entregado' 
                                 ? 'text-purple-600' : 'text-slate-400'
                             }`}>
                               <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                 con.status === 'entregado'
                                   ? 'bg-purple-100' : 'bg-slate-100'
                               }`}>
                                 {con.status === 'entregado' && 
                                   <CheckCircle className="h-3 w-3" />
                                 }
                               </div>
                               <span className="font-medium">Entregado</span>
                             </div>
                           </div>
                         </div>
                       </div>
                     </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="space-y-3 mt-4">
                {/* Add Note Form */}
                <Card className="border-0 shadow-sm bg-blue-50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-blue-800 font-medium">
                      <Plus className="h-4 w-4" />
                      Agregar Nueva Nota
                    </div>
                    <Select value={newNote.type} onValueChange={(value) => setNewNote({ ...newNote, type: value })}>
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="payment">Pago</SelectItem>
                        <SelectItem value="shipping">Envío</SelectItem>
                        <SelectItem value="support">Soporte</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={newNote.text}
                      onChange={(e) => setNewNote({ ...newNote, text: e.target.value })}
                      placeholder="Escribe una nota sobre el cliente..."
                      rows={3}
                      className="bg-white"
                    />
                    <Button 
                      onClick={handleAddNote} 
                      disabled={savingNote}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {savingNote ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                      Agregar Nota
                    </Button>
                  </CardContent>
                </Card>

                {/* Notes List */}
                {notes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    <p>No hay notas registradas</p>
                  </div>
                ) : (
                  notes.map((note) => (
                    <Card key={note.id} className="border-0 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {note.note_type === 'general' && '📝 General'}
                                {note.note_type === 'payment' && '💰 Pago'}
                                {note.note_type === 'shipping' && '📦 Envío'}
                                {note.note_type === 'support' && '🎫 Soporte'}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {format(new Date(note.created_date), 'dd/MM/yyyy HH:mm')}
                              </span>
                              <span className="text-xs text-slate-400">
                                por {note.created_by}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-line">{note.note}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments" className="space-y-3 mt-4">
                {consolidations.filter(c => c.payment_date || c.status === 'pendiente_pago').length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    <p>No hay pagos registrados</p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <Card className="border-0 shadow-sm bg-slate-50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-slate-600">Total Pagado</p>
                            <p className="text-2xl font-bold text-emerald-600">${totalPaid.toFixed(2)}</p>
                          </div>
                          {pendingPayments > 0 && (
                            <div className="text-right">
                              <p className="text-sm text-slate-600">Pendiente</p>
                              <p className="text-2xl font-bold text-amber-600">${pendingPayments.toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Payment History */}
                    {consolidations
                      .filter(c => c.payment_date || c.status === 'pendiente_pago')
                      .map((con) => (
                        <Card key={con.id} className="border-0 shadow-sm">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <p className="font-mono text-sm text-slate-800">
                                    {con.consolidation_tracking}
                                  </p>
                                  {con.payment_validated ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Pagado
                                    </Badge>
                                  ) : con.status === 'pago_pendiente_validacion' ? (
                                    <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      En validación
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-orange-100 text-orange-700 text-xs">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Pendiente
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-slate-600 space-y-1">
                                  <p>
                                    <span className="font-medium">Monto:</span> ${(con.payment_amount || con.total_cost)?.toFixed(2)}
                                  </p>
                                  {con.payment_method && (
                                    <p className="capitalize">
                                      <span className="font-medium">Método:</span>{' '}
                                      {con.payment_method === 'binance' ? 'Binance' : 'USDT TRC20'}
                                    </p>
                                  )}
                                  {con.payment_date && (
                                    <p>
                                      <span className="font-medium">Fecha:</span>{' '}
                                      {format(new Date(con.payment_date), 'dd/MM/yyyy HH:mm')}
                                    </p>
                                  )}
                                  {con.payment_validated_by && (
                                    <p>
                                      <span className="font-medium">Validado por:</span> {con.payment_validated_by}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {con.payment_proof_url && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedImage(con.payment_proof_url)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          {selectedImage && (
            <OptimizedImage
              src={selectedImage}
              alt="Imagen"
              priority
              className="w-full rounded-lg aspect-[4/3]"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}