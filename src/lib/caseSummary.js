// El ATC escala un caso con un resumen de texto corrido (pregunta del cliente,
// diagnóstico del asistente, paso que necesita supervisión…). Aquí se reconocen
// esas partes conocidas para que cada una se pueda mostrar por separado.

const SECTIONS = [
  {
    key: 'question',
    display: 'Pregunta del cliente',
    variants: [
      'pregunta original del cliente',
      'consulta original del cliente',
      'pregunta del cliente',
      'consulta del cliente',
      'pregunta',
      'consulta',
    ],
  },
  {
    key: 'diagnosis',
    display: 'Diagnóstico del asistente',
    variants: ['diagnóstico del asistente', 'análisis del asistente', 'diagnóstico', 'análisis'],
  },
  {
    key: 'step',
    display: 'Paso que necesita supervisión',
    variants: ['paso que necesita supervisión', 'paso a seguir', 'siguiente paso', 'acción necesaria'],
  },
  {
    key: 'reason',
    display: 'Motivo del escalamiento',
    variants: ['motivo del escalamiento', 'motivo de la escalación', 'motivo'],
  },
  { key: 'summary', display: 'Resumen', variants: ['resumen'] },
  {
    key: 'transcript',
    display: 'Guía de la conversación',
    variants: ['guía de la conversación (asistente ↔ atc)', 'guía de la conversación', 'conversación'],
  },
  { key: 'history', display: 'Historial del cliente', variants: ['historial del cliente'] },
];

const ACCENTS = { á: '[áa]', é: '[ée]', í: '[íi]', ó: '[óo]', ú: '[úu]', ñ: '[ñn]', ü: '[üu]' };

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const accentFlexible = (value) => escapeRe(value).replace(/[áéíóúñü]/g, (char) => ACCENTS[char]);

const normalize = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const VARIANTS = SECTIONS
  .flatMap((section) => section.variants.map((variant) => ({ section, variant })))
  .sort((a, b) => b.variant.length - a.variant.length);

const SECTION_BY_VARIANT = new Map(VARIANTS.map((item) => [normalize(item.variant), item.section]));

// Cada parte empieza con su etiqueta seguida de dos puntos.
const SECTION_RE = new RegExp(`(${VARIANTS.map((item) => accentFlexible(item.variant)).join('|')})\\s*:`, 'gi');

const WHATSAPP_RE = /\[([^\]]{3,40})\]\s*([^:[\]]{3,40}):\s*([\s\S]*?)(?=\[|$)/g;

// Ubica cada etiqueta conocida dentro del texto, ignorando las viñetas de la
// guía de la conversación (esas líneas también traen "Algo: texto").
function findSections(raw) {
  const hits = [];
  SECTION_RE.lastIndex = 0;
  let match = SECTION_RE.exec(raw);
  while (match) {
    const start = match.index;
    const bodyStart = start + match[0].length;
    const section = SECTION_BY_VARIANT.get(normalize(match[1]));
    const before = raw.slice(0, start);
    const startsWord = start === 0 || /\s/.test(raw[start - 1]);
    const nextChar = raw[bodyStart];
    if (section && startsWord && !/•\s*$/.test(before) && (!nextChar || /\s/.test(nextChar))) {
      hits.push({ section, start, bodyStart });
    }
    match = SECTION_RE.exec(raw);
  }
  return hits;
}

export function parseCaseSummary(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return { lead: '', blocks: [] };

  const hits = findSections(raw);
  if (!hits.length) return { lead: raw, blocks: [] };

  const blocks = [];
  hits.forEach((hit, index) => {
    const end = index + 1 < hits.length ? hits[index + 1].start : raw.length;
    const body = raw.slice(hit.bodyStart, end).trim();
    if (!body) return;
    blocks.push({ key: hit.section.key, display: hit.section.display, body });
  });

  // El mismo texto puede venir repetido (por ejemplo la pregunta aparece en el
  // resumen y otra vez como "Pregunta original del cliente"): se muestra una vez.
  const seen = new Set();
  const unique = [];
  blocks.forEach((block) => {
    const key = normalize(block.body);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(block);
  });

  return { lead: raw.slice(0, hits[0].start).trim(), blocks: unique };
}

export function hasCaseSummary(text) {
  return parseCaseSummary(text).blocks.length >= 2;
}

// Convierte el hilo pegado del cliente en mensajes con su hora y su remitente.
export function parseWhatsAppLines(text) {
  const entries = [];
  WHATSAPP_RE.lastIndex = 0;
  let match = WHATSAPP_RE.exec(text);
  while (match) {
    const body = String(match[3] || '').trim();
    if (body) entries.push({ time: match[1].trim(), sender: match[2].trim(), text: body });
    match = WHATSAPP_RE.exec(text);
  }
  return entries.length >= 2 ? entries : [];
}

// Separa la guía de la conversación (líneas con viñeta) en intervenciones.
export function parseGuideLines(text) {
  const items = [];
  String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).forEach((line) => {
    if (!line.startsWith('•')) {
      items.push({ label: '', text: line });
      return;
    }
    const rest = line.replace(/^•\s*/, '');
    const split = rest.indexOf(':');
    if (split > 0 && split <= 60) {
      items.push({ label: rest.slice(0, split).trim(), text: rest.slice(split + 1).trim() });
    } else {
      items.push({ label: '', text: rest });
    }
  });
  return items.length >= 2 ? items : [];
}