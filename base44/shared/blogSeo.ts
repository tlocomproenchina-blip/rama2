// Helpers compartidos para generación de blog con SEO

export function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export function estimateReadingTime(content: string): number {
  const words = String(content || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export const BLOG_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Titulo atractivo del articulo, optimizado para SEO (max 60 caracteres)" },
    slug: { type: "string", description: "Slug URL unico en espanol, palabras separadas por guiones, sin acentos" },
    excerpt: { type: "string", description: "Resumen de 150-160 caracteres para meta description" },
    content: { type: "string", description: "Contenido completo del articulo en Markdown, minimo 800 palabras, con encabezados H2/H3, listas y parrafos estructurados" },
    seo_title: { type: "string", description: "Titulo SEO alternativo (max 60 caracteres)" },
    seo_description: { type: "string", description: "Meta description de 150-160 caracteres" },
    tags: { type: "array", items: { type: "string" }, description: "5-8 etiquetas relevantes para SEO" },
    image_prompt: { type: "string", description: "Prompt descriptivo en ingles para generar la imagen de portada" }
  },
  required: ["title", "slug", "excerpt", "content", "seo_description", "tags"]
};

export const BLOG_SYSTEM_PROMPT = `Eres un experto en logistica internacional y SEO especializado en el nicho de envios de China a Venezuela.

Generas articulos de blog optimizados para SEO que posicionen en Google para busquedas relacionadas con:
- Envios China Venezuela
- Courier internacional
- Carga maritima y aerea
- Compras en China
- Aduana y aranceles
- Consolidacion de carga
- Shipping mark
- Calculadora de envios

REGLAS SEO:
- Titulo: atractivo, con keyword principal, max 60 caracteres
- Slug: en espanol, palabras-clave separadas por guiones, sin acentos
- Meta description: 150-160 caracteres con keyword principal
- Contenido: minimo 800 palabras en Markdown
- Estructura: H2 para secciones, H3 para subsecciones, listas, negritas
- Keyword density: 1-2% (no keyword stuffing)
- Tono: profesional pero accesible, venezolano
- Menciona "TLEC CARGO" como referencia de servicio cuando sea natural
- No inventes precios; si mencionas tarifas, usa rangos generales`;

export function getTopicSuggestions(): string[] {
  return [
    "Como calcular el costo de envio de China a Venezuela",
    "Diferencias entre carga maritima y aerea desde China",
    "Guia completa para comprar en Alibaba y enviar a Venezuela",
    "Que es el shipping mark y por que importa",
    "Consolidacion de carga: como ahorrar dinero en tus envios",
    "Aduana venezolana: todo lo que debes saber al importar",
    "Tiempos de envio China Venezuela: maritimo vs aereo",
    "Productos prohibidos en envios a Venezuela",
    "Como elegir un courier internacional confiable",
    "Seguro de carga: protege tus envios desde China",
    "Peso volumetrico: como calcularlo correctamente",
    "CBM: que es y como afecta el costo de tu envio",
    "Mejores epocas para importar desde China",
    "Pago asistido: como comprar en China sin cuenta extranjera",
    "Errores comunes al importar de China y como evitarlos",
    "Que es DDP y por que conviene al importar a Venezuela",
    "Como rastrear tu paquete de China a Venezuela",
    "Importar electronicos desde China: guia completa",
    "Feriados chinos y como afectan tus envios",
    "Como elegir entre carga general y carga sensible"
  ];
}

export function pickRandomTopics(count: number): string[] {
  const topics = getTopicSuggestions();
  const shuffled = [...topics].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, topics.length));
}

export function buildArticlePrompt(topic: string, useWeb: boolean): string {
  const webInstruction = useWeb
    ? '\nUsa contexto de internet para incluir informacion relevante, actualizada y datos de actualidad sobre el tema.'
    : '';
  return `${BLOG_SYSTEM_PROMPT}\n\nGenera un articulo completo${useWeb ? ' y actualizado' : ''} sobre: "${topic}"${webInstruction}\n\nDevuelve un JSON con la estructura indicada. El campo content debe ser Markdown completo con H2/H3, listas y parrafos.`;
}

export function buildImagePrompt(title: string, suggestedPrompt?: string): string {
  if (suggestedPrompt) return suggestedPrompt;
  return `Professional logistics photograph: ${title}, cargo shipping containers from China to Venezuela, modern warehouse, clean and professional style, high quality, no text overlay`;
}