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
// bulto: { label_code, bulto_number, total_bultos, shipping_mark, client_snapshot }
// Returns Uint8Array ready for Web Bluetooth writeValue.
export const buildBultoLabelPayload = (bulto) => {
  const cs = bulto.client_snapshot || {};
  const estado = (cs.state || 'SIN ESTADO').toUpperCase();
  const shippingMark = bulto.shipping_mark || '';
  const labelCode = bulto.label_code || '';
  const bultoNum = `${bulto.bulto_number || 1}/${bulto.total_bultos || 1}`;

  const lines = [];
  lines.push('SIZE 100 mm,100 mm');
  lines.push('GAP 0,0');
  lines.push('DIRECTION 1');
  lines.push('CLS');

  // 1. Barcode CODE128 centered top (height 100 dots ~12.5mm, human-readable centered below)
  lines.push(`BARCODE 200,20,${q('128')},100,2,0,2,4,${q(labelCode)}`);

  // 2. Label code text centered below barcode (font 1, 1x1)
  lines.push(`TEXT ${centerX(labelCode, '1', 1)},140,${q('1')},0,1,1,${q(labelCode)}`);

  // 3. Separator line
  lines.push('BAR 50,170,700,3');

  // 4. Estado large centered (font 3, 3x3) — priority for sorting
  lines.push(`TEXT ${centerX(estado, '3', 3)},190,${q('3')},0,3,3,${q(estado)}`);

  // 5. Shipping mark medium centered (font 2, 2x2)
  lines.push(`TEXT ${centerX(shippingMark, '2', 2)},290,${q('2')},0,2,2,${q(shippingMark)}`);

  // 6. Separator line
  lines.push('BAR 50,350,700,3');

  // 7. Bulto number right side large (font 2, 2x2)
  lines.push(`TEXT 600,370,${q('2')},0,2,2,${q(bultoNum)}`);

  // 8. Client block left side (font 1, 1x1)
  let cy = 370;
  if (cs.full_name) {
    lines.push(`TEXT 50,${cy},${q('1')},0,1,1,${q(cs.full_name)}`);
    cy += 30;
  }
  if (cs.cedula) {
    lines.push(`TEXT 50,${cy},${q('1')},0,1,1,${q('C.I. ' + cs.cedula)}`);
    cy += 30;
  }
  if (cs.whatsapp) {
    lines.push(`TEXT 50,${cy},${q('1')},0,1,1,${q('Tel: ' + cs.whatsapp)}`);
    cy += 30;
  }
  if (cs.address) {
    const addrLines = wrapText(cs.address, 45);
    for (const ln of addrLines.slice(0, 3)) {
      lines.push(`TEXT 50,${cy},${q('1')},0,1,1,${q(ln)}`);
      cy += 25;
    }
  }
  const cityState = [cs.city, cs.state].filter(Boolean).join(', ');
  if (cityState) {
    lines.push(`TEXT 50,${cy},${q('1')},0,1,1,${q(cityState)}`);
  }

  lines.push('PRINT 1');
  lines.push('END');

  const tspl = lines.join('\r\n') + '\r\n';
  return enc.encode(tspl);
};