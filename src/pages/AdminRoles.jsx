import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, ShieldCheck, Users, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminRoles({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.User.list('-created_date', 300);
      setUsers(rows || []);
    } catch {
      toast.error('No se pudieron cargar los usuarios');
    }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const areaRoleOptions = useMemo(() => ['operaciones', 'almacen', 'contabilidad', 'soporte', 'marketing'], []);

  const filteredUsers = useMemo(() => users.filter((item) => {
    const q = search.toLowerCase();
    return !q || item.email?.toLowerCase().includes(q) || item.full_name?.toLowerCase().includes(q) || item.role?.toLowerCase().includes(q) || item.custom_role?.toLowerCase().includes(q);
  }), [users, search]);

  const handleRoleChange = async (targetUser, nextRole) => {
    if (targetUser.email === user?.email) {
      toast.error('No puedes cambiar tu propio rol aquí');
      return;
    }
    setProcessingId(targetUser.id);
    try {
      await base44.entities.User.update(targetUser.id, { custom_role: nextRole === 'sin_area' ? null : nextRole });
      setUsers((prev) => prev.map((item) => item.id === targetUser.id ? { ...item, custom_role: nextRole === 'sin_area' ? null : nextRole } : item));
      toast.success('Rol por área actualizado');
    } catch {
      toast.error('No se pudo actualizar el rol por área');
    }
    setProcessingId(null);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Roles por área</h1>
        <p className="text-slate-500">Asigna áreas operativas sin alterar el rol base de admin o cliente.</p>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, email o área" className="pl-10" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredUsers.map((item) => (
          <Card key={item.id} className="border-0 shadow-md">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-800 truncate">{item.full_name || item.email}</h3>
                  <Badge className={item.role === 'admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                    {item.role === 'admin' ? <ShieldCheck className="mr-1 h-3 w-3" /> : <Users className="mr-1 h-3 w-3" />}
                    {item.role || 'user'}
                  </Badge>
                  <Badge variant="outline" className="text-blue-700 border-blue-200">
                    <Briefcase className="mr-1 h-3 w-3" />
                    {item.custom_role || 'sin área'}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 break-all">{item.email}</p>
              </div>

              <div className="w-full md:w-64">
                <Select value={item.custom_role || 'sin_area'} onValueChange={(value) => handleRoleChange(item, value)} disabled={processingId === item.id || item.email === user?.email}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sin_area">Sin área</SelectItem>
                    {areaRoleOptions.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}