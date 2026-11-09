// "Caja abierta" es el procedimiento normal: se abre el paquete para verificar la
// cantidad. Se muestra en verde y sin tono de alerta en todo el sistema.
export const isOpenBox = (type) => type === 'abierto';
export const OPEN_BOX_LABEL = 'Caja abierta para verificación';
export const OPEN_BOX_SHORT = 'Caja abierta';
export const OPEN_BOX_BADGE = 'border-emerald-200 bg-emerald-50 text-emerald-700';