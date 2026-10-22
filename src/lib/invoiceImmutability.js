// Regla de negocio: las facturas no se pueden editar una vez creadas.
// Toda factura se guarda marcada como inmutable (`locked`) para que los procesos
// automáticos (recálculo de tarifas, almacenamiento, montacargas, fusión de
// recibos) la omitan. La única corrección posible es eliminarla y crear una nueva.

export const INVOICE_IMMUTABLE_REASON =
  'Factura inmutable: no se puede editar. Para corregirla, elimínala y crea una nueva.';

export const INVOICE_IMMUTABLE_NOTICE =
  'Las facturas no se pueden editar. Si hay un error, borra la factura y crea una nueva.';

// Datos con los que se crea una factura inmutable.
export const IMMUTABLE_INVOICE_FIELDS = {
  locked: true,
  lock_reason: INVOICE_IMMUTABLE_REASON,
};