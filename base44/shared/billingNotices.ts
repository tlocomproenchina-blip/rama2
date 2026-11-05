// Calendario y contenido de los avisos de cobro según los Términos y Condiciones
// (sección VII, actualización del 5 de noviembre de 2026).
//
//   Días 1 al 7   plazo ordinario (el día 1 es el día siguiente a la emisión).
//   Día 8         cargo mínimo de USD 100 por almacenamiento y custodia (por factura).
//   Día 9 en adelante  USD 20 adicionales por cada día continuo.
//   Día 20        aviso formal de incumplimiento y presunto abandono contractual.
//   Días 21 al 25 plazo adicional final de cinco días.
//   Día 26        la empresa puede iniciar el procedimiento de disposición,
//                 siempre conforme a la legislación aplicable.

const DAY_MS = 24 * 60 * 60 * 1000;
const CARACAS_OFFSET_MS = 4 * 60 * 60 * 1000;
export const APP_URL = 'https://tleccargo.com';
const LOGO = 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/362c2e6ac_WhatsAppImage2026-08-17at90120AM.jpeg';

export const DUE_DAYS = 7;
export const MIN_STORAGE_DAY = 8;
export const MIN_STORAGE_FEE = 100;
export const DAILY_STORAGE_FEE = 20;

export type StageKey =
  | 'recordatorio_d5' | 'vence_hoy_d7' | 'vencida_d8' | 'estado_cuenta_d14'
  | 'aviso_formal_d20' | 'plazo_adicional_d22' | 'ultimo_dia_d25' | 'disposicion_d26';

// Día del calendario en que se envía cada aviso.
export const STAGES: { key: StageKey; day: number }[] = [
  { key: 'recordatorio_d5', day: 5 },
  { key: 'vence_hoy_d7', day: 7 },
  { key: 'vencida_d8', day: 8 },
  { key: 'estado_cuenta_d14', day: 14 },
  { key: 'aviso_formal_d20', day: 20 },
  { key: 'plazo_adicional_d22', day: 22 },
  { key: 'ultimo_dia_d25', day: 25 },
  { key: 'disposicion_d26', day: 26 },
];

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v: any) => `USD ${num(v).toFixed(2)}`;

function caracasDayStart(value: any) {
  const d = new Date(new Date(value).getTime() - CARACAS_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Días continuos desde la emisión: el día de emisión es 0 y el siguiente es el día 1.
export function termsDay(invoiceDate: any, now: Date = new Date()) {
  if (!invoiceDate) return 0;
  return Math.floor((caracasDayStart(now) - caracasDayStart(invoiceDate)) / DAY_MS);
}

// Cargo acumulado de almacenamiento y custodia en un día dado (7.7 a 7.9).
export function storageAccrued(day: number) {
  if (day < MIN_STORAGE_DAY) return 0;
  return MIN_STORAGE_FEE + DAILY_STORAGE_FEE * (day - MIN_STORAGE_DAY);
}

// Fecha (en Caracas) del día N del calendario de una factura.
export function dateOfDay(invoiceDate: any, day: number) {
  const base = caracasDayStart(invoiceDate) + day * DAY_MS;
  return new Date(base).toLocaleDateString('es-VE', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });
}

export function invoiceBalance(invoice: any) {
  return Math.max(0, Math.round((num(invoice?.total) - num(invoice?.paid_amount)) * 100) / 100);
}

// La factura deja de recibir avisos cuando se paga, se cancela, tiene un pago en
// revisión o ya no tiene saldo.
export function shouldStopNotices(invoice: any) {
  const status = String(invoice?.status || '').trim();
  if (['pagada', 'cancelada', 'revision'].includes(status)) return true;
  return invoiceBalance(invoice) <= 0.01;
}

// --- Contenido ----------------------------------------------------------------

type Tone = 'info' | 'warn' | 'alert';
const TONES: Record<Tone, { bg: string; border: string; text: string }> = {
  info: { bg: '#eff6ff', border: '#5c9eeb', text: '#1e3a8a' },
  warn: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
  alert: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' },
};

interface Ctx {
  clientName: string;
  invoiceNumber: string;
  invoiceDate: any;
  day: number;
  balance: number;
}

function row(label: string, value: string, strong = false) {
  return `<tr><td style="padding:8px 0;color:#64748b;font-size:14px;">${label}</td><td style="padding:8px 0;text-align:right;font-size:14px;color:#0f172a;${strong ? 'font-weight:700;' : ''}">${value}</td></tr>`;
}

function timeline(ctx: Ctx) {
  const items = [
    ['Días 1 al 7', `Plazo para pagar la factura (vence el ${dateOfDay(ctx.invoiceDate, DUE_DAYS)}).`, 0],
    ['Día 8', 'Cargo mínimo de USD 100,00 por almacenamiento y custodia.', 8],
    ['Día 9 en adelante', 'USD 20,00 adicionales por cada día continuo.', 9],
    ['Día 20', 'Aviso formal de incumplimiento y presunto abandono contractual.', 20],
    ['Días 21 al 25', 'Plazo adicional final de cinco días para pagar todo.', 21],
    ['Día 26', 'Posible inicio del procedimiento de disposición conforme a la ley.', 26],
  ];
  return items.map(([title, desc, day]) => {
    const current = ctx.day >= (day as number);
    return `<tr><td style="padding:6px 0;vertical-align:top;width:130px;font-size:13px;font-weight:700;color:${current ? '#0f172a' : '#94a3b8'};">${title}</td><td style="padding:6px 0;font-size:13px;color:${current ? '#334155' : '#94a3b8'};">${desc}</td></tr>`;
  }).join('');
}

function layout({ ctx, headline, subheadline, tone, paragraphs, cta, legal }: any) {
  const accrued = storageAccrued(ctx.day);
  const t = TONES[tone as Tone];
  const summary = [
    row('Factura', ctx.invoiceNumber),
    row('Fecha de emisión', dateOfDay(ctx.invoiceDate, 0)),
    row('Vencimiento', dateOfDay(ctx.invoiceDate, DUE_DAYS)),
    row('Día del calendario', ctx.day > 0 ? `Día ${ctx.day}` : 'Día de emisión'),
    row('Saldo de la factura', money(ctx.balance)),
    ...(accrued > 0 ? [
      row('Cargo único almacenamiento (día 8)', money(MIN_STORAGE_FEE)),
      row(`Cargos diarios (${ctx.day - MIN_STORAGE_DAY} × USD ${DAILY_STORAGE_FEE})`, money(accrued - MIN_STORAGE_FEE)),
    ] : []),
    row('Total a regularizar', money(ctx.balance + accrued), true),
  ].join('');

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f7fafd;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafd;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;font-family:Inter,Arial,sans-serif;">
<tr><td style="background:#5c9eeb;padding:20px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td><img src="${LOGO}" width="44" height="44" alt="TLEC CARGO" style="display:block;border-radius:10px;"></td>
    <td style="padding-left:12px;color:#000000;font-family:Manrope,Arial,sans-serif;">
      <div style="font-size:16px;font-weight:800;">TLEC CARGO</div>
      <div style="font-size:12px;">Tu carga asegurada desde China hasta Venezuela</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:32px 28px 8px;">
  <h1 style="margin:0 0 8px;font-family:Manrope,Arial,sans-serif;font-size:24px;line-height:1.25;color:#0f172a;">${headline}</h1>
  <p style="margin:0;font-size:15px;line-height:1.6;color:#64748b;">${subheadline}</p>
</td></tr>
<tr><td style="padding:20px 28px 0;">
  <p style="margin:0 0 12px;font-size:15px;color:#0f172a;">Hola ${ctx.clientName},</p>
  ${paragraphs.map((p: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0f172a;">${p}</p>`).join('')}
</td></tr>
<tr><td style="padding:12px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.bg};border-left:4px solid ${t.border};border-radius:12px;padding:12px 16px;">
    <tr><td style="padding:12px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${summary}</table></td></tr>
  </table>
  <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#64748b;">El total incluye el saldo de la factura y los cargos de almacenamiento y custodia que generan los Términos a la fecha de este aviso. Se pueden sumar otros conceptos ya facturados. Solicita tu estado de cuenta actualizado cuando lo necesites.</p>
</td></tr>
<tr><td align="left" style="padding:16px 28px 8px;">
  <a href="${APP_URL}/MyInvoices" style="display:inline-block;background:#5c9eeb;color:#000000;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;">${cta}</a>
</td></tr>
<tr><td style="padding:20px 28px 8px;">
  <div style="font-family:Manrope,Arial,sans-serif;font-size:15px;font-weight:700;color:${t.text};margin-bottom:6px;">Calendario de pago</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${timeline(ctx)}</table>
</td></tr>
${legal ? `<tr><td style="padding:12px 28px 8px;"><p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;">${legal}</p></td></tr>` : ''}
<tr><td style="padding:20px 28px 28px;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">Si ya realizaste el pago, ignora este mensaje: los avisos se detienen cuando el pago queda registrado. Un pago parcial no detiene el calendario ni los cargos (cláusula 7.21). Para dudas, responde por tus canales habituales de atención o visita <a href="${APP_URL}" style="color:#2563eb;">tleccargo.com</a>.</p>
  <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;">TLEC GROUP LLC · TLEC CARGO · Términos y Condiciones del 5 de noviembre de 2026, sección VII.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

const LEGAL_ABANDONO = 'La declaración contractual de presunto abandono no transfiere automáticamente la propiedad de la mercancía a TLEC GROUP LLC ni permite disponer de ella al margen de la ley. Cualquier actuación se realizará cumpliendo las notificaciones, autorizaciones, plazos y formalidades que exija la legislación del lugar donde se encuentre la mercancía; si la ley exige un procedimiento o plazo distinto, prevalece la norma imperativa.';

export function buildBillingEmail(stage: StageKey | 'emitida', ctx: Ctx) {
  const n = ctx.invoiceNumber;
  const due = dateOfDay(ctx.invoiceDate, DUE_DAYS);
  const accrued = storageAccrued(ctx.day);
  const day25 = dateOfDay(ctx.invoiceDate, 25);
  const day21 = dateOfDay(ctx.invoiceDate, 21);

  const defs: Record<string, any> = {
    emitida: {
      subject: `Tu factura ${n} está disponible`,
      headline: `Tu factura ${n} está lista`,
      subheadline: `Tienes 7 días continuos para pagarla. Vence el ${due}.`,
      tone: 'info',
      paragraphs: [
        `Emitimos la factura ${n} por ${money(ctx.balance)}. El plazo de 7 días cuenta desde el día siguiente a la emisión.`,
        'Si la factura no está pagada por completo al terminar ese plazo, desde el día 8 se genera un cargo mínimo de USD 100,00 por almacenamiento y custodia, y desde el día 9 se suman USD 20,00 por cada día continuo.',
        'Revisa los conceptos y avísanos de cualquier diferencia antes de pagar.',
      ],
      cta: 'Ver y pagar mi factura',
      inApp: `Tu factura ${n} está disponible por ${money(ctx.balance)}. Vence el ${due}.`,
    },
    recordatorio_d5: {
      subject: `Recordatorio: tu factura ${n} vence en 2 días`,
      headline: 'Tu factura vence en 2 días',
      subheadline: `Paga antes del ${due} y evita los cargos de almacenamiento y custodia.`,
      tone: 'info',
      paragraphs: [
        `La factura ${n} tiene un saldo de ${money(ctx.balance)} y vence el ${due}.`,
        'Al pagarla a tiempo no se genera ningún cargo de almacenamiento y podemos gestionar el despacho de tu carga.',
      ],
      cta: 'Pagar mi factura',
      inApp: `Tu factura ${n} vence el ${due}. Saldo: ${money(ctx.balance)}.`,
    },
    vence_hoy_d7: {
      subject: `Tu factura ${n} vence hoy`,
      headline: 'Hoy es el último día del plazo ordinario',
      subheadline: 'Mañana se genera el cargo mínimo de USD 100,00 por almacenamiento y custodia.',
      tone: 'warn',
      paragraphs: [
        `La factura ${n} tiene un saldo de ${money(ctx.balance)} y vence hoy, ${due}.`,
        'Si no queda pagada por completo hoy, desde mañana (día 8) se genera el cargo mínimo de USD 100,00 y desde el día 9 se suman USD 20,00 diarios.',
      ],
      cta: 'Pagar hoy',
      inApp: `Tu factura ${n} vence hoy. Mañana se genera el cargo mínimo de USD 100,00.`,
    },
    vencida_d8: {
      subject: `Factura ${n} vencida: se generó el cargo de almacenamiento`,
      headline: 'Tu factura está vencida',
      subheadline: 'Hoy se generó el cargo mínimo de USD 100,00 por almacenamiento, custodia y resguardo.',
      tone: 'warn',
      paragraphs: [
        `El plazo ordinario de la factura ${n} terminó el ${due} y queda un saldo de ${money(ctx.balance)}.`,
        'Según la cláusula 7.7 se generó el cargo mínimo de USD 100,00 por esta factura. Desde mañana (día 9) se suman USD 20,00 por cada día continuo mientras la mercancía siga en almacén con el pago pendiente.',
      ],
      cta: 'Regularizar mi pago',
      inApp: `Factura ${n} vencida. Cargo de almacenamiento acumulado: ${money(accrued)}.`,
    },
    estado_cuenta_d14: {
      subject: `Estado de cuenta de tu factura ${n}: ${money(ctx.balance + accrued)}`,
      headline: 'Tu estado de cuenta',
      subheadline: `Llevas ${money(accrued)} en cargos de almacenamiento y custodia, y siguen sumando USD 20,00 diarios.`,
      tone: 'warn',
      paragraphs: [
        `La factura ${n} sigue pendiente. Hoy es el día ${ctx.day} desde su emisión.`,
        `Si el pago sigue pendiente el día 20 (${dateOfDay(ctx.invoiceDate, 20)}), te enviaremos un aviso formal de incumplimiento y presunto abandono contractual de la mercancía.`,
      ],
      cta: 'Pagar y detener los cargos',
      inApp: `Factura ${n}: total a regularizar ${money(ctx.balance + accrued)}.`,
    },
    aviso_formal_d20: {
      subject: `Aviso formal de incumplimiento y presunto abandono: factura ${n}`,
      headline: 'Aviso formal de incumplimiento',
      subheadline: `Tienes un último plazo del ${day21} al ${day25} para pagar todo lo pendiente.`,
      tone: 'alert',
      paragraphs: [
        `Por medio de este aviso, conforme a las cláusulas 7.11 y 7.12 de los Términos y Condiciones, te notificamos que la factura ${n} no ha sido pagada por completo 20 días después de su emisión. Este aviso es la notificación formal de incumplimiento y de presunto abandono contractual de la mercancía asociada.`,
        `<strong>Plazo para regularizar:</strong> del ${day21} hasta el cierre del ${day25} (días 21 al 25, ambos inclusive) puedes pagar el saldo de la factura, los cargos de almacenamiento y custodia acumulados y cualquier otro concepto exigible. Durante ese plazo la mercancía sigue bajo custodia y el cargo diario continúa.`,
        '<strong>Si pagas dentro del plazo</strong>, gestionaremos la liberación, despacho o entrega una vez verificados los fondos y los requisitos operativos y documentales.',
        '<strong>Si no se regulariza al cierre del día 25</strong>, desde el día 26 TLEC CARGO podrá iniciar las actuaciones para disponer de la mercancía por los medios legalmente permitidos (cláusulas 7.16 y 7.17).',
      ],
      cta: 'Regularizar ahora',
      legal: LEGAL_ABANDONO,
      inApp: `Aviso formal: factura ${n} impaga. Plazo final hasta el ${day25}.`,
    },
    plazo_adicional_d22: {
      subject: `Quedan 3 días del plazo final de tu factura ${n}`,
      headline: 'Quedan 3 días del plazo final',
      subheadline: `El plazo adicional cierra el ${day25}.`,
      tone: 'alert',
      paragraphs: [
        `La factura ${n} sigue pendiente después del aviso formal del día 20. El total a regularizar a hoy es de ${money(ctx.balance + accrued)}.`,
        'Paga antes del cierre del día 25 para que podamos gestionar la liberación de tu carga y evitar el inicio del procedimiento de disposición.',
      ],
      cta: 'Pagar antes del cierre',
      legal: LEGAL_ABANDONO,
      inApp: `Quedan 3 días del plazo final de la factura ${n} (cierra el ${day25}).`,
    },
    ultimo_dia_d25: {
      subject: `Hoy cierra el plazo final de tu factura ${n}`,
      headline: 'Hoy es el último día para regularizar',
      subheadline: 'Al cierre de hoy termina el plazo adicional de cinco días.',
      tone: 'alert',
      paragraphs: [
        `La factura ${n} y sus cargos suman ${money(ctx.balance + accrued)} a hoy.`,
        'Si el pago completo no queda registrado al cierre de hoy, desde mañana (día 26) TLEC CARGO podrá iniciar el procedimiento de disposición de la mercancía por los medios legalmente permitidos.',
      ],
      cta: 'Pagar hoy',
      legal: LEGAL_ABANDONO,
      inApp: `Hoy cierra el plazo final de la factura ${n}.`,
    },
    disposicion_d26: {
      subject: `Aviso sobre la mercancía de tu factura ${n}`,
      headline: 'Terminó el plazo para regularizar',
      subheadline: 'TLEC CARGO podrá iniciar el procedimiento de disposición conforme a la ley.',
      tone: 'alert',
      paragraphs: [
        `El plazo adicional de la factura ${n} cerró el ${day25} sin que se registrara el pago completo.`,
        'Conforme a la cláusula 7.16, desde hoy TLEC CARGO podrá iniciar las actuaciones para disponer de la mercancía por los medios legalmente permitidos, siguiendo las notificaciones, autorizaciones, plazos y formalidades que exija la legislación del lugar donde se encuentre. Los cargos de almacenamiento y custodia siguen acumulándose mientras la mercancía permanezca bajo custodia (cláusula 7.10).',
        'Si deseas conocer el estado de tu operación o solicitar tu estado de cuenta actualizado, contáctanos de inmediato.',
      ],
      cta: 'Ver mi factura',
      legal: LEGAL_ABANDONO,
      inApp: `Terminó el plazo de la factura ${n}. Contáctanos de inmediato.`,
    },
  };

  const def = defs[stage];
  return {
    subject: def.subject,
    html: layout({ ctx, ...def }),
    inAppTitle: def.headline,
    inAppMessage: def.inApp,
    priority: ['aviso_formal_d20', 'plazo_adicional_d22', 'ultimo_dia_d25', 'disposicion_d26', 'vencida_d8'].includes(stage) ? 'high' : 'medium',
  };
}