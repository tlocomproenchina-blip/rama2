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
                  type="text"
                  placeholder="Buscar cliente por nombre, email, shipping mark o teléfono..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className="pl-10"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border/80 bg-white/90">
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
                  .map((client) => {
                    const isSelected = newTicket.client_email === client.email;
                    return (
                      <button
                        key={client.email}
                        type="button"
                        onClick={() => setNewTicket({ ...newTicket, client_email: client.email })}
                        className={`w-full border-b border-border/60 px-3 py-3 text-left text-sm last:border-b-0 ${isSelected ? 'bg-accent text-accent-foreground' : 'bg-transparent text-slate-700'}`}
                      >
                        {client.first_name} {client.last_name} - {client.email}{client.package_trackings?.[0] ? ` - ${client.package_trackings[0]}` : ''}
                      </button>
                    );
                  })}
                {clients.filter((client) => {
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
                }).length === 0 && (
                  <div className="px-3 py-3 text-sm text-slate-500">No se encontraron clientes</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Asunto *</Label>
            <Input
              type="text"
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
              type="text"
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setShowNewTicket(false)}>Cancelar</Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Crear Ticket</Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}