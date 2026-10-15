// Generador de códigos QR propio (sin dependencias externas): modo byte, nivel de
// corrección M, versiones 1 a 10 y máscara elegida por penalización.
// Se usa para el símbolo escaneable de las etiquetas nuevas: el QR que se imprime en la
// etiqueta térmica, el que sale en la etiqueta de envío del cliente y el que llevan los
// PDF de etiquetas.

// Nivel de corrección M en los 2 bits de la información de formato (L=01, M=00, Q=11, H=10).
const EC_BITS_M = 0b00;

// Bloques Reed-Solomon por versión para el nivel M:
// [bloques, codewords por bloque, codewords de datos por bloque, ...]
const RS_BLOCKS_M = [
  [1, 26, 16],
  [1, 44, 28],
  [1, 70, 44],
  [2, 50, 32],
  [2, 67, 43],
  [4, 43, 27],
  [4, 49, 31],
  [2, 60, 38, 2, 61, 39],
  [3, 58, 36, 2, 59, 37],
  [4, 69, 43, 1, 70, 44],
];

// Centros de los patrones de alineación (la versión 1 no lleva).
const ALIGNMENT_POSITIONS = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

// Aritmética en GF(256) con el polinomio primitivo del QR (x^8 + x^4 + x^3 + x^2 + 1).
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let value = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = value;
    LOG[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// Polinomio generador de Reed-Solomon para una cantidad de codewords de corrección.
const generatorPoly = (degree) => {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
};

// Codewords de corrección de un bloque: el resto de dividirlo entre el generador.
const ecCodewords = (data, degree) => {
  const gen = generatorPoly(degree);
  const rem = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[0];
    rem.shift();
    rem.push(0);
    if (factor) for (let i = 0; i < degree; i++) rem[i] ^= mul(gen[i + 1], factor);
  }
  return rem;
};

// Texto a bytes UTF-8.
const utf8 = (text) => {
  const bytes = [];
  for (const char of String(text ?? '')) {
    const cp = char.codePointAt(0);
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return bytes;
};

const dataCodewords = (version) => {
  const spec = RS_BLOCKS_M[version - 1];
  let total = 0;
  for (let i = 0; i < spec.length; i += 3) total += spec[i] * spec[i + 2];
  return total;
};

// Cuántos bytes de texto entran en esa versión (descontando el encabezado del modo byte,
// que lleva 8 bits de largo hasta la versión 9 y 16 bits desde la 10).
const capacityBytes = (version) => {
  const headerBits = 4 + (version < 10 ? 8 : 16);
  return Math.floor((dataCodewords(version) * 8 - headerBits) / 8);
};

const pickVersion = (byteLength) => {
  for (let version = 1; version <= RS_BLOCKS_M.length; version++) {
    if (byteLength <= capacityBytes(version)) return version;
  }
  throw new Error('El texto es demasiado largo para un código QR de esta etiqueta');
};

// Cantidad de módulos (lado) del QR que le corresponde a ese texto.
export const qrModuleCount = (text) => pickVersion(utf8(text).length) * 4 + 17;

// Codewords finales del símbolo: datos con su relleno, corrección por bloques e intercalado.
const buildCodewords = (bytes) => {
  const version = pickVersion(bytes.length);
  const spec = RS_BLOCKS_M[version - 1];
  const capacity = dataCodewords(version);

  const bits = [];
  const pushBits = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  pushBits(0b0100, 4); // modo byte
  pushBits(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((byte) => pushBits(byte, 8));
  for (let i = 0; i < 4 && bits.length < capacity * 8; i++) bits.push(0); // terminador
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  for (let i = 0; data.length < capacity; i++) data.push(i % 2 ? 0x11 : 0xec);

  const blocks = [];
  let offset = 0;
  for (let i = 0; i < spec.length; i += 3) {
    for (let b = 0; b < spec[i]; b++) {
      const chunk = data.slice(offset, offset + spec[i + 2]);
      offset += spec[i + 2];
      blocks.push({ data: chunk, ec: ecCodewords(chunk, spec[i + 1] - spec[i + 2]) });
    }
  }

  const codewords = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) {
    blocks.forEach((b) => {
      if (i < b.data.length) codewords.push(b.data[i]);
    });
  }
  const maxEc = Math.max(...blocks.map((b) => b.ec.length));
  for (let i = 0; i < maxEc; i++) {
    blocks.forEach((b) => {
      if (i < b.ec.length) codewords.push(b.ec[i]);
    });
  }

  return { version, codewords, blocks };
};

// Información de formato y de versión (códigos BCH del estándar).
const bchDigit = (data) => {
  let digits = 0;
  let value = data;
  while (value) {
    digits += 1;
    value >>>= 1;
  }
  return digits;
};

const G15 = 0b10100110111;
const G15_MASK = 0b101010000010010;
const formatBits = (mask) => {
  const data = (EC_BITS_M << 3) | mask;
  let d = data << 10;
  while (bchDigit(d) - bchDigit(G15) >= 0) d ^= G15 << (bchDigit(d) - bchDigit(G15));
  return ((data << 10) | d) ^ G15_MASK;
};

const G18 = 0b1111100100101;
const versionBits = (version) => {
  let d = version << 12;
  while (bchDigit(d) - bchDigit(G18) >= 0) d ^= G18 << (bchDigit(d) - bchDigit(G18));
  return (version << 12) | d;
};

// Máscaras del estándar (la que mejor puntúa se aplica al símbolo).
const MASKS = [
  (row, col) => (row + col) % 2 === 0,
  (row) => row % 2 === 0,
  (row, col) => col % 3 === 0,
  (row, col) => (row + col) % 3 === 0,
  (row, col) => (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0,
  (row, col) => ((row * col) % 2) + ((row * col) % 3) === 0,
  (row, col) => (((row * col) % 2) + ((row * col) % 3)) % 2 === 0,
  (row, col) => (((row + col) % 2) + ((row * col) % 3)) % 2 === 0,
];

// Arma el símbolo completo con la máscara indicada.
const buildMatrix = (version, codewords, mask) => {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));

  const set = (row, col, dark) => {
    if (row < 0 || col < 0 || row >= size || col >= size) return;
    modules[row][col] = dark;
    fixed[row][col] = true;
  };

  // Patrones de localización con su separador.
  const finder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        set(row + r, col + c, dark);
      }
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);

  // Patrones de sincronización.
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    set(i, 6, dark);
    set(6, i, dark);
  }

  // Patrones de alineación (los que caen sobre un localizador no se dibujan).
  const centers = ALIGNMENT_POSITIONS[version - 1];
  centers.forEach((row) =>
    centers.forEach((col) => {
      if (fixed[row][col]) return;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          set(row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
        }
      }
    })
  );

  // Información de formato (las dos copias) y de versión desde la 7.
  const fmt = formatBits(mask);
  for (let i = 0; i < 15; i++) {
    const dark = ((fmt >> i) & 1) === 1;
    if (i < 6) set(i, 8, dark);
    else if (i < 8) set(i + 1, 8, dark);
    else set(size - 15 + i, 8, dark);
    if (i < 8) set(8, size - i - 1, dark);
    else if (i < 9) set(8, 7, dark);
    else set(8, 14 - i, dark);
  }
  set(size - 8, 8, true); // módulo oscuro fijo
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >> i) & 1) === 1;
      set(Math.floor(i / 3), (i % 3) + size - 11, dark);
      set((i % 3) + size - 11, Math.floor(i / 3), dark);
    }
  }

  // Datos en zigzag, de abajo hacia arriba y de derecha a izquierda, aplicando la máscara.
  const maskFn = MASKS[mask];
  let step = -1;
  let row = size - 1;
  let bitIndex = 7;
  let byteIndex = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const colPos = col - c;
        if (!fixed[row][colPos]) {
          let dark = false;
          if (byteIndex < codewords.length) dark = ((codewords[byteIndex] >>> bitIndex) & 1) === 1;
          if (maskFn(row, colPos)) dark = !dark;
          modules[row][colPos] = dark;
          bitIndex -= 1;
          if (bitIndex === -1) {
            byteIndex += 1;
            bitIndex = 7;
          }
        }
      }
      row += step;
      if (row < 0 || row >= size) {
        row -= step;
        step = -step;
        break;
      }
    }
  }

  return modules;
};

// Puntaje de la máscara: mientras más bajo, mejor se lee el símbolo.
const penaltyScore = (modules) => {
  const size = modules.length;
  let score = 0;

  // Bloques de un mismo color
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      let same = 0;
      const dark = modules[row][col];
      for (let r = -1; r <= 1; r++) {
        if (row + r < 0 || row + r >= size) continue;
        for (let c = -1; c <= 1; c++) {
          if (col + c < 0 || col + c >= size) continue;
          if (r === 0 && c === 0) continue;
          if (dark === modules[row + r][col + c]) same += 1;
        }
      }
      if (same > 5) score += 3 + same - 5;
    }
  }

  // Cuadros de 2×2 del mismo color
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const count =
        (modules[row][col] ? 1 : 0) +
        (modules[row + 1][col] ? 1 : 0) +
        (modules[row][col + 1] ? 1 : 0) +
        (modules[row + 1][col + 1] ? 1 : 0);
      if (count === 0 || count === 4) score += 3;
    }
  }

  // Series parecidas a los localizadores
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size - 6; col++) {
      if (
        modules[row][col] &&
        !modules[row][col + 1] &&
        modules[row][col + 2] &&
        modules[row][col + 3] &&
        modules[row][col + 4] &&
        !modules[row][col + 5] &&
        modules[row][col + 6]
      ) {
        score += 40;
      }
    }
  }
  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size - 6; row++) {
      if (
        modules[row][col] &&
        !modules[row + 1][col] &&
        modules[row + 2][col] &&
        modules[row + 3][col] &&
        modules[row + 4][col] &&
        !modules[row + 5][col] &&
        modules[row + 6][col]
      ) {
        score += 40;
      }
    }
  }

  // Proporción de módulos oscuros
  let dark = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) if (modules[row][col]) dark += 1;
  }
  score += (Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;

  return score;
};

// Matriz de módulos del QR que corresponde a ese texto: true es un módulo oscuro.
export const qrMatrix = (text) => {
  const bytes = utf8(text);
  const { version, codewords } = buildCodewords(bytes);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const modules = buildMatrix(version, codewords, mask);
    const penalty = penaltyScore(modules);
    if (!best || penalty < best.penalty) best = { modules, penalty };
  }

  return { size: best.modules.length, modules: best.modules };
};

// Dibuja el QR en un canvas (navegador) para incrustarlo en etiquetas y PDF.
export const qrToCanvas = (text, { moduleSize = 10, margin = 2 } = {}) => {
  const { size, modules } = qrMatrix(text);
  const side = (size + margin * 2) * moduleSize;
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, side, side);
  ctx.fillStyle = '#000000';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (modules[row][col]) {
        ctx.fillRect((col + margin) * moduleSize, (row + margin) * moduleSize, moduleSize, moduleSize);
      }
    }
  }
  return canvas;
};

// Imagen del QR lista para incrustar en un PDF.
export const qrDataUrl = (text, options) => qrToCanvas(text, options).toDataURL('image/png');