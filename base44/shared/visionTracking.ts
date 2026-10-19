// Lectura del tracking de la foto con visión, como respaldo del lector de códigos.
//
// La captura del almacén puede llegar con el código tapado, borroso, pequeño o fuera
// del encuadre: cuando el lector de códigos no entrega una lectura confiable, aquí se
// le pide a un modelo de visión que lea la etiqueta.
//
// El proveedor se elige solo: primero OpenAI (OPENAI_API_KEY) y, si no responde o no
// devuelve un tracking válido, Gemini (Gemini-API-Key). Son llamadas directas a la
// API de cada proveedor: no gastan créditos de integración de la plataforma.
import { callGeminiJSON, toGeminiSchema } from './geminiClient.ts';

const VISION_PROMPT = `Eres un asistente de logística. Examina la foto de un paquete y extrae el número de tracking (tracking number) que aparece en la etiqueta de envío. El número de tracking suele ser una cadena alfanumérica larga (ej: YT2423123456789012, LP009876543210, 4PX1234567890, 79142337780380, etc.). NO devuelvas el código de barras numérico genérico (EAN/UPC de producto). Devuelve SOLO el número de tracking de la transportadora como una cadena CONTINUA sin espacios, guiones ni separadores de ningún tipo (ej: "YT2423123456789012", no "YT2423 1234 5678 9012"). El tracking puede ser una cadena larga de solo números (hasta 22 dígitos) impresa debajo o al lado del código de barras: transcríbela COMPLETA, dígito por dígito, sin cortarla ni completarla a ojo. Si el número no se ve completo o está borroso, devuelve null en vez de devolver un número parcial. Si no puedes leer ningún tracking claro, devuelve null.`;

// Tiempo máximo por proveedor: detrás de esta captura hay más capturas en la cola, así
// que ninguna API puede dejar el trabajo esperando.
const PROVIDER_TIMEOUT_MS = 20000;

export type AiTrackingRead = {
  code: string;
  provider: 'openai' | 'gemini' | '';
  // Detalle solo cuando ninguno de los dos proveedores pudo leer.
  error: string;
};

// Limpia lo que devuelve el modelo: sin espacios, sin comillas y sin signos de cierre.
function cleanTracking(raw: any): string {
  const value = String(raw ?? '')
    .replace(/\s+/g, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.;,]+$/, '');
  return /^[0-9A-Za-z]/.test(value) ? value : '';
}

// Un tracking sirve cuando tiene cuerpo suficiente para ser el código de un envío.
function isPlausible(code: string): boolean {
  return (code.match(/[0-9A-Za-z]/g) || []).length >= 6;
}

async function openaiRead(photoUrl: string): Promise<{ code: string; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { code: '', error: 'sin OPENAI_API_KEY' };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `${VISION_PROMPT}\n\nResponde en JSON: {"tracking_number": "..." o null}` },
              { type: 'image_url', image_url: { url: photoUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { code: '', error: `OpenAI ${res.status}: ${errText.slice(0, 160)}` };
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { code: '', error: 'OpenAI sin respuesta' };
    const code = cleanTracking(JSON.parse(content)?.tracking_number);
    return { code: isPlausible(code) ? code : '', error: '' };
  } catch (err: any) {
    return { code: '', error: `OpenAI: ${String(err?.message || err).slice(0, 160)}` };
  }
}

async function geminiRead(photoUrl: string): Promise<{ code: string; error: string }> {
  try {
    const data = await callGeminiJSON(
      `${VISION_PROMPT}\n\nResponde en JSON: {"tracking_number": "..."} (vacío si no se puede leer)`,
      toGeminiSchema({
        type: 'object',
        properties: {
          tracking_number: { type: 'string', description: 'Tracking leído de la etiqueta; vacío si no se puede leer' },
        },
        required: ['tracking_number'],
      }),
      [photoUrl],
    );
    const code = cleanTracking(data?.tracking_number);
    return { code: isPlausible(code) ? code : '', error: '' };
  } catch (err: any) {
    return { code: '', error: `Gemini: ${String(err?.message || err).slice(0, 160)}` };
  }
}

// Un tracking largo de solo números (más de 13 dígitos) es fácil de transcribir mal:
// un dígito cambiado lo convierte en otro envío que no existe.
function isLongNumeric(code: string): boolean {
  return /^\d{14,}$/.test(code);
}

// Tracking leído con visión. Primero OpenAI, que resuelve la mayoría de las fotos; si
// no responde o no devuelve un código válido se prueba Gemini. Cuando la lectura es un
// número largo, se piden las dos lecturas y solo se devuelve el número si los dos
// proveedores coinciden: antes de dar de alta una carga, un número dudoso no sirve.
export async function extractTrackingWithAI(photoUrl: string): Promise<AiTrackingRead> {
  if (!photoUrl) return { code: '', provider: '', error: '' };

  const openai = await openaiRead(photoUrl);
  if (openai.code && !isLongNumeric(openai.code)) return { code: openai.code, provider: 'openai', error: '' };

  const gemini = await geminiRead(photoUrl);

  if (openai.code && gemini.code) {
    if (openai.code === gemini.code) return { code: openai.code, provider: 'openai', error: '' };
    return {
      code: '',
      provider: '',
      error: `El número largo no se lee igual en las dos lecturas (${openai.code} / ${gemini.code})`,
    };
  }

  if (gemini.code) return { code: gemini.code, provider: 'gemini', error: '' };
  if (openai.code) return { code: openai.code, provider: 'openai', error: '' };

  return {
    code: '',
    provider: '',
    error: [openai.error, gemini.error].filter(Boolean).join(' | '),
  };
}