// Qué trabajo se muestra por área. Cada clave corresponde a un conteo que calcula
// la función getEmployeeOperations.

export const METRIC_LABELS = {
  bultos_creados: 'Bultos registrados',
  cajas_creadas: 'Cajas consolidadas',
  paquetes_empacados: 'Paquetes empacados',
  paquetes_recibidos: 'Paquetes recibidos',
  bultos_reconocidos_ve: 'Bultos reconocidos en Venezuela',
  paquetes_despachados: 'Paquetes despachados',
  revisiones_caja: 'Revisiones de caja',
  revisiones_con_incidencia: 'Revisiones con incidencia',
  guias_emitidas: 'Guías de despacho emitidas',
  facturas_generadas: 'Facturas generadas',
  pagos_aprobados: 'Pagos aprobados',
  facturas_fiscales_emitidas: 'Facturas fiscales emitidas',
  tickets_asignados: 'Tickets abiertos (asignados)',
  tickets_atendidos: 'Tickets atendidos',
  respuestas_enviadas: 'Respuestas enviadas',
  tickets_cerrados: 'Tickets cerrados',
  tickets_pendientes: 'Tickets pendientes ahora',
};

const WAREHOUSE = ['bultos_creados', 'cajas_creadas', 'paquetes_empacados', 'paquetes_recibidos', 'bultos_reconocidos_ve', 'paquetes_despachados', 'revisiones_caja', 'revisiones_con_incidencia', 'guias_emitidas'];
const ADMIN = ['facturas_generadas', 'pagos_aprobados', 'facturas_fiscales_emitidas'];
const SUPPORT = ['tickets_asignados', 'tickets_atendidos', 'respuestas_enviadas', 'tickets_cerrados', 'tickets_pendientes'];

// Métricas que siempre se muestran según el área del empleado.
export const AREA_METRICS = {
  almacen: WAREHOUSE,
  contabilidad: ADMIN,
  soporte: SUPPORT,
};

export const ALL_METRIC_KEYS = [...WAREHOUSE, ...ADMIN, ...SUPPORT];

// Una métrica "de snapshot" no suma al total de actividad del periodo.
export function metricsToShow(employee) {
  const primary = AREA_METRICS[employee.area_code] || [];
  const extras = ALL_METRIC_KEYS.filter((key) => !primary.includes(key) && Number(employee.counts?.[key] || 0) > 0);
  return { primary, extras };
}