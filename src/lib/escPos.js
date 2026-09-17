// ESC/POS command builder for 100×100mm thermal labels (POS-9250-L / ZJ-9250).
// All functions return Uint8Array; use concatUint8Arrays to combine before sending via Web Bluetooth.

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const enc = new TextEncoder();
const text = (str) => enc.encode(String(str ?? ''));
const cmd = (...bytes) => new Uint8Array(bytes);
const lineFeed = (n = 1) => new Uint8Array(Array(n).fill(LF));

// Concatenate multiple Uint8Arrays into one
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

// Initialize printer (ESC @)
export const initPrinter = () => cmd(ESC, 0x40);

// Alignment: 0=left, 1=center, 2=right
export const setAlign = (n) => cmd(ESC, 0x61, n & 0x03);

// Print mode (ESC ! n): bit flags for font style
// 0x01 = emphasized (bold-ish), 0x08 = double height, 0x10 = double width, 0x20 = underline
export const setPrintMode = (n) => cmd(ESC, 0x21, n & 0xFF);

// Font size via GS ! n  (n = (width-1)<<4 | (height-1), each 0-7 → 1x..8x)
export const setFontSize = (width, height) => cmd(GS, 0x21, (((width - 1) & 0x07) << 4) | ((height - 1) & 0x07));

// Bold on/off
export const boldOn = () => cmd(ESC, 0x45, 0x01);
export const boldOff = () => cmd(ESC, 0x45, 0x00);

// Barcode height in dots (GS h n), 1-255
export const setBarcodeHeight = (n) => cmd(GS, 0x68, n & 0xFF);

// Barcode module width (GS w n), 1-6
export const setBarcodeWidth = (n) => cmd(GS, 0x77, n & 0x0F);

// HRI text position (GS H n): 0=off, 1=above, 2=below, 3=both
export const setBarcodeTextPosition = (n) => cmd(GS, 0x48, n & 0x0F);

// Print CODE128 barcode (GS k 73 n d1...dn)
export const printBarcodeCODE128 = (data) => {
  const dataBytes = text(data);
  const len = dataBytes.length;
  return cmd(GS, 0x6B, 73, len, ...dataBytes);
};

// Feed paper and cut (GS V 0 = partial cut)
export const feedAndCut = () => cmd(GS, 0x56, 0x00);

// Build the full bulto label payload (100×100mm).
// bulto: { label_code, bulto_number, total_bultos, shipping_mark, client_snapshot, invoice_paid, invoice_number }
export const buildBultoLabelPayload = (bulto) => {
  const cs = bulto.client_snapshot || {};
  const parts = [];

  parts.push(initPrinter());

  // 1. --- Barcode CODE128 of label_code (centered, top) ---
  parts.push(setAlign(1));
  parts.push(setBarcodeHeight(80)); // ~10mm at 8 dots/mm
  parts.push(setBarcodeWidth(2));
  parts.push(setBarcodeTextPosition(2)); // HRI below
  parts.push(printBarcodeCODE128(bulto.label_code));
  parts.push(lineFeed(2));

  // 2. --- Estado (very large, centered) ---
  parts.push(setAlign(1));
  parts.push(setFontSize(3, 3));
  parts.push(boldOn());
  parts.push(text(bulto.invoice_paid ? 'PAGADA' : 'PENDIENTE'));
  parts.push(boldOff());
  parts.push(setFontSize(1, 1));
  parts.push(lineFeed(2));

  // 3. --- Shipping mark (medium, bold, centered) ---
  parts.push(setAlign(1));
  parts.push(setFontSize(2, 2));
  parts.push(boldOn());
  parts.push(text(bulto.shipping_mark || ''));
  parts.push(boldOff());
  parts.push(setFontSize(1, 1));
  parts.push(lineFeed(2));

  // 4. --- Bulto number (large, right margin) ---
  parts.push(setAlign(2));
  parts.push(setFontSize(2, 2));
  parts.push(boldOn());
  parts.push(text(`${bulto.bulto_number}/${bulto.total_bultos}`));
  parts.push(boldOff());
  parts.push(setFontSize(1, 1));
  parts.push(lineFeed(2));

  // 5. --- Cliente (nombre + cédula, left aligned) ---
  parts.push(setAlign(0));
  if (cs.full_name) {
    parts.push(boldOn());
    parts.push(text(cs.full_name));
    parts.push(boldOff());
    parts.push(lineFeed(1));
  }
  if (cs.cedula) {
    parts.push(text(`C.I. ${cs.cedula}`));
    parts.push(lineFeed(1));
  }

  // 6. --- Teléfono (one line) ---
  if (cs.whatsapp) {
    parts.push(text(`Tel: ${cs.whatsapp}`));
    parts.push(lineFeed(1));
  }

  // 7. --- Dirección (normal size, may wrap 2-3 lines) ---
  if (cs.address) {
    parts.push(text(cs.address));
    parts.push(lineFeed(1));
  }
  const cityState = [cs.city, cs.state].filter(Boolean).join(', ');
  if (cityState) {
    parts.push(text(cityState));
    parts.push(lineFeed(1));
  }
  parts.push(lineFeed(1));

  // --- Feed and cut ---
  parts.push(lineFeed(2));
  parts.push(feedAndCut());

  return concatUint8Arrays(parts);
};