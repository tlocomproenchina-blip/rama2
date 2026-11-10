// Utilidades numéricas compartidas: convertir a número seguro y mostrar montos en USD.
export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const money = (v) => `$${num(v).toFixed(2)}`;