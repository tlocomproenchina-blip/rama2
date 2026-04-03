import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, UserMinus, UserPlus, Search, Briefcase, Users, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_PRESETS } from '@/lib/rolePermissions';
import PageHero from '@/components/common/PageHero';

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

  const createAuditLog = async (payload) => {
    await base44.entities.EmployeeAuditLog.create({
      actor_email: user?.email || 'system',
      actor_name: user?.full_name || '',
      ...payload,
    });
  };

  const filteredAdmins = useMemo(() => admins.filter((admin) => {
    const q = String(search || '').toLowerCase();
    const email = String(admin.email || '').toLowerCase();
    const fullName = String(admin.full_name || '').toLowerCase();
    return !q || email.includes(q) || fullName.includes(q);
  }), [admins, search]);

  const stats = useMemo(() => ({
    total: admins.length,
    conArea: admins.filter((item) => !!item.custom_role).length,
    sinArea: admins.filter((item) => !item.custom_role).length,
  }), [admins]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), 'admin');
      await createAuditLog({
        target_email: inviteEmail.trim(),
        target_name: '',
        action_type: 'invite_admin',
        area_code: '',
        area_name: 'Administración',
        summary: `Invitó administrador ${inviteEmail.trim()}`,
        details: 'Se envió una invitación con acceso administrativo',
        changed_fields: ['role'],
      });
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
      await createAuditLog({
        target_email: adminRecord.email,
        target_name: adminRecord.full_name || adminRecord.email,
        action_type: 'demote_admin',
        area_code: adminRecord.custom_role || '',
        area_name: adminRecord.custom_role || 'Administración',
        summary: `Quitó acceso admin a ${adminRecord.full_name || adminRecord.email}`,
        details: 'El usuario fue cambiado de administrador a usuario regular',
        changed_fields: ['role', 'custom_role'],
      });
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
    <div className="space-y-8 max-w-6xl mx-auto">
      <PageHero
        icon={KeyRound}
        badge="Acceso administrativo"
        title="Administradores"
        description="Gestiona administradores, revisa si tienen área asignada y accede al módulo de Roles para controlar permisos por área."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total admins</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="rounded-2xl bg-blue-100 p-3 text-blue-700"><Users className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Con área</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.conArea}</p>
              </div>
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Briefcase className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Sin área</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stats.sinArea}</p>
              </div>
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><ShieldCheck className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Directorio de administradores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o email" className="pl-10" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAdmins.map((adminRecord) => (
              <Card key={adminRecord.id} className="overflow-hidden border-0 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/60 pb-4">
                  <CardTitle className="flex items-start justify-between gap-3 text-base">
                    <div className="min-w-0">
                      <span className="block truncate text-slate-900">{adminRecord.full_name || adminRecord.email}</span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className="bg-amber-100 text-amber-700">
                          <ShieldCheck className="mr-1 h-3 w-3" /> {adminRecord.custom_role ? (ROLE_PRESETS[adminRecord.custom_role]?.role_name || adminRecord.custom_role) : 'Administrador'}
                        </Badge>
                        <Badge variant="outline" className="border-blue-200 text-blue-700">
                          <Briefcase className="mr-1 h-3 w-3" />
                          Acceso admin
                        </Badge>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <div className="rounded-xl bg-white p-2 text-slate-500 shadow-sm"><Mail className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Correo</p>
                      <p className="text-sm text-slate-700 break-all">{adminRecord.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
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
        </CardContent>
      </Card>

      <Dialog open={openInvite} onOpenChange={setOpenInvite}>
        <DialogContent className="max-w-md border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Invitar administrador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Email</Label>
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="admin@empresa.com" />
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
              El nuevo usuario recibirá una invitación con acceso administrativo.
            </div>
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