import React, { useEffect, useRef } from 'react';
import { qrMatrix } from '@/lib/qrCode';

// Dibuja un código QR en un canvas para las etiquetas nuevas: queda como imagen dentro
// del DOM, así que se imprime, se descarga en PNG/PDF y se copia igual con html2canvas.
// moduleSize es el tamaño de cada módulo en la imagen: mientras más alto, más nítido sale
// en papel, aunque en pantalla el QR siempre mida lo que indica `size`.
export default function QrCodeCanvas({ value, size = 108, moduleSize = 10, margin = 2, className = '', style }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !value) return;
    const { size: modules, modules: matrix } = qrMatrix(value);
    const side = (modules + margin * 2) * moduleSize;
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = '#000000';
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        if (matrix[row][col]) {
          ctx.fillRect((col + margin) * moduleSize, (row + margin) * moduleSize, moduleSize, moduleSize);
        }
      }
    }
  }, [value, moduleSize, margin]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, ...style }}
      aria-label={value ? `Código QR ${value}` : 'Código QR'}
    />
  );
}