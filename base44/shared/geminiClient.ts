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

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Llama a Gemini y devuelve un objeto JSON parseado.
 * @param prompt - Texto del prompt
 * @param jsonSchema - Esquema JSON esperado (formato Google Gemini responseSchema)
 */
export async function callGeminiJSON(prompt: string, jsonSchema: any): Promise<any> {
  const apiKey = secrets.get("Gemini-API-Key");
  if (!apiKey) throw new Error("Falta el secret Gemini-API-Key");

  const body: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: jsonSchema,
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

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