// IA disponible para leer el tracking de las fotos de cargas huérfanas.
// Cada modelo se compara con puntos (0 a 3) en tres aspectos:
// - quality: qué tan bien lee las etiquetas de las fotos.
// - credits: consumo de créditos de integración de Base44 (0 = no consume).
// - speed: qué tan rápido responde.
// El color del punto indica si el aspecto está bien (verde) o mal (rojo).
export const ORPHAN_AI_DEFAULT = 'claude_sonnet_4_6';

export const ORPHAN_AI_METRICS = [
  { key: 'quality', label: 'Calidad', short: 'Calidad' },
  { key: 'credits', label: 'Créditos', short: 'Créditos' },
  { key: 'speed', label: 'Velocidad', short: 'Velocidad' },
];

export const ORPHAN_AI_DOT_COLORS = {
  quality: { 1: 'bg-rose-400', 2: 'bg-amber-400', 3: 'bg-emerald-500' },
  credits: { 0: 'bg-emerald-500', 1: 'bg-emerald-500', 2: 'bg-amber-400', 3: 'bg-rose-500' },
  speed: { 1: 'bg-rose-400', 2: 'bg-amber-400', 3: 'bg-emerald-500' },
};

export const ORPHAN_AI_MODELS = [
  { key: 'claude-sonnet-5', label: 'Claude Sonnet 5', quality: 3, credits: 2, speed: 2 },
  { key: 'claude_opus_5', label: 'Claude Opus 5', quality: 3, credits: 3, speed: 1 },
  { key: 'claude_sonnet_4_6', label: 'Claude Sonnet 4.6', quality: 2, credits: 2, speed: 2 },
  { key: 'gpt_5_6_sol', label: 'GPT-5.6 Sol', quality: 3, credits: 3, speed: 2 },
  { key: 'gpt_5_6_luna', label: 'GPT-5.6 Luna', quality: 2, credits: 2, speed: 3 },
  { key: 'gpt_5_4', label: 'GPT-5.4', quality: 2, credits: 2, speed: 2 },
  { key: 'gemini_3_1_pro', label: 'Gemini 3.1 Pro', quality: 3, credits: 2, speed: 2 },
  { key: 'gemini_3_flash', label: 'Gemini 3 Flash', quality: 2, credits: 1, speed: 3 },
  { key: 'gpt_5_mini', label: 'GPT-5 Mini', quality: 1, credits: 1, speed: 3 },
  { key: 'automatic', label: 'Automático (Base44 elige)', quality: 2, credits: 2, speed: 2 },
  { key: 'openai_direct', label: 'OpenAI directo (gpt-4o-mini)', quality: 1, credits: 0, speed: 3 },
];

export function getOrphanAiModel(key) {
  return (
    ORPHAN_AI_MODELS.find((m) => m.key === key) ||
    ORPHAN_AI_MODELS.find((m) => m.key === ORPHAN_AI_DEFAULT) ||
    ORPHAN_AI_MODELS[0]
  );
}

// Etiquetas que resaltan lo que le importa al administrador al elegir: cuál lee
// mejor las fotos y cuál consume más (o no consume) créditos de integración.
export function modelTags(model) {
  const tags = [];
  if (model.quality === 3) {
    tags.push({ text: 'Mejor lectura', className: 'border-blue-200 bg-blue-50 text-blue-700' });
  }
  if (model.credits === 0) {
    tags.push({ text: 'Sin créditos', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' });
  } else if (model.credits === 1) {
    tags.push({ text: 'Bajo consumo', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' });
  } else if (model.credits === 3) {
    tags.push({ text: 'Alto consumo', className: 'border-rose-200 bg-rose-50 text-rose-600' });
  }
  return tags;
}