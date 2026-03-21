import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHero from '@/components/common/PageHero';
import InternalMessagingStats from '@/components/internal-messaging/InternalMessagingStats';
import InternalConversationList from '@/components/internal-messaging/InternalConversationList';
import InternalMessageList from '@/components/internal-messaging/InternalMessageList';
import InternalMessageComposer from '@/components/internal-messaging/InternalMessageComposer';
import CreateConversationDialog from '@/components/internal-messaging/CreateConversationDialog';

const AREA_LABELS = {
  operaciones: 'Operaciones',
  almacen: 'Almacén',
  contabilidad: 'Contabilidad',
  soporte: 'Soporte',
  marketing: 'Marketing',
  logistica: 'Logística',
  comunicaciones: 'Comunicaciones',
  seguimiento: 'Seguimiento',
  equipo_y_acceso: 'Equipo y Acceso',
  all: 'Todas',
};

function getUserArea(user) {
  if (user?.role !== 'admin') return 'cliente';
  return user?.custom_role || 'admin';
}

export default function AdminInternalMessages({ user }) {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [packages, setPackages] = useState([]);
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      const [conversationRows, packageRows, routeRows, userRows] = await Promise.all([
        base44.entities.InternalConversation.list('-updated_date', 300),
        base44.entities.Package.list('-updated_date', 300),
        base44.entities.Ruta.list('-updated_date', 200),
        base44.entities.User.list('-created_date', 500),
      ]);
      if (!active) return;
      const usersMap = new Map((userRows || []).map((item) => [String(item.email || '').toLowerCase(), item]));
      setConversations(conversationRows || []);
      setPackages((packageRows || []).map((item) => {
        const client = usersMap.get(String(item.client_email || '').toLowerCase());
        const clientName = client?.full_name || `${client?.first_name || ''} ${client?.last_name || ''}`.trim() || item.client_email || 'Sin cliente';
        const clientPhone = client?.whatsapp || client?.telefono || client?.phone || '';
        const tracking = item.tracking_number || item.id;
        const shippingMark = item.shipping_mark || '';
        return {
          id: item.id,
          label: `${tracking}${shippingMark ? ` · ${shippingMark}` : ''}${clientName ? ` · ${clientName}` : ''}`,
          searchText: [tracking, shippingMark, clientName, item.client_email, clientPhone].filter(Boolean).join(' '),
        };
      }));
      setRoutes((routeRows || []).map((item) => ({ id: item.id, label: item.codigo_ruta || item.nombre || item.id, searchText: [item.codigo_ruta, item.nombre, item.id].filter(Boolean).join(' ') })));
      setLoading(false);
    };
    loadData();

    const unsubConversations = base44.entities.InternalConversation.subscribe((event) => {
      setConversations((prev) => {
        if (event.type === 'create') return [event.data, ...prev];
        if (event.type === 'update') return prev.map((item) => item.id === event.id ? event.data : item);
        if (event.type === 'delete') return prev.filter((item) => item.id !== event.id);
        return prev;
      });
    });

    return () => { active = false; if (typeof unsubConversations === 'function') unsubConversations(); };
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    let active = true;
    const loadMessages = async () => {
      const rows = await base44.entities.InternalMessage.filter({ conversation_id: selectedConversationId }, 'created_date', 500);
      if (active) setMessages(rows || []);
    };
    loadMessages();

    const unsubscribe = base44.entities.InternalMessage.subscribe((event) => {
      if (event.data?.conversation_id !== selectedConversationId && event.id !== selectedConversationId) return;
      setMessages((prev) => {
        if (event.type === 'create') return [...prev, event.data];
        if (event.type === 'update') return prev.map((item) => item.id === event.id ? event.data : item);
        if (event.type === 'delete') return prev.filter((item) => item.id !== event.id);
        return prev;
      });
    });

    return () => { active = false; if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [selectedConversationId]);

  const filteredConversations = useMemo(() => {
    const term = String(search || '').toLowerCase();
    const area = getUserArea(user);
    return (conversations || []).filter((item) => {
      const areaMatch = area === 'admin' || item.target_area === 'all' || item.target_area === area;
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      const entityMatch = entityFilter === 'all' || item.entity_type === entityFilter;
      const haystack = [item.title, item.topic, item.entity_label, item.created_by_name].map((value) => String(value || '').toLowerCase()).join(' ');
      return areaMatch && statusMatch && entityMatch && (!term || haystack.includes(term));
    });
  }, [conversations, entityFilter, search, statusFilter, user]);

  useEffect(() => {
    if (!filteredConversations.length) {
      setSelectedConversationId('');
      return;
    }
    if (!filteredConversations.some((item) => item.id === selectedConversationId)) {
      setSelectedConversationId(filteredConversations[0].id);
    }
  }, [filteredConversations, selectedConversationId]);

  const selectedConversation = filteredConversations.find((item) => item.id === selectedConversationId) || null;

  const stats = useMemo(() => ({
    total: filteredConversations.length,
    open: filteredConversations.filter((item) => item.status === 'open').length,
    resolved: filteredConversations.filter((item) => item.status === 'resolved').length,
    messages: filteredConversations.reduce((sum, item) => sum + Number(item.message_count || 0), 0),
  }), [filteredConversations]);

  const handleCreateConversation = async (form, selectedRecord) => {
    try {
      setCreating(true);
      const actorName = user?.full_name || user?.email;
      const conversation = await base44.entities.InternalConversation.create({
        title: form.title,
        topic: form.topic,
        entity_type: form.entity_type,
        entity_id: form.entity_id,
        entity_label: selectedRecord?.label || form.entity_id,
        status: 'open',
        created_by_email: user.email,
        created_by_name: actorName,
        created_by_area: AREA_LABELS[getUserArea(user)] || getUserArea(user),
        target_area: form.target_area,
        message_count: 1,
        last_message_preview: form.first_message.slice(0, 120),
        last_message_at: new Date().toISOString(),
      });

      await base44.entities.InternalMessage.create({
        conversation_id: conversation.id,
        sender_email: user.email,
        sender_name: actorName,
        sender_role: user.role,
        sender_area: AREA_LABELS[getUserArea(user)] || getUserArea(user),
        message: form.first_message,
      });

      setOpenCreate(false);
      setSelectedConversationId(conversation.id);
      toast.success('Conversación creada');
    } catch {
      toast.error('No se pudo crear la conversación');
    }
    setCreating(false);
  };

  const handleSendMessage = async (text) => {
    if (!selectedConversation) return;
    const actorName = user?.full_name || user?.email;
    const newMessage = await base44.entities.InternalMessage.create({
      conversation_id: selectedConversation.id,
      sender_email: user.email,
      sender_name: actorName,
      sender_role: user.role,
      sender_area: AREA_LABELS[getUserArea(user)] || getUserArea(user),
      message: text,
    });

    await base44.entities.InternalConversation.update(selectedConversation.id, {
      message_count: Number(selectedConversation.message_count || 0) + 1,
      last_message_preview: text.slice(0, 120),
      last_message_at: newMessage.created_date || new Date().toISOString(),
    });
  };

  const handleToggleStatus = async () => {
    if (!selectedConversation) return;
    await base44.entities.InternalConversation.update(selectedConversation.id, {
      status: selectedConversation.status === 'open' ? 'resolved' : 'open',
    });
  };

  if (user?.role !== 'admin') {
    return <Card className="border-0 shadow-lg"><CardContent className="p-8 text-center text-slate-600">No tienes acceso a este módulo.</CardContent></Card>;
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHero icon={MessageSquarePlus} badge="Comunicación interna" title="Mensajería interna en tiempo real" description="Coordina incidencias de paquetes y rutas entre almacén, logística y soporte sin salir de la plataforma." actions={<Button onClick={() => setOpenCreate(true)} className="bg-blue-600 hover:bg-blue-700"><MessageSquarePlus className="h-4 w-4 mr-2" />Nueva conversación</Button>} />
      <InternalMessagingStats {...stats} />
      <Card className="border-0 shadow-lg"><CardHeader><CardTitle>Filtros</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-[1fr,180px,180px]"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, contexto o registro" /><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="open">Abiertas</SelectItem><SelectItem value="resolved">Resueltas</SelectItem></SelectContent></Select><Select value={entityFilter} onValueChange={setEntityFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos</SelectItem><SelectItem value="Package">Paquetes</SelectItem><SelectItem value="Ruta">Rutas</SelectItem></SelectContent></Select></CardContent></Card>
      <div className="grid gap-6 xl:grid-cols-[380px,minmax(0,1fr)]">
        <InternalConversationList conversations={filteredConversations} selectedId={selectedConversationId} onSelect={setSelectedConversationId} />
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{selectedConversation?.title || 'Selecciona una conversación'}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">{selectedConversation ? `${selectedConversation.entity_type}: ${selectedConversation.entity_label} · Departamento: ${AREA_LABELS[selectedConversation.target_area] || 'Todas'}` : 'Elige una conversación para ver el chat.'}</p>
            </div>
            {selectedConversation ? <Button variant="outline" onClick={handleToggleStatus}>{selectedConversation.status === 'open' ? 'Marcar resuelta' : 'Reabrir'}</Button> : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <InternalMessageList messages={messages} currentUserEmail={user.email} />
            {selectedConversation ? <InternalMessageComposer onSend={handleSendMessage} disabled={selectedConversation.status === 'resolved'} /> : null}
          </CardContent>
        </Card>
      </div>
      <CreateConversationDialog open={openCreate} onOpenChange={setOpenCreate} packages={packages} routes={routes} onCreate={handleCreateConversation} creating={creating} />
    </div>
  );
}