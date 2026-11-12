// "Cerrado para verificación" es la revisión normal sin faltantes ni daños: se
// registra sola, sin abrir una incidencia, y se muestra en verde. "Caja abierta",
// "Faltante" y "Dañado" son incidencias y se muestran en rojo.
export const isClosedBox = (type) => type === 'cerrado';
export const CLOSED_BOX_LABEL = 'Cerrado para verificación';
export const CLOSED_BOX_SHORT = 'Cerrado';
export const CLOSED_BOX_BADGE = 'border-emerald-200 bg-emerald-50 text-emerald-700';
export const INCIDENT_BADGE = 'border-red-200 bg-red-50 text-red-700';
export const INCIDENT_TYPE_LABEL = { abierto: 'Caja abierta', faltante: 'Contenido faltante', danado: 'Paquete dañado' };