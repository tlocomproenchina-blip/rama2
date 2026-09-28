// TSPL command builder for 100×100mm thermal labels (POS-9250-L / ZJ-9250).
// TSPL is a text-based label printing language using absolute coordinates (dots at 203 DPI = 8 dots/mm).
// 100mm = 800 dots. Commands are ASCII text, one per line, terminated with \r\n.
// Reference: TSPL/TSPL2 Programming Manual (TSC / Zijiang-compatible).

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
  // Los códigos sin registrar cuentan como un paquete más del bulto
  const pkgCount = ((bulto.package_ids?.length || 0) + (bulto.unregistered_codes?.length || 0))
    || (bulto.package_trackings?.length || 0);
  const bultoPkg = `${bultoNum} - ${pkgCount} PAQUETES`;
  const trackings = Array.isArray(bulto.package_trackings) ? bulto.package_trackings.filter(Boolean) : [];

  // Métricas verticales (dots @203dpi). Altura real de cada texto + respiro.
  const MARGIN = 20;
  const PRINTABLE_H = LABEL_W - MARGIN * 2; // 760 dots de alto útil
  const CONTENT_LINE_H = 16;
  const CONTENT_TITLE_H = 28; // separador + título CONTENIDO

  const nameCedula = [cs.full_name, cs.cedula ? `C.I. ${cs.cedula}` : ''].filter(Boolean).join(' - ');
  const cityState = [cs.city, cs.state].filter(Boolean).join(', ');
  const addrLines = cs.address ? wrapText(cs.address, 40).slice(0, 2) : [];
  const orderNumbers = Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers.filter(Boolean) : [];
  const ordenStr = orderNumbers.length ? `ORDEN: ${orderNumbers.join(', ')}` : '';

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

  // 3. Estado en grande (prioridad para clasificar a distancia)
  addBlock(78, (y) => [`TEXT ${centerX(estado, '3', 3)},${y},${q('3')},0,3,3,${q(estado)}`]);

  // 4. N° de orden (si ya fue asignado)
  if (ordenStr) {
    addBlock(26, (y) => [`TEXT ${centerX(ordenStr, '2', 1)},${y},${q('2')},0,2,1,${q(ordenStr)}`]);
  }

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