import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search } from 'lucide-react';
import SupportImageUploader from '@/components/support/SupportImageUploader';

export default function AdminSupportNewTicketDialog({
  showNewTicket,
  setShowNewTicket,
  clientSearch,
  setClientSearch,
  newTicket,
  setNewTicket,
  clients,
  handleCreateTicket
}) {
  return (
    <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear Ticket para Cliente</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateTicket();
          }}
        >
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar cliente por nombre, email, shipping mark o teléfono..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={newTicket.client_email} onValueChange={(value) => setNewTicket({ ...newTicket, client_email: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients
                    .filter((client) => {
                      const searchLower = (clientSearch || '').toLowerCase();
                      return (
                        !clientSearch ||
                        (client.first_name || '').toLowerCase().includes(searchLower) ||
                        (client.last_name || '').toLowerCase().includes(searchLower) ||
                        (client.email || '').toLowerCase().includes(searchLower) ||
                        (client.shipping_mark || '').toLowerCase().includes(searchLower) ||
                        (client.package_trackings || []).some((tracking) => (tracking || '').toLowerCase().includes(searchLower)) ||
                        (client.package_shipping_marks || []).some((mark) => (mark || '').toLowerCase().includes(searchLower)) ||
                        (client.whatsapp || '').toLowerCase().includes(searchLower) ||
                        (client.telefono || '').toLowerCase().includes(searchLower) ||
                        (client.phone || '').toLowerCase().includes(searchLower)
                      );
                    })
                    .map((client) => (
                      <SelectItem key={client.email} value={client.email}>
                        {client.first_name} {client.last_name} - {client.email}{client.package_trackings?.[0] ? ` - ${client.package_trackings[0]}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Asunto *</Label>
            <Input
              value={newTicket.subject}
              onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              placeholder="Describe brevemente el problema"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={newTicket.category} onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="envio">Envío</SelectItem>
                  <SelectItem value="tracking">Tracking</SelectItem>
                  <SelectItem value="consolidacion">Consolidación</SelectItem>
                  <SelectItem value="actualizar_datos">Actualizar Datos</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={newTicket.priority} onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tracking Relacionado (opcional)</Label>
            <Input
              value={newTicket.related_tracking}
              onChange={(e) => setNewTicket({ ...newTicket, related_tracking: e.target.value })}
              placeholder="Ej: TLEC-123456"
            />
          </div>

          <div className="space-y-2">
            <Label>Mensaje Inicial *</Label>
            <Textarea
              value={newTicket.message}
              onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
              placeholder="Mensaje inicial del ticket..."
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Fotos (opcional)</Label>
            <SupportImageUploader
              files={newTicket.attachments}
              onChange={(attachments) => setNewTicket({ ...newTicket, attachments })}
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setShowNewTicket(false)}>Cancelar</Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Crear Ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}