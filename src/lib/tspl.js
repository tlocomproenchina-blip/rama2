// TSPL command builder for 100×100mm thermal labels (POS-9250-L / ZJ-9250).
// TSPL is a text-based label printing language using absolute coordinates (dots at 203 DPI = 8 dots/mm).
// 100mm = 800 dots. Commands are ASCII text, one per line, terminated with \r\n.
// Reference: TSPL/TSPL2 Programming Manual (TSC / Zijiang-compatible).

import { labelContentCodes, realPackageCount } from '@/lib/bultoCounts';

const enc = new TextEncoder();

// Label dimensions in dots (203 DPI: 8 dots/mm)
const LABEL_W = 800;

// Approximate character widths (dots) for built-in bitmap fonts before scaling
const FONT_WIDTH = { '1': 8, '2': 16, '3': 24, '4': 32, '5': 40 };

// Escape content for TSPL (wrap in quotes, escape inner quotes)
const q = (str) => `"${String(str ?? '').replace(/"/g, '""')}"`;

// Compute x to center text horizontally on the 800-dot label
const centerX = (text, font, xMult) => {
  const cw = FONT_WIDTH[font] || 8;
  const w = String(text ?? '').length * cw * (xMult || 1);
  return Math.max(10, Math.floor((LABEL_W - w) / 2));
};

// Concatenate Uint8Arrays into one (for batch printing)
export const concatUint8Arrays = (arrays) => {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
};

// Wrap text to max chars per line (for address)
const wrapText = (text, maxChars) => {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxChars) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

// Build the full bulto label payload in TSPL (100×100mm).
// bulto: { label_code, bulto_number, total_bultos, shipping_mark, client_snapshot, package_ids, package_trackings }
// Returns Uint8Array ready for Web Bluetooth writeValue.
export const buildBultoLabelPayload = (bulto) => {
  const cs = bulto.client_snapshot || {};
  const estado = (cs.state || 'SIN ESTADO').toUpperCase();
  const labelCode = bulto.label_code || '';
  const bultoNum = `BULTO ${bulto.bulto_number || 1}/${bulto.total_bultos || 1}`;
  // El número impreso es el conteo real del bulto o de la caja: el mismo que muestra la
  // ficha del almacén, sin sumar las etiquetas de los bultos ya fusionados dentro.
  const pkgCount = realPackageCount(bulto);
  const bultoPkg = `${bultoNum} - ${pkgCount} PAQUETES`;
  const trackings = labelContentCodes(bulto);

  // Métricas verticales (dots @203dpi). Altura real de cada texto + respiro.
  const MARGIN = 20;
  const PRINTABLE_H = LABEL_W - MARGIN * 2; // 760 dots de alto útil
  const CONTENT_LINE_H = 16;
  const CONTENT_TITLE_H = 28; // separador + título CONTENIDO

  const nameCedula = [cs.full_name, cs.cedula ? `C.I. ${cs.cedula}` : ''].filter(Boolean).join(' - ');
  const cityState = [cs.city, cs.state].filter(Boolean).join(', ');
  const addrLines = cs.address ? wrapText(cs.address, 40).slice(0, 2) : [];
  const orderNumbers = Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers.filter(Boolean) : [];
  // N° de contenedor tal cual: la etiqueta lo rotula "CONTENEDOR" en pequeño.
  const ordenStr = orderNumbers.join(', ');

  // Cada bloque conoce su alto y se dibuja en la Y que se le asigna
  const blocks = [];
  const addBlock = (h, render) => blocks.push({ h, render });

  // 1. Código de barras + código de etiqueta
  const codeLen = labelCode.length;
  const narrow = codeLen > 16 ? 3 : 4;
  const wide = narrow * 2;
  const barcodeW = (11 * (codeLen + 2) + 2) * narrow;
  const barcodeX = Math.max(20, Math.floor((LABEL_W - barcodeW) / 2));
  addBlock(238, (y) => [
    `BARCODE ${barcodeX},${y},${q('128')},180,2,0,${narrow},${wide},${q(labelCode)}`,
    `TEXT ${centerX(labelCode, '2', 2)},${y + 192},${q('2')},0,2,2,${q(labelCode)}`,
  ]);

  // 2. Separador
  addBlock(22, (y) => [`BAR 50,${y + 9},700,3`]);

  // 3. ESTADO + N° de contenedor: van en la misma línea y con el mismo tamaño, con
  //    el rótulo "CONTENEDOR" en pequeño justo encima del número.
  const BIG_CW = FONT_WIDTH['3']; // ancho de carácter de la fuente grande (24 dots)
  const ROW_GAP = 40; // separación entre ESTADO y el N° de contenedor
  addBlock(ordenStr ? 94 : 78, (y) => {
    // Escala común a los dos textos: llega al tamaño grande del ESTADO (3x) y baja
    // solo lo necesario para que ambos entren juntos en el ancho de la etiqueta.
    let scale = 3;
    if (ordenStr) {
      const units = (estado.length + ordenStr.length) * BIG_CW;
      scale = Math.max(1, Math.min(3, Math.floor((LABEL_W - 60) / (units + ROW_GAP))));
    }
    const estadoW = estado.length * BIG_CW * scale;
    const orderW = ordenStr ? ordenStr.length * BIG_CW * scale : 0;
    const pairW = estadoW + (ordenStr ? ROW_GAP + orderW : 0);
    const x0 = Math.max(10, Math.floor((LABEL_W - pairW) / 2));
    // El número baja una línea para dejar sitio al rótulo de arriba.
    const textY = y + (ordenStr ? 16 : 0);
    const lines = [`TEXT ${x0},${textY},${q('3')},0,${scale},${scale},${q(estado)}`];
    if (ordenStr) {
      const orderX = x0 + estadoW + ROW_GAP;
      const captionW = 10 * 16; // "CONTENEDOR" con la fuente 1 al doble de ancho
      lines.push(`TEXT ${orderX + Math.max(0, Math.floor((orderW - captionW) / 2))},${y},${q('1')},0,1,1,${q('CONTENEDOR')}`);
      lines.push(`TEXT ${orderX},${textY},${q('3')},0,${scale},${scale},${q(ordenStr)}`);
    }
    return lines;
  });

  // 5. Separador
  addBlock(22, (y) => [`BAR 50,${y + 9},700,3`]);

  // 6. Bulto X/Y + cantidad de paquetes
  addBlock(48, (y) => [`TEXT ${centerX(bultoPkg, '2', 2)},${y},${q('2')},0,2,2,${q(bultoPkg)}`]);

  // 7. Separador
  addBlock(22, (y) => [`BAR 50,${y + 9},700,3`]);

  // 8. Datos del cliente
  if (nameCedula) addBlock(48, (y) => [`TEXT 50,${y},${q('2')},0,2,2,${q(nameCedula)}`]);
  if (cs.whatsapp) addBlock(26, (y) => [`TEXT 50,${y},${q('2')},0,1,1,${q('Tel: ' + cs.whatsapp)}`]);
  for (const ln of addrLines) addBlock(24, (y) => [`TEXT 50,${y},${q('2')},0,1,1,${q(ln)}`]);
  if (cityState) addBlock(26, (y) => [`TEXT 50,${y},${q('2')},0,1,1,${q(cityState)}`]);

  const fixedH = blocks.reduce((sum, b) => sum + b.h, 0);

  // 9. Trackings contenidos: usan el espacio que sobra tras centrar el resto.
  //    Si no caben todos, la última línea resume cuántos faltan ("+N más") y
  //    nunca se invade el borde inferior de la etiqueta.
  const hasContent = trackings.length > 0 && PRINTABLE_H - fixedH >= CONTENT_TITLE_H + CONTENT_LINE_H;
  const maxLines = hasContent ? Math.max(1, Math.floor((PRINTABLE_H - fixedH - CONTENT_TITLE_H) / CONTENT_LINE_H)) : 0;
  const drawnLines = hasContent ? Math.min(trackings.length, maxLines) : 0;
  const truncated = hasContent && trackings.length > drawnLines;
  const shown = truncated ? drawnLines - 1 : drawnLines;

  // Centrado vertical: el contenido queda con márgenes parejos arriba y abajo
  const contentH = hasContent ? CONTENT_TITLE_H : 0;
  const totalH = fixedH + contentH + drawnLines * CONTENT_LINE_H;
  const offsetY = MARGIN + Math.max(0, Math.round((PRINTABLE_H - totalH) / 2));

  const lines = [];
  lines.push('SIZE 100 mm,100 mm');
  lines.push('GAP 0,0');
  lines.push('DIRECTION 1');
  lines.push('CLS');

  let y = offsetY;
  for (const b of blocks) {
    lines.push(...b.render(y));
    y += b.h;
  }

  if (hasContent) {
    lines.push(`BAR 50,${y + 4},700,3`);
    lines.push(`TEXT 50,${y + 16},${q('1')},0,1,1,${q(`CONTENIDO (${trackings.length})`)}`);
    y += contentH;
    for (const t of trackings.slice(0, shown)) {
      lines.push(`TEXT 50,${y},${q('1')},0,1,1,${q(String(t).slice(0, 45))}`);
      y += CONTENT_LINE_H;
    }
    if (truncated) {
      lines.push(`TEXT 50,${y},${q('1')},0,1,1,${q(`+${trackings.length - shown} más`)}`);
    }
  }

  lines.push('PRINT 1');
  lines.push('END');

  const tspl = lines.join('\r\n') + '\r\n';
  return enc.encode(tspl);
};

// Etiqueta continua 100×100 mm (rollo continuo, sin separación) para identificar los
// paquetes de un despacho: número X/N en grande y centrado, datos del cliente tal
// como quedaron guardados en la guía y, al pie, el número de guía con su fecha.
// Cuando identifica una caja consolidada (barcodeCode) imprime además el código de
// barras de la caja: es el que se escanea en Despacho por Escaneo para dar la salida
// definitiva de todo su contenido.
// client: { full_name, cedula, whatsapp, address, city, state, shipping_mark }
export const buildContinuousLabelPayload = ({
  client = {},
  index = 1,
  total = 1,
  guideNumber = '',
  emittedAt = '',
  barcodeCode = '',
  packageCount = 0,
  cbm = 0,
}) => {
  const cs = client || {};
  const counter = `${index}/${total}`;
  const nameCedula = [cs.full_name, cs.cedula ? `C.I. ${cs.cedula}` : ''].filter(Boolean).join(' - ');
  const cityState = [cs.city, cs.state].filter(Boolean).join(', ');
  const mark = String(cs.shipping_mark || '').trim();
  const code = String(barcodeCode || '').trim();
  const dateStr = emittedAt ? new Date(emittedAt).toLocaleDateString('es-VE') : '';
  const footer = [guideNumber ? `GUIA ${guideNumber}` : '', dateStr].filter(Boolean).join('  ·  ');

  const MARGIN = 20;
  const PRINTABLE_H = LABEL_W - MARGIN * 2;

  // Armazón de una etiqueta de 100×100 mm. `compact` recorta la dirección y las filas
  // grandes a una sola línea, y `counterLimit` deja achicar el X/N: entre los dos el
  // contenido siempre cabe en la etiqueta, aunque lleve código de barras. Sin código
  // de barras el reparto es el de siempre.
  const buildLayout = ({ compact = false, counterLimit = 4 } = {}) => {
    const blocks = [];
    const addBlock = (h, render) => blocks.push({ h, render });

    // 1. Número X/N: el protagonista de la etiqueta, en el tamaño más grande que quepa
    const counterScale = Math.max(
      1,
      Math.min(counterLimit, Math.floor((LABEL_W - 60) / (counter.length * FONT_WIDTH['4'])))
    );
    addBlock(FONT_WIDTH['4'] * counterScale + 30, (y) => [
      `TEXT ${centerX(counter, '4', counterScale)},${y},${q('4')},0,${counterScale},${counterScale},${q(counter)}`,
    ]);

    // 2. Separador
    addBlock(22, (y) => [`BAR 50,${y + 9},700,3`]);

    // 3. Nombre y cédula: se achica solo cuando el nombre es muy largo
    if (nameCedula) {
      const nameScale = Math.max(1, Math.min(2, Math.floor((LABEL_W - 60) / (nameCedula.length * FONT_WIDTH['2']))));
      addBlock(FONT_WIDTH['2'] * nameScale + 18, (y) => [
        `TEXT ${centerX(nameCedula, '2', nameScale)},${y},${q('2')},0,${nameScale},${nameScale},${q(nameCedula)}`,
      ]);
    }

    // 4. Datos de entrega del cliente
    if (cs.whatsapp) addBlock(34, (y) => [`TEXT 50,${y},${q('2')},0,1,1,${q('Tel: ' + cs.whatsapp)}`]);
    for (const ln of cs.address ? wrapText(cs.address, 40).slice(0, compact ? 1 : 2) : []) {
      addBlock(30, (y) => [`TEXT 50,${y},${q('2')},0,1,1,${q(ln)}`]);
    }

    // 5. Estado donde quedó registrado el cliente y su shipping mark: centrados y en
    //    grande hasta donde el ancho de la etiqueta lo permita, porque son los datos
    //    que se leen de un vistazo al recibir el paquete.
    const bigRow = (y, row, scale) => [
      `TEXT ${centerX(row, '2', scale)},${y},${q('2')},0,${scale},${scale},${q(row)}`,
    ];
    const addBigText = (text) => {
      const rows = wrapText(text, 40).slice(0, compact ? 1 : 2);
      const longest = rows.reduce((m, r) => Math.max(m, r.length), 1);
      const scale = Math.max(1, Math.min(2, Math.floor((LABEL_W - 60) / (longest * FONT_WIDTH['2']))));
      for (const row of rows) addBlock(FONT_WIDTH['2'] * scale + 16, (y) => bigRow(y, row, scale));
    };
    if (cityState) addBigText(cityState);
    if (mark) addBigText(`MARK: ${mark}`);

    // 5b. Paquetes y CBM de la caja que lleva la etiqueta: solo se imprime cuando el
    //     lote trae esos datos (etiquetas de un lote de cajas listas para despachar).
    const cajaInfo = [
      Number(packageCount) > 0 ? `${Number(packageCount)} PAQUETES` : '',
      Number(cbm) > 0 ? `${Number(cbm).toFixed(3)} CBM` : '',
    ]
      .filter(Boolean)
      .join('  ·  ');
    if (cajaInfo) {
      addBlock(26, (y) => [`TEXT ${centerX(cajaInfo, '2', 1)},${y},${q('2')},0,1,1,${q(cajaInfo)}`]);
    }

    // 6. Código de barras de la caja: identifica la caja que lleva pegada la etiqueta
    //    y es el que se escanea al despachar. Va escrito también bajo las barras.
    if (code) {
      const narrow = code.length > 22 ? 1 : 2;
      const wide = narrow * 2;
      const barsWidth = (11 * (code.length + 2) + 2) * narrow;
      const codeScale = code.length > 18 ? 1 : 2;
      addBlock(154, (y) => [
        `BARCODE ${Math.max(20, Math.floor((LABEL_W - barsWidth) / 2))},${y},${q('128')},120,0,0,${narrow},${wide},${q(code)}`,
        `TEXT ${centerX(code, '2', codeScale)},${y + 126},${q('2')},0,${codeScale},${codeScale},${q(code)}`,
      ]);
    }

    // 7. Pie: guía emitida y su fecha
    if (footer) {
      addBlock(22, (y) => [`BAR 50,${y + 9},700,3`]);
      addBlock(24, (y) => [`TEXT 50,${y},${q('1')},0,1,1,${q(footer)}`]);
    }

    return { blocks, height: blocks.reduce((sum, b) => sum + b.h, 0) };
  };

  // Si el contenido no cabe (etiqueta con código de barras), se compacta y, de ser
  // necesario, se achica el X/N hasta que entre.
  let layout = buildLayout();
  if (layout.height > PRINTABLE_H) layout = buildLayout({ compact: true });
  for (let limit = 3; layout.height > PRINTABLE_H && limit >= 1; limit -= 1) {
    layout = buildLayout({ compact: true, counterLimit: limit });
  }

  // Centrado vertical: márgenes parejos arriba y abajo
  const lines = ['SIZE 100 mm,100 mm', 'GAP 0,0', 'DIRECTION 1', 'CLS'];
  let y = MARGIN + Math.max(0, Math.round((PRINTABLE_H - layout.height) / 2));
  for (const b of layout.blocks) {
    lines.push(...b.render(y));
    y += b.h;
  }
  lines.push('PRINT 1');
  lines.push('END');

  return enc.encode(lines.join('\r\n') + '\r\n');
};