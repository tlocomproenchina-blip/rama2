import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ShippingLabelContent from '@/components/client-portal/labels/ShippingLabelContent';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Convierte una etiqueta guardada (ShippingLabel) al formato del formulario de etiquetas.
export const labelToForm = (label) => ({
  content: label.content || '',
  dimensions: label.dimensions || '',
  weight: label.weight || '',
  hasFBrand: !!label.has_fbrand,
  hasBattery: !!label.has_battery,
  hasLiquid: !!label.has_liquid,
  hasPowder: !!label.has_powder,
  boxCount: String(label.box_count || 1),
});

// Dibuja la etiqueta fuera de pantalla y la descarga como archivo:
// 1 caja → PNG, 2 o más cajas → PDF con una página por caja.
export async function downloadShippingLabelFile(label, config) {
  const form = labelToForm(label);
  const boxTotal = Math.max(1, Number(label.box_count) || 1);
  const logoUrl = config?.app_logo_url || config?.invoice_logo_url || '';
  const companyName = config?.app_name || 'IMPORTACIONES TLEC CARGO';

  const host = document.createElement('div');
  host.setAttribute('data-label-host', '1');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:380px;background:#fff;';
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    flushSync(() => {
      root.render(
        <div>
          {Array.from({ length: boxTotal }).map((_, i) => (
            <div key={i} data-label-box style={{ width: 380, background: '#fff', fontFamily: 'Arial, sans-serif' }}>
              <ShippingLabelContent
                shippingMark={label.shipping_mark}
                form={form}
                logoUrl={logoUrl}
                companyName={companyName}
                config={config}
                labelCode={label.label_code}
                boxIndex={i + 1}
                boxTotal={boxTotal}
              />
            </div>
          ))}
        </div>
      );
    });

    // Espera al código QR (canvas) y al logo antes de capturar
    await wait(150);
    await Promise.all(
      Array.from(host.querySelectorAll('img')).map((img) =>
        img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
      )
    );

    const { default: html2canvas } = await import('html2canvas');
    const boxes = Array.from(host.querySelectorAll('[data-label-box]'));
    const canvases = [];
    for (const box of boxes) {
      canvases.push(await html2canvas(box, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: Math.max(window.innerWidth, 480),
        // En la copia que se captura, la etiqueta se ubica en 0,0 para que no se recorte el borde izquierdo
        onclone: (doc) => {
          const h = doc.querySelector('[data-label-host]');
          if (h) h.style.cssText = 'position:absolute;left:0;top:0;width:380px;background:#fff;';
        },
      }));
    }

    if (boxTotal === 1) {
      const link = document.createElement('a');
      link.download = `etiqueta-${label.label_code}.png`;
      link.href = canvases[0].toDataURL('image/png');
      link.click();
      return;
    }

    const { jsPDF } = await import('jspdf');
    let pdf = null;
    canvases.forEach((canvas, i) => {
      const w = canvas.width;
      const h = canvas.height;
      const orientation = w > h ? 'landscape' : 'portrait';
      if (i === 0) {
        pdf = new jsPDF({ orientation, unit: 'px', format: [w, h], hotfixes: ['px_scaling'] });
      } else {
        pdf.addPage([w, h], orientation);
      }
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    });
    pdf.save(`etiquetas-${label.label_code}-${boxTotal}cajas.pdf`);
  } finally {
    root.unmount();
    host.remove();
  }
}