import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, UserMinus, UserPlus, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAdministrators({ user }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openInvite, setOpenInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.User.filter({ role: 'admin' }, '-created_date', 200);
      setAdmins(rows || []);
    } catch {
      toast.error('No se pudieron cargar los administradores');
    }
    setLoading(false);
  };

  useEffect(() => { loadAdmins(); }, []);

  const filteredAdmins = useMemo(() => admins.filter((admin) => {
    const q = search.toLowerCase();
    return !q || admin.email?.toLowerCase().includes(q) || admin.full_name?.toLowerCase().includes(q);
  }), [admins, search]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), 'admin');
      toast.success('Invitación de administrador enviada');
      setInviteEmail('');
      setOpenInvite(false);
    } catch {
      toast.error('No se pudo enviar la invitación');
    }
    setInviting(false);
  };

  const handleDemote = async (adminRecord) => {
    if (adminRecord.email === user?.email) {
      toast.error('No puedes quitarte tu propio rol aquí');
      return;
    }
    setProcessingId(adminRecord.id);
    try {
      await base44.entities.User.update(adminRecord.id, { role: 'user', custom_role: null });
      setAdmins((prev) => prev.filter((item) => item.id !== adminRecord.id));
      toast.success('Administrador cambiado a usuario');
    } catch {
      toast.error('No se pudo actualizar el rol');
    }
    setProcessingId(null);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Administradores</h1>
          <p className="text-slate-500">Gestiona administradores; los roles por área se asignan desde el módulo de Roles.</p>
        </div>
        <Button onClick={() => setOpenInvite(true)} className="bg-blue-600 hover:bg-blue-700">
          <UserPlus className="mr-2 h-4 w-4" /> Invitar administrador
        </Button>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o email" className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredAdmins.map((adminRecord) => (
          <Card key={adminRecord.id} className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span className="truncate">{adminRecord.full_name || adminRecord.email}</span>
                <Badge className="bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Admin
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500 break-all">{adminRecord.email}</p>
              <Button
                variant="outline"
                className="w-full text-rose-600 hover:text-rose-700"
                onClick={() => handleDemote(adminRecord)}
                disabled={processingId === adminRecord.id || adminRecord.email === user?.email}
              >
                {processingId === adminRecord.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />}
                Pasar a usuario
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={openInvite} onOpenChange={setOpenInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar administrador</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Email</Label>
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="admin@empresa.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenInvite(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting} className="bg-blue-600 hover:bg-blue-700">
              {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Enviar invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}