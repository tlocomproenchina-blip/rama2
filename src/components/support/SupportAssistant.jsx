import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  HelpCircle,
  Search,
  LayoutGrid,
  Package,
  DollarSign,
  FileText,
  Shield,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquarePlus,
  Inbox
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const CATEGORIES = [
  { key: 'todas', label: 'Todas', icon: LayoutGrid },
  { key: 'general', label: 'General', icon: HelpCircle },
  { key: 'envios', label: 'Envíos', icon: Package },
  { key: 'pagos', label: 'Pagos', icon: DollarSign },
  { key: 'soporte', label: 'Soporte', icon: FileText },
  { key: 'faqs', label: 'FAQs', icon: HelpCircle },
  { key: 'politicas', label: 'Políticas', icon: Shield }
];

const CATEGORY_LABELS = {
  general: 'General',
  envios: 'Envíos',
  pagos: 'Pagos',
  soporte: 'Soporte',
  faqs: 'FAQs',
  politicas: 'Políticas'
};

// Mapeo de categoría KnowledgeBase → categoría SupportTicket
const TICKET_CATEGORY_MAP = {
  general: 'otro',
  envios: 'envio',
  pagos: 'pago',
  soporte: 'otro',
  faqs: 'otro',
  politicas: 'actualizar_datos'
};

const normalize = (str) =>
  (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const stripMarkdown = (md) =>
  (md || '')
    .replace(/[#*`>_~\-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

export default function SupportAssistant({ onOpenTicket }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
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
  const debounceRef = useRef(null);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.KnowledgeBase.filter(
        { status: 'published' },
        '-updated_date',
        100
      );
      setArticles(rows || []);
    } catch (err) {
      console.error('Error cargando KnowledgeBase:', err);
      toast.error('No se pudieron cargar los artículos');
    } finally {
      setLoading(false);
    }
  };

  // Debounce del buscador
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const filteredAndRanked = useMemo(() => {
    let list = articles;
    if (activeCategory !== 'todas') {
      list = list.filter((a) => a.category === activeCategory);
    }
    const q = normalize(debouncedQuery.trim());
    if (!q) return list;

    const tokens = q.split(/\s+/).filter(Boolean);
    const ranked = list
      .map((a) => {
        const titleNorm = normalize(a.title || '');
        const contentNorm = normalize(stripMarkdown(a.content || ''));
        const tagsNorm = normalize((a.tags || []).join(' '));
        let score = 0;
        for (const tok of tokens) {
          if (titleNorm.includes(tok)) score += 5;
          if (tagsNorm.includes(tok)) score += 3;
          if (contentNorm.includes(tok)) score += 1;
        }
        return { article: a, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.article);

    return ranked;
  }, [articles, activeCategory, debouncedQuery]);

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

  const handleOpenTicket = () => {
    const ticketCategory =
      activeCategory !== 'todas' && TICKET_CATEGORY_MAP[activeCategory]
        ? TICKET_CATEGORY_MAP[activeCategory]
        : 'otro';
    onOpenTicket?.(ticketCategory);
  };

  const hasQuery = debouncedQuery.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Hero del asistente */}
      <Card className="relative overflow-hidden border-border/70 bg-gradient-to-br from-primary/10 via-accent/40 to-card shadow-card">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
        <CardContent className="relative p-5 md:p-7">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <HelpCircle className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                Autoatención
              </p>
              <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
                ¿Cómo podemos ayudarte?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Busca respuestas rápidas en nuestra base de conocimiento o explora por categoría.
              </p>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Busca tu respuesta... (ej: seguro, tracking, pago)"
              className="pl-10 h-12 rounded-2xl bg-card/95 border-border/80 shadow-sm"
            />
          </div>

          {/* Chips de categorías */}
          <div className="mt-4 -mx-1 overflow-x-auto pb-1">
            <div className="flex gap-2 px-1 min-w-max">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all whitespace-nowrap touch-manipulation ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-card'
                        : 'bg-card/80 text-foreground border border-border/70 hover:bg-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Cargando artículos...</span>
        </div>
      ) : filteredAndRanked.length === 0 ? (
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardContent className="p-8 text-center">
            <Inbox className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {hasQuery
                ? 'No encontramos artículos para tu búsqueda.'
                : 'No hay artículos publicados en esta categoría todavía.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {hasQuery
                ? `${filteredAndRanked.length} resultado(s) encontrado(s)`
                : `${filteredAndRanked.length} artículo(s)`}
            </p>
          </div>
          <div className="grid gap-3">
            {filteredAndRanked.map((article) => {
              const isExpanded = expandedId === article.id;
              const hasVoted = votedArticles.has(article.id);
              const preview = stripMarkdown(article.content || '').slice(0, 140);
              return (
                <Card
                  key={article.id}
                  className="border-border/70 bg-card/95 shadow-card hover:shadow-premium transition-all duration-200"
                >
                  <CardContent className="p-4">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : article.id)}
                      className="w-full text-left flex items-start justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-display font-semibold text-foreground">
                            {article.title}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[article.category] || article.category}
                          </Badge>
                        </div>
                        {!isExpanded && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {preview}
                            {preview.length >= 140 ? '…' : ''}
                          </p>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        <div className="prose prose-sm max-w-none text-foreground/90 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_a]:text-primary [&_a]:underline">
                          <ReactMarkdown>{article.content || ''}</ReactMarkdown>
                        </div>

                        {/* Feedback */}
                        <div className="mt-4 flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground mr-1">
                            ¿Te ayudó esto?
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={hasVoted || voting}
                            onClick={() => handleVote(article, true)}
                            className="h-8 px-2.5 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span className="ml-1 text-xs">{article.helpful_count || 0}</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={hasVoted || voting}
                            onClick={() => handleVote(article, false)}
                            className="h-8 px-2.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            <span className="ml-1 text-xs">{article.not_helpful_count || 0}</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* CTA abrir ticket */}
      <Card className="border-dashed border-border/70 bg-card/60">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
              <MessageSquarePlus className="h-5 w-5" />
            </div>
            <div className="text-center sm:text-left">
              <p className="font-semibold text-foreground text-sm">¿No encuentras tu respuesta?</p>
              <p className="text-xs text-muted-foreground">
                Abre un ticket y nuestro equipo te ayudará directamente.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenTicket}
            className="w-full sm:w-auto shrink-0"
          >
            <MessageSquarePlus className="h-4 w-4" />
            No me ayudó, abrir ticket
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}