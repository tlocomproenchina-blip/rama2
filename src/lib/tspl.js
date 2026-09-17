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
  const shippingMark = bulto.shipping_mark || '';
  const labelCode = bulto.label_code || '';
  const bultoNum = `BULTO ${bulto.bulto_number || 1}/${bulto.total_bultos || 1}`;
  const pkgCount = (bulto.package_ids?.length || bulto.package_trackings?.length || 0);
  const pkgStr = `${pkgCount} PAQUETES`;

  const lines = [];
  lines.push('SIZE 100 mm,100 mm');
  lines.push('GAP 0,0');
  lines.push('DIRECTION 1');
  lines.push('CLS');

  // 1. Barcode CODE128 centered top (height 180 dots ~22.5mm, wider modules for distance reading)
  // Dynamic narrow/wide: use 4/8 for typical codes (≤16 chars), fall back to 3/6 for longer to avoid overflow
  const codeLen = labelCode.length;
  const narrow = codeLen > 16 ? 3 : 4;
  const wide = narrow * 2;
  const barcodeW = (11 * (codeLen + 2) + 2) * narrow;
  const barcodeX = Math.max(20, Math.floor((LABEL_W - barcodeW) / 2));
  lines.push(`BARCODE ${barcodeX},15,${q('128')},180,2,0,${narrow},${wide},${q(labelCode)}`);

  // 2. Label code text centered below barcode (font 2, 2x2 — bigger for distance)
  lines.push(`TEXT ${centerX(labelCode, '2', 2)},205,${q('2')},0,2,2,${q(labelCode)}`);

  // 3. Separator line
  lines.push('BAR 50,265,700,3');

  // 4. Estado large centered (font 3, 3x3) — priority for sorting
  lines.push(`TEXT ${centerX(estado, '3', 3)},280,${q('3')},0,3,3,${q(estado)}`);

  // 5. Separator line
  lines.push('BAR 50,390,700,3');

  // 6. Bulto number + package count in one line centered (font 2, 2x2)
  const bultoPkg = `${bultoNum} - ${pkgStr}`;
  lines.push(`TEXT ${centerX(bultoPkg, '2', 2)},405,${q('2')},0,2,2,${q(bultoPkg)}`);

  // 7. Separator line
  lines.push('BAR 50,465,700,3');

  // 8. Client block — name + cédula in one line, then phone, address, city
  let cy = 480;
  const nameCedula = [cs.full_name, cs.cedula ? `C.I. ${cs.cedula}` : ''].filter(Boolean).join(' - ');
  if (nameCedula) {
    lines.push(`TEXT 50,${cy},${q('2')},0,2,2,${q(nameCedula)}`);
    cy += 52;
  }
  if (cs.whatsapp) {
    lines.push(`TEXT 50,${cy},${q('2')},0,1,1,${q('Tel: ' + cs.whatsapp)}`);
    cy += 26;
  }
  if (cs.address) {
    const addrLines = wrapText(cs.address, 40);
    for (const ln of addrLines.slice(0, 2)) {
      lines.push(`TEXT 50,${cy},${q('2')},0,1,1,${q(ln)}`);
      cy += 24;
    }
  }
  const cityState = [cs.city, cs.state].filter(Boolean).join(', ');
  if (cityState) {
    lines.push(`TEXT 50,${cy},${q('2')},0,1,1,${q(cityState)}`);
  }

  lines.push('PRINT 1');
  lines.push('END');

  const tspl = lines.join('\r\n') + '\r\n';
  return enc.encode(tspl);
};