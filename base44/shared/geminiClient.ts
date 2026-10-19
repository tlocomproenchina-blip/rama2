// Cliente compartido para llamar directamente a Google Gemini API
// Evita consumir creditos de integracion de Base44 (InvokeLLM)
// Requiere el secret: Gemini-API-Key

import { secrets } from "base44:runtime";

/**
 * Convierte un JSON Schema estandar (type lowercase) al formato que espera Gemini (type UPPERCASE).
 */
export function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  const typeMap: Record<string, string> = {
    object: "OBJECT",
    string: "STRING",
    number: "NUMBER",
    integer: "INTEGER",
    boolean: "BOOLEAN",
    array: "ARRAY"
  };
  const out: any = {};
  if (schema.type) out.type = typeMap[schema.type] || schema.type.toUpperCase();
  if (schema.description) out.description = schema.description;
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      out.properties[k] = toGeminiSchema(v);
    }
  }
  if (schema.required) out.required = schema.required;
  return out;
}

// Google retira los nombres de modelo cada tanto: se prueban en orden y el primero
// que responde queda en uso para las siguientes llamadas.
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-3-flash", "gemini-2.5-flash"];
let activeGeminiModel = "";

/**
 * Tipo de imagen según la extensión del enlace de la foto.
 */
function imageMime(url: string): string {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/**
 * Descarga la foto y la deja lista para viajar dentro de la misma petición: la API de
 * Gemini no descarga por su cuenta los enlaces públicos.
 */
async function fetchImage(url: string): Promise<{ mime_type: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) return null;
    let binary = "";
    const chunk = 0x4000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { mime_type: imageMime(url), data: btoa(binary) };
  } catch (_) {
    return null;
  }
}

/**
 * Llama a Gemini y devuelve un objeto JSON parseado.
 * @param prompt - Texto del prompt
 * @param jsonSchema - Esquema JSON esperado (formato Google Gemini responseSchema)
 * @param imageUrls - Fotos que acompañan al prompt (visión), opcional
 * @param timeoutMs - Tiempo máximo de la llamada, opcional: sin él la petición espera
 *                    lo que tarde la API
 */
export async function callGeminiJSON(prompt: string, jsonSchema: any, imageUrls?: string[], timeoutMs?: number): Promise<any> {
  const apiKey = secrets.get("Gemini-API-Key");
  if (!apiKey) throw new Error("Falta el secret Gemini-API-Key");

  const parts: any[] = [{ text: prompt }];
  for (const url of imageUrls || []) {
    const image = await fetchImage(String(url || ""));
    if (image) parts.push({ inline_data: image });
  }

  const body: any = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: jsonSchema,
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  const models = activeGeminiModel
    ? [activeGeminiModel, ...GEMINI_MODELS.filter((model) => model !== activeGeminiModel)]
    : GEMINI_MODELS;

  let res: any = null;
  let lastError = '';
  for (const model of models) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {})
    });
    if (res.ok) {
      activeGeminiModel = model;
      break;
    }
    const errText = await res.text().catch(() => "");
    lastError = `Gemini API error ${res.status} (${model}): ${errText.slice(0, 160)}`;
    // Solo se sigue probando cuando el modelo no existe: otro error no se arregla
    // cambiando de nombre.
    if (res.status !== 404) break;
  }

  if (!res?.ok) throw new Error(lastError || 'Gemini no respondio');

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini no devolvio contenido");

  try {
    return JSON.parse(text);
  } catch {
    // Intentar extraer JSON de la respuesta
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Gemini no devolvio JSON valido");
  }
}