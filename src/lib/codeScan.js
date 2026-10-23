// Normaliza lo que devuelve la cámara o la lectora antes de procesarlo.
// Puede llegar el código tal cual (código de barras) o el contenido de un QR
// nuevo: un enlace web (…?code=N2-TLEC-50001-L01) o un texto con el código dentro.

const PARAM_KEYS = [
  'code', 'codigo', 'código', 'cod', 'label', 'label_code', 'etiqueta',
  'bulto', 'caja', 'tracking', 'tracking_number', 'q', 'id', 'value', 'valor', 'ref',
];

const PAIR_KEYS = /^(code|codigo|código|cod|tracking|etiqueta|label|bulto|caja|valor|value|qr)$/i;

const GENERIC_SEGMENTS = new Set([
  '', 'scan', 'scanner', 'warehouse', 'warehousescanpack', 'bodegascan',
  'etiqueta', 'label', 'qr', 'index', 'inicio', 'home', 'app',
]);

// Etiqueta, bulto o caja: el código termina en -L##, -B## o -C##.
const UNIT_SUFFIX = /[-_][LBC]\d{1,4}$/i;
const TOKEN = /[A-Za-z0-9][A-Za-z0-9._-]{3,}/g;

const tokenScore = (token) => {
  let score = token.length;
  if (UNIT_SUFFIX.test(token)) score += 60;
  if (/TLEC/i.test(token)) score += 25;
  if (/^\d+$/.test(token)) score -= 10;
  return score;
};

const bestToken = (text) => {
  const tokens = String(text || '').match(TOKEN) || [];
  if (!tokens.length) return '';
  return tokens.sort((a, b) => tokenScore(b) - tokenScore(a))[0];
};

const codeFromUrl = (rawUrl) => {
  const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  let url;
  try {
    url = new URL(withProto);
  } catch (_) {
    return '';
  }

  for (const key of PARAM_KEYS) {
    const value = url.searchParams.get(key);
    if (value && value.trim()) return value.trim();
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  for (const key of PARAM_KEYS) {
    const value = hashParams.get(key);
    if (value && value.trim()) return value.trim();
  }

  const segments = url.pathname.split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch (_) { return s; }
  });

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (UNIT_SUFFIX.test(segment) || /TLEC/i.test(segment)) return segment;
  }

  const last = segments[segments.length - 1] || '';
  return GENERIC_SEGMENTS.has(last.toLowerCase()) ? '' : last;
};

export function normalizeScannedCode(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  // QR con enlace web
  const urlMatch = cleaned.match(/(?:https?:\/\/|www\.)[^\s]+/i);
  if (urlMatch) {
    const fromUrl = codeFromUrl(urlMatch[0]);
    if (fromUrl) return fromUrl;
  }

  // QR o texto con el código precedido de una clave: "code=N2-TLEC-50001"
  const pair = cleaned.match(/([A-Za-z_áéíóúñ]{2,20})\s*[=:]\s*([A-Za-z0-9][A-Za-z0-9._-]{3,})/);
  if (pair && PAIR_KEYS.test(pair[1].trim())) return pair[2];

  // El código viene dentro de un texto más largo
  if (/\s/.test(cleaned)) {
    const token = bestToken(cleaned);
    if (token) return token;
  }

  return cleaned.replace(/^["'<[]+|["'>\]]+$/g, '');
}