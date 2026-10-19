// Nombres visibles de los métodos de pago de un abono (InvoicePayment.method).
export const METHOD_LABELS = {
  transferencia: 'Transferencia',
  usdt_trc20: 'USDT TRC20',
  binance: 'Binance',
  paypal: 'PayPal',
  wally: 'Wally',
  zinli: 'Zinli',
  wise: 'Wise',
  skrill: 'Skrill',
  pago_movil_usdt: 'Pago Móvil → USDT',
  stripe: 'Tarjeta',
  otro: 'Otro',
};

// Opciones para elegir el método al registrar un abono.
export const ABONO_METHODS = Object.entries(METHOD_LABELS).map(([id, name]) => ({ id, name }));