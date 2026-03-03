import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Trash2, Send, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ReportsSettings() {
  const [recipients, setRecipients] = useState([]);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => { loadRecipients(); }, []);

  const loadRecipients = async () => {
    setLoading(true);
    const list = await base44.entities.ReportRecipient.list();
    // Seed default if empty
    if (list.length === 0) {
      try {
        await base44.entities.ReportRecipient.create({ email: 'tleccargo@gmail.com', active: true, name: 'TLEC' });
        const seeded = await base44.entities.ReportRecipient.list();
        setRecipients(seeded);
      } catch (_) {
        setRecipients(list);
      } finally {
        setLoading(false);
      }
      return;
    }
    setRecipients(list);
    setLoading(false);
  };

  const validEmail = (e) => /.+@.+\..+/.test(e);

  const addRecipient = async () => {
    if (!validEmail(email)) { toast.error('Ingresa un email válido'); return; }
    setAdding(true);
    await base44.entities.ReportRecipient.create({ email, active: true });
    setEmail('');
    await loadRecipients();
    setAdding(false);
    toast.success('Destinatario agregado');
  };

  const inviteAndAddRecipient = async () => {
    if (!validEmail(email)) { toast.error('Ingresa un email válido'); return; }
    if (!firstName.trim() || !lastName.trim()) { toast.error('Nombre y apellido son obligatorios'); return; }
    setInviting(true);
    try {
      await base44.users.inviteUser(email, 'user');
      const users = await base44.entities.User.filter({ email });
      if (users.length > 0) {
        await base44.entities.User.update(users[0].id, {
          first_name: firstName,
          last_name: lastName,
          phone
        });
      }
      await base44.entities.ReportRecipient.create({ email, name: `${firstName} ${lastName}`.trim(), active: true });
      setEmail(''); setFirstName(''); setLastName(''); setPhone('');
      await loadRecipients();
      toast.success('Usuario invitado y agregado como destinatario');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo invitar/agregar el destinatario');
    } finally {
      setInviting(false);
    }
  };

  const toggleActive = async (r, active) => {
    await base44.entities.ReportRecipient.update(r.id, { active });
    setRecipients(prev => prev.map(x => x.id === r.id ? { ...x, active } : x));
  };

  const remove = async (r) => {
    await base44.entities.ReportRecipient.delete(r.id);
    setRecipients(prev => prev.filter(x => x.id !== r.id));
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendDailyNewClientsReport', {});
      if (res.status === 200) {
        const data = res.data || {};
        const sent = data.recipients?.length || 0;
        const skipped = data.skipped?.length || 0;
        if (sent === 0) {
          if (skipped > 0) {
            toast.info(`Sin destinatarios válidos (omitidos ${skipped}). Añade emails de usuarios registrados.`);
          } else {
            toast.info('No hay destinatarios activos.');
          }
          return;
        }
        const url = data.signed_url;
        toast.success(`Reporte enviado a ${sent} destinatario(s).`);
        if (url) { window.open(url, '_blank'); }
      } else {
        toast.error('No se pudo enviar el reporte');
      }
    } catch (e) {
      toast.error('Error al enviar el reporte');
    }
    setSending(false);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Reportes</CardTitle>
        <CardDescription>Lista de destinatarios del reporte diario de nuevos clientes y envío manual.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 rounded-lg bg-slate-50 border text-sm text-slate-600">
          Se envía todos los días a las 22:00 (hora Caracas) el Excel de clientes nuevos de ayer. El enlace caduca en 7 días.
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <Label>Email del destinatario</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto">
            <div>
              <Label>Nombre</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" />
            </div>
            <div>
              <Label>Apellido</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+58 412 1234567" />
            </div>
          </div>
          <Button onClick={addRecipient} disabled={adding} className="gap-2">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar
          </Button>
          <Button onClick={inviteAndAddRecipient} variant="secondary" disabled={inviting} className="gap-2">
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Invitar y agregar
          </Button>
          <Button onClick={sendNow} variant="outline" disabled={sending} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar ahora
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-slate-500">Cargando...</div>
          ) : recipients.length === 0 ? (
            <div className="p-6 text-center text-slate-500">Sin destinatarios</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Nombre</th>
                  <th className="text-center p-3">Activo</th>
                  <th className="text-center p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium text-slate-800">{r.email}</td>
                    <td className="p-3 text-slate-600">{r.name || '-'}</td>
                    <td className="p-3 text-center">
                      <Switch checked={!!r.active} onCheckedChange={(v) => toggleActive(r, v)} />
                    </td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="icon" onClick={() => remove(r)}>
                        <Trash2 className="h-4 w-4 text-slate-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}