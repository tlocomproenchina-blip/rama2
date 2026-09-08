import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send,
  Loader2,
  MessageSquarePlus,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import SupportImageUploader from '@/components/support/SupportImageUploader';
import { uploadSupportImages } from '@/components/support/supportUploadUtils';
import {
  searchKnowledgeBase,
  stripMarkdown,
  CATEGORY_LABELS,
  TICKET_CATEGORY_MAP
} from '@/lib/kbSearch';
import { detectProfileIntents, fetchProfileResults } from '@/lib/clientProfileSearch';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: '¡Hola! 👋 Soy tu asistente de autoatención. Escribe tu duda o problema y te mostraré artículos que podrían ayudarte. Si no encuentras lo que necesitas, podrás crear un ticket al equipo de soporte.',
  isWelcome: true,
  timestamp: new Date().toISOString()
};

export default function NewTicketChat({ user, onClose, onCreated, initialCategory }) {
  const [articles, setArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasShownSuggestions, setHasShownSuggestions] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [votedArticles, setVotedArticles] = useState(() => {
    try {
      const stored = localStorage.getItem('kb_voted_articles');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });
  const [voting, setVoting] = useState(false);

  // Estado del formulario de ticket
  const [ticketData, setTicketData] = useState({
    subject: '',
    category: TICKET_CATEGORY_MAP[initialCategory] || 'otro',
    priority: 'media',
    message: '',
    related_tracking: '',
    attachments: []
  });
  const [creating, setCreating] = useState(false);

  const messagesEndRef = useRef(null);
  const debounceRef = useRef(null);

  // Cargar artículos una sola vez al abrir el diálogo
  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoadingArticles(true);
    try {
      const rows = await base44.entities.KnowledgeBase.filter(
        { status: 'published' },
        '-updated_date',
        100
      );
      setArticles(rows || []);
    } catch (err) {
      console.error('Error cargando KnowledgeBase:', err);
      toast.error('No se pudieron cargar los artículos de ayuda');
    } finally {
      setLoadingArticles(false);
    }
  };

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isSearching]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    // Agregar mensaje del cliente
    const clientMsg = {
      role: 'client',
      content: text,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, clientMsg]);
    setInput('');
    setIsSearching(true);

    // Debounce para simular "buscando" y luego mostrar resultados
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // 1. Detectar si el cliente pregunta por sus propios datos (sin IA)
      const intents = detectProfileIntents(text);
      let profileResults = [];
      if (intents.length > 0) {
        try {
          profileResults = await fetchProfileResults(user, intents);
        } catch (err) {
          console.error('Error en búsqueda de perfil:', err);
        }
      }

      // 2. Buscar artículos de KnowledgeBase
      const kbResults = searchKnowledgeBase(articles, text, 'todas', 5);

      // 3. Combinar: primero datos del perfil, luego artículos KB
      const allResults = [...profileResults, ...kbResults];

      let content;
      if (profileResults.length > 0 && kbResults.length > 0) {
        content = 'Encontré información de tu cuenta y artículos que podrían ayudarte:';
      } else if (profileResults.length > 0) {
        content = 'Esto es lo que encontré en tu cuenta:';
      } else if (kbResults.length > 0) {
        content = 'Encontré estos artículos que podrían ayudarte:';
      } else {
        content = 'No encontré información relacionada. Puedes intentar con otras palabras o crear un ticket si lo necesitas.';
      }

      const assistantMsg = {
        role: 'assistant',
        content,
        articles: allResults,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsSearching(false);
      setHasShownSuggestions(true);
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVote = async (article, isHelpful) => {
    if (votedArticles.has(article.id)) {
      toast.info('Ya registraste tu opinión sobre este artículo');
      return;
    }
    setVoting(true);
    try {
      const update = isHelpful
        ? { helpful_count: (article.helpful_count || 0) + 1 }
        : { not_helpful_count: (article.not_helpful_count || 0) + 1 };
      await base44.entities.KnowledgeBase.update(article.id, update);
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, ...update } : a))
      );
      const newVoted = new Set(votedArticles);
      newVoted.add(article.id);
      setVotedArticles(newVoted);
      try {
        localStorage.setItem('kb_voted_articles', JSON.stringify([...newVoted]));
      } catch {}
      toast.success(isHelpful ? '¡Gracias por tu feedback!' : 'Gracias, lo tomaremos en cuenta');
    } catch (err) {
      console.error('Error guardando feedback:', err);
      toast.error('No se pudo guardar tu feedback');
    } finally {
      setVoting(false);
    }
  };

  const handleOpenTicketForm = () => {
    // Pre-llenar el asunto con el último mensaje del cliente
    const lastClientMsg = [...messages].reverse().find((m) => m.role === 'client');
    setTicketData((prev) => ({
      ...prev,
      subject: lastClientMsg ? lastClientMsg.content.slice(0, 200) : ''
    }));
    setShowTicketForm(true);
  };

  const handleCreateTicket = async () => {
    if (!user?.email) { base44.auth.redirectToLogin(); return; }
    if (!ticketData.subject.trim() || !ticketData.message.trim()) {
      toast.error('Por favor completa asunto y mensaje');
      return;
    }

    setCreating(true);
    try {
      const ticketNumber = `TKT-${Date.now()}`;
      const uploadedAttachments = await uploadSupportImages(ticketData.attachments);
      const firstMessage = {
        sender_email: user.email,
        sender_name: user.full_name || user.email,
        message: ticketData.message,
        timestamp: new Date().toISOString(),
        is_admin: false,
        attachments: uploadedAttachments
      };

      const ticketPayload = {
        ticket_number: ticketNumber,
        client_email: user.email,
        subject: ticketData.subject,
        category: ticketData.category,
        priority: ticketData.priority,
        status: 'abierto',
        messages: [firstMessage]
      };

      if (ticketData.related_tracking && ticketData.related_tracking.trim()) {
        ticketPayload.related_tracking = ticketData.related_tracking.trim();
      }

      const created = await base44.entities.SupportTicket.create(ticketPayload);

      // Notificar admins (no bloqueante)
      import('@/components/NotificationUtils').then(({ notifyAdmins }) => {
        notifyAdmins({
          subject: '🎫 Nuevo Ticket de Soporte',
          body: `Un nuevo ticket de soporte ha sido creado:\n\nTicket: ${ticketNumber}\nAsunto: ${ticketData.subject}\nCategoría: ${ticketData.category}\nPrioridad: ${ticketData.priority}\nCliente: ${user.full_name || user.email}\n${ticketData.related_tracking ? `Tracking: ${ticketData.related_tracking}\n` : ''}\nMensaje:\n${ticketData.message}`,
          message: `${user.full_name || user.email} creó un ticket: ${ticketData.subject}`,
          type: 'general',
          icon: 'alert',
          referenceId: ticketNumber
        });
      });

      // Notificar cliente (no bloqueante)
      base44.entities.Notification.create({
        user_email: user.email,
        title: '✅ Ticket Creado',
        message: `Tu ticket "${ticketData.subject}" ha sido creado exitosamente.`,
        type: 'general',
        icon: 'check',
        reference_id: ticketNumber
      }).catch((err) => console.error('Error notificando cliente:', err));

      toast.success('Ticket creado exitosamente. Te responderemos pronto.');
      onCreated?.(created);
    } catch (error) {
      console.error('Error al crear ticket:', error);
      toast.error(`Error: ${error.message || 'No se pudo crear el ticket'}`);
    } finally {
      setCreating(false);
    }
  };

  const lastClientMessage = useMemo(() => {
    return [...messages].reverse().find((m) => m.role === 'client');
  }, [messages]);

  return (
    <div className="flex flex-col" style={{ height: '70vh', maxHeight: '70vh' }}>
      {/* Header compacto */}
      <div className="flex items-center gap-3 px-1 pb-3 border-b border-border/60">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">Autoatención</p>
          <h2 className="font-display text-base font-bold text-foreground">Asistente de Soporte</h2>
        </div>
        {showTicketForm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTicketForm(false)}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al chat
          </Button>
        )}
      </div>

      {/* Área de mensajes (scroll) */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'client' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'client' ? '' : 'flex items-start gap-2'}`}>
              {/* Avatar del asistente */}
              {msg.role === 'assistant' && !msg.isWelcome && (
                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center mt-1">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === 'client'
                    ? 'bg-primary/10 text-foreground rounded-br-md'
                    : 'bg-card border border-border/60 text-foreground rounded-bl-md shadow-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                {/* Artículos sugeridos dentro de la burbuja */}
                {msg.articles && msg.articles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.articles.map((article) => {
                      const isExpanded = expandedId === article.id;
                      const hasVoted = votedArticles.has(article.id);
                      const preview = stripMarkdown(article.content || '').slice(0, 120);
                      const isProfile = article.isProfileData;
                      return (
                        <div
                          key={article.id}
                          className="rounded-xl border border-border/70 bg-background/80 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : article.id)}
                            className="w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 hover:bg-accent/30 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <h4 className="font-semibold text-sm text-foreground">{article.title}</h4>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${isProfile ? 'bg-primary/10 text-primary border-primary/20' : ''}`}
                                >
                                  {isProfile ? (article._badge || 'Mi perfil') : (CATEGORY_LABELS[article.category] || article.category)}
                                </Badge>
                              </div>
                              {!isExpanded && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {preview}
                                  {preview.length >= 120 ? '…' : ''}
                                </p>
                              )}
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                            ) : (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 pt-2 border-t border-border/50">
                              <div className="prose prose-sm max-w-none text-foreground/90 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline">
                                <ReactMarkdown>{article.content || ''}</ReactMarkdown>
                              </div>
                              {!isProfile && (
                                <div className="mt-2 flex items-center justify-end gap-1.5">
                                  <span className="text-[10px] text-muted-foreground mr-1">¿Te ayudó?</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={hasVoted || voting}
                                    onClick={() => handleVote(article, true)}
                                    className="h-7 px-2 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                    <span className="ml-1 text-[10px]">{article.helpful_count || 0}</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={hasVoted || voting}
                                    onClick={() => handleVote(article, false)}
                                    className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                  >
                                    <ThumbsDown className="h-3 w-3" />
                                    <span className="ml-1 text-[10px]">{article.not_helpful_count || 0}</span>
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Indicador de "escribiendo..." */}
        {isSearching && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2">
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center mt-1">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-bl-md bg-card border border-border/60 px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Botón "No encontré mi respuesta, crear ticket" — aparece después de la primera ronda de sugerencias */}
      {hasShownSuggestions && !showTicketForm && (
        <div className="pt-2 pb-3 border-t border-border/60 animate-in fade-in duration-300">
          <Button
            variant="outline"
            onClick={handleOpenTicketForm}
            className="w-full"
          >
            <MessageSquarePlus className="h-4 w-4" />
            No encontré mi respuesta, crear ticket
          </Button>
        </div>
      )}

      {/* Input de chat o formulario de ticket */}
      {showTicketForm ? (
        <div className="border-t border-border/60 pt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Asunto *</Label>
            <Input
              value={ticketData.subject}
              onChange={(e) => setTicketData({ ...ticketData, subject: e.target.value })}
              placeholder="Describe brevemente tu problema"
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select value={ticketData.category} onValueChange={(v) => setTicketData({ ...ticketData, category: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridad</Label>
              <Select value={ticketData.priority} onValueChange={(v) => setTicketData({ ...ticketData, priority: v })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tracking relacionado (opcional)</Label>
            <Input
              value={ticketData.related_tracking}
              onChange={(e) => setTicketData({ ...ticketData, related_tracking: e.target.value })}
              placeholder="Ej: TLEC-123456"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mensaje *</Label>
            <Textarea
              value={ticketData.message}
              onChange={(e) => setTicketData({ ...ticketData, message: e.target.value })}
              placeholder="Describe tu problema en detalle..."
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fotos (opcional)</Label>
            <SupportImageUploader
              files={ticketData.attachments}
              onChange={(attachments) => setTicketData({ ...ticketData, attachments })}
              disabled={creating}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setShowTicketForm(false)} disabled={creating} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleCreateTicket} disabled={creating} className="flex-1">
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</> : 'Crear Ticket'}
            </Button>
          </div>
        </div>
      ) : (
        !loadingArticles && (
          <div className="border-t border-border/60 pt-3">
            <div className="flex items-end gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu duda o problema..."
                className="flex-1 h-11 rounded-2xl"
                disabled={isSearching}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isSearching}
                size="icon"
                className="h-11 w-11 rounded-2xl shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}