// Estado de supervisión de un caso escalado: rojo pendiente, verde atendido.
// Los casos sin escalar no llevan color. Al cerrarse el caso sale del tablero.
export function supervisionState(c) {
  if (!c?.escalated) return null;
  return c.supervisor_reply_date || c.escalation_status === 'atendida' ? 'atendido' : 'pendiente';
}

export const SUPERVISION_STYLE = {
  pendiente: { card: 'border-l-4 border-l-red-500 bg-red-50', badge: 'bg-red-100 text-red-700', label: 'Pendiente supervisión' },
  atendido: { card: 'border-l-4 border-l-emerald-500 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', label: 'Atendido' },
};