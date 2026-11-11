export const USD_PER_BLOCK = 50;

export const PAYOUT_METHODS = {
  credito: 'Saldo a favor en TLEC CARGO',
  usdt_trc20: 'USDT (TRC20)',
  usdt_bep20: 'USDT (BEP20)',
  pago_movil: 'Pago Móvil',
  efectivo: 'Efectivo en almacén Valencia',
};

export const SHIPMENT_STATUS = {
  in_transit: { label: 'En tránsito', cls: 'bg-info-bg text-info border-info/20' },
  arrived: { label: 'En Valencia · pago pendiente', cls: 'bg-warning-bg text-warning border-warning/20' },
  paid: { label: 'Computado', cls: 'bg-success-bg text-success border-success/20' },
  excluded: { label: 'No computa', cls: 'bg-muted text-muted-foreground border-border' },
};

export const REQUEST_STATUS = {
  pendiente: { label: 'Pendiente', cls: 'bg-warning-bg text-warning border-warning/20' },
  aprobada: { label: 'Aprobada · en proceso', cls: 'bg-info-bg text-info border-info/20' },
  pagada: { label: 'Pagada', cls: 'bg-success-bg text-success border-success/20' },
  rechazada: { label: 'Rechazada', cls: 'bg-muted text-muted-foreground border-border' },
};

export const PROFILE_STATUS = {
  pendiente: { label: 'En revisión', cls: 'bg-warning-bg text-warning border-warning/20' },
  activo: { label: 'Activo', cls: 'bg-success-bg text-success border-success/20' },
  rechazado: { label: 'Rechazado', cls: 'bg-muted text-muted-foreground border-border' },
  suspendido: { label: 'Suspendido', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export const TERMS = [
  { title: '1. Elegibilidad y registro', items: [
    'Pueden participar clientes activos registrándose con nombre completo, cédula/identificación, teléfono y correo electrónico.',
    'No se admiten auto-referencias: el titular no acumula comisión por sus propios envíos ni bajo cuentas alternas propias.',
  ] },
  { title: '2. Asignación del referido (primer contacto)', items: [
    'El cliente nuevo debe indicar el código de su referidor antes o durante la emisión de su primera guía/embarque en origen (China).',
    'No se admiten vinculaciones extemporáneas una vez que la carga haya zarpado o haya sido recibida en el almacén de destino.',
    'Si varios usuarios reclaman al mismo referido, la comisión corresponde únicamente a quien quedó registrado formalmente primero.',
  ] },
  { title: '3. Base de acumulación y tarifa', items: [
    '$50 USD por cada 1 CBM neto facturado y cobrado, acumulativo entre varios referidos (ej.: 0.2 + 0.3 + 0.5 = 1 CBM).',
    'Sin caducidad: las fracciones acumuladas se mantienen indefinidamente hasta alcanzar el umbral de cobro.',
    'Aplica solo al flete marítimo consolidado regular. Se excluyen almacenaje por abandono, penalizaciones, reempaque, envíos aéreos y aranceles extraordinarios.',
  ] },
  { title: '4. Maduración y condición de pago', items: [
    'Un envío computa solo cuando la carga llega al almacén de Valencia y su factura de flete está cancelada en su totalidad.',
    'Facturas pendientes, cancelaciones, retenciones en origen o devoluciones no suman CBM.',
  ] },
  { title: '5. Métodos y umbral de retiro', items: [
    'Retiro mínimo: 1 CBM acumulado ($50 USD).',
    'Saldo a favor directo para descontar de futuros fletes marítimos propios en TLEC CARGO.',
    'Retiro monetario vía USDT (TRC20/BEP20), Pago Móvil (a tasa acordada de reposición) o efectivo en almacén Valencia, procesado dentro de 5 días hábiles tras la aprobación.',
  ] },
  { title: '6. Conducta y modificaciones', items: [
    'Prohibida la publicidad engañosa, la suplantación de la marca o el spam para captar clientes en nombre de TLEC CARGO.',
    'TLEC CARGO puede auditar los despachos vinculados y suspender la participación ante irregularidades o fraude comprobado.',
  ] },
];