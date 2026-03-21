import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, Minimize2 } from 'lucide-react';
import InternalMessageList from '@/components/internal-messaging/InternalMessageList';
import InternalMessageComposer from '@/components/internal-messaging/InternalMessageComposer';
import { uploadSupportImages } from '@/components/support/supportUploadUtils';

function getDismissedKey(email) {
  return `internal-floating-chat-dismissed-${email || 'guest'}`;
}

function readDismissed(email) {
  try {
    return JSON.parse(window.localStorage.getItem(getDismissedKey(email)) || '[]');
  } catch {
    return [];
  }
}

function saveDismissed(email, ids) {
  try {
    window.localStorage.setItem(getDismissedKey(email), JSON.stringify(ids));
  } catch {}
}

function isRelevantConversation(conversation, user) {
  if (!conversation || user?.role !== 'admin' || conversation.status !== 'open') return false;
  const isCreator = conversation.created_by_email === user?.email;
  const isParticipant = (conversation.participant_emails || []).includes(user?.email);
  return isCreator || isParticipant;
}

function sortByRecent(items) {
  return [...(items || [])].sort((a, b) => new Date(b.last_message_at || b.updated_date || b.created_date || 0) - new Date(a.last_message_at || a.updated_date || a.created_date || 0));
}

export default function InternalFloatingChat({ user }) {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [dismissedIds, setDismissedIds] = useState([]);

  useEffect(() => {
    if (!user?.email || user?.role !== 'admin') return;
    setDismissedIds(readDismissed(user.email));
  }, [user?.email, user?.role]);

  useEffect(() => {
    if (!user?.email || user?.role !== 'admin') return;

    let active = true;
    const loadConversations = async () => {
      const rows = await base44.entities.InternalConversation.list('-updated_date', 200);
      if (active) setConversations(rows || []);
    };
    loadConversations();

    const unsubscribe = base44.entities.InternalConversation.subscribe((event) => {
      setConversations((prev) => {
        if (event.type === 'create') return [event.data, ...prev];
        if (event.type === 'update') return prev.map((item) => item.id === event.id ? event.data : item);
        if (event.type === 'delete') return prev.filter((item) => item.id !== event.id);
        return prev;
      });

      if ((event.type === 'create' || event.type === 'update') && isRelevantConversation(event.data, user)) {
        setDismissedIds((prev) => {
          const next = prev.filter((id) => id !== event.data.id);
          saveDismissed(user.email, next);
          return next;
        });
        setActiveConversationId(event.data.id);
      }
    });

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user]);

  const visibleConversations = useMemo(() => {
    return sortByRecent(conversations.filter((item) => isRelevantConversation(item, user) && !dismissedIds.includes(item.id)));
  }, [conversations, dismissedIds, user]);

  useEffect(() => {
    if (!visibleConversations.length) {
      setActiveConversationId('');
      setExpanded(false);
      return;
    }
    if (!visibleConversations.some((item) => item.id === activeConversationId)) {
      setActiveConversationId(visibleConversations[0].id);
    }
  }, [visibleConversations, activeConversationId]);

  const activeConversation = visibleConversations.find((item) => item.id === activeConversationId) || null;

  useEffect(() => {
    if (!activeConversationId || !user?.email) {
      setMessages([]);
      return;
    }

    let active = true;
    const loadMessages = async () => {
      const rows = await base44.entities.InternalMessage.filter({ conversation_id: activeConversationId }, 'created_date', 200);
      if (active) setMessages(rows || []);
    };
    loadMessages();

    const unsubscribe = base44.entities.InternalMessage.subscribe((event) => {
      if (event.data?.conversation_id !== activeConversationId) return;
      setMessages((prev) => {
        if (event.type === 'create') return [...prev, event.data];
        if (event.type === 'update') return prev.map((item) => item.id === event.id ? event.data : item);
        if (event.type === 'delete') return prev.filter((item) => item.id !== event.id);
        return prev;
      });

      if (event.type === 'create' && event.data?.sender_email !== user.email) {
        setExpanded(false);
      }
    });

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [activeConversationId, user?.email]);

  const handleClose = () => {
    if (!activeConversation || !user?.email) return;
    const nextDismissed = [...new Set([...dismissedIds, activeConversation.id])];
    setDismissedIds(nextDismissed);
    saveDismissed(user.email, nextDismissed);
    setExpanded(false);
  };

  const handleSend = async (text, files = []) => {
    if (!activeConversation) return;
    const uploadedAttachments = await uploadSupportImages(files);
    const actorName = user?.full_name || user?.email;
    const previewText = text.trim() || (uploadedAttachments.length > 0 ? 'Fotos adjuntas' : '');

    const created = await base44.entities.InternalMessage.create({
      conversation_id: activeConversation.id,
      sender_email: user.email,
      sender_name: actorName,
      sender_role: user.role,
      sender_area: user.custom_role || 'admin',
      message: text,
      attachments: uploadedAttachments,
    });

    await base44.entities.InternalConversation.update(activeConversation.id, {
      participant_emails: [...new Set([...(activeConversation.participant_emails || []), user.email])],
      message_count: Number(activeConversation.message_count || 0) + 1,
      last_message_preview: previewText.slice(0, 120),
      last_message_at: created.created_date || new Date().toISOString(),
    });
  };

  if (!activeConversation || user?.role !== 'admin') return null;

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3">
      {expanded ? (
        <Card className="w-[min(92vw,24rem)] border-0 shadow-2xl">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{activeConversation.title}</CardTitle>
              <p className="mt-1 truncate text-sm text-slate-500">{activeConversation.entity_label}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(false)}><Minimize2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <InternalMessageList messages={messages} currentUserEmail={user.email} />
            <InternalMessageComposer onSend={handleSend} disabled={activeConversation.status === 'resolved'} />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex max-w-[18rem] items-center gap-3 rounded-full border border-white/80 bg-white/95 px-4 py-3 text-left shadow-2xl backdrop-blur">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{activeConversation.title}</p>
          </div>
        </button>
        <button type="button" onClick={handleClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}