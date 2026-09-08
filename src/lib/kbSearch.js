// Utilidades compartidas de búsqueda en KnowledgeBase
// Usado por SupportAssistant y NewTicketChat para mantener consistencia y cero consumo de IA.

export const normalize = (str) =>
  (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const stripMarkdown = (md) =>
  (md || '')
    .replace(/[#*`>_~\-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

export const CATEGORY_LABELS = {
  general: 'General',
  envios: 'Envíos',
  pagos: 'Pagos',
  soporte: 'Soporte',
  faqs: 'FAQs',
  politicas: 'Políticas'
};

// Mapeo de categoría KnowledgeBase → categoría SupportTicket
export const TICKET_CATEGORY_MAP = {
  general: 'otro',
  envios: 'envio',
  pagos: 'pago',
  soporte: 'otro',
  faqs: 'otro',
  politicas: 'actualizar_datos'
};

/**
 * Filtra y rankea artículos de KnowledgeBase por keyword matching.
 * @param {Array} articles - lista de artículos (deben tener title, content, tags, category)
 * @param {string} query - texto de búsqueda del usuario
 * @param {string} category - categoría activa ('todas' = sin filtro)
 * @param {number} limit - máximo de resultados (default 5)
 * @returns {Array} artículos ordenados por score, solo con score > 0
 */
export const searchKnowledgeBase = (articles, query, category = 'todas', limit = 5) => {
  let list = articles;
  if (category && category !== 'todas') {
    list = list.filter((a) => a.category === category);
  }
  const q = normalize((query || '').trim());
  if (!q) return [];

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
    .slice(0, limit)
    .map((r) => r.article);

  return ranked;
};