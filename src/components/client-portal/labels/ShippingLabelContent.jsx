import React from 'react';
import QrCodeCanvas from '@/components/common/QrCodeCanvas';

// Diseño de la etiqueta de envío (380 px de ancho) que se descarga como PNG/PDF.
// Lo usan el generador del cliente y la ficha de Soporte.
export default function ShippingLabelContent({ shippingMark, form, logoUrl, companyName, config, labelCode, boxIndex, boxTotal }) {
  const check = (val) => val ? '☑' : '☐';

  // Dirección del almacén: preferir almacén 2 (Yiwu) si está activo, sino almacén 1
  const useWarehouse2 = !!(config?.warehouse2_address && config.warehouse2_address.trim());
  const warehouseAddress = (useWarehouse2 ? config.warehouse2_address : config?.warehouse_address) || '';
  const warehousePhone = (useWarehouse2 ? config.warehouse2_phone : config?.warehouse_phone) || '';
  const warehouseZipcode = (useWarehouse2 ? config.warehouse2_zipcode : config?.warehouse_zipcode) || '';
  const warehouseName = (useWarehouse2 ? config.warehouse2_name : config?.warehouse_name) || '';

  const isMultiBox = boxTotal > 1;

  return (
    <div style={{ width: 380, fontSize: 12, color: '#000', lineHeight: 1.4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '3px solid #000', padding: '10px 12px' }}>
        <div style={{ width: 48, height: 48, border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 28, marginRight: 10, flexShrink: 0 }}>
          M
        </div>
        <div style={{ flex: 1, fontSize: 11, lineHeight: 1.5 }}>
          <div>若无此入仓单</div>
          <div>将默认拒收处理</div>
          <div>贴外箱/装箱内</div>
          <div>《填写信息不可缺失》</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" crossOrigin="anonymous" style={{ width: 50, height: 50, objectFit: 'contain' }} />
          ) : (
            <div style={{ fontSize: 11, fontWeight: 700 }}>{companyName}</div>
          )}
        </div>
      </div>

      {/* Shipping Mark / Label Code + indicador de caja */}
      <div style={{ padding: '8px 12px', borderBottom: '2px solid #000', textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>{labelCode || shippingMark || 'SHIPPING MARK'}</div>
        {isMultiBox && (
          <div style={{ fontSize: 13, fontWeight: 800, color: '#b45309', marginTop: 2 }}>
            Caja {boxIndex} de {boxTotal}
          </div>
        )}
      </div>

      {/* Fields */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #999' }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>包装盒内容</div>
        <div style={{ minHeight: 22, borderBottom: '1px dotted #999', paddingBottom: 2 }}>{form.content || ''}</div>
      </div>
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #999' }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>包装盒尺寸</div>
        <div style={{ minHeight: 22, borderBottom: '1px dotted #999', paddingBottom: 2 }}>{form.dimensions || ''}</div>
      </div>
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #999' }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>重量</div>
        <div style={{ minHeight: 22, borderBottom: '1px dotted #999', paddingBottom: 2 }}>{form.weight || ''}</div>
      </div>

      {/* Checkboxes */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #999' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>是否含有</div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          F牌:{check(form.hasFBrand)} / 带电:{check(form.hasBattery)} / 液体:{check(form.hasLiquid)} / 粉末:{check(form.hasPowder)}
        </div>
      </div>

      {/* Código QR + número de caja */}
      <div style={{ display: 'flex', borderBottom: '2px solid #000', minHeight: 70 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px', borderRight: '1px solid #999' }}>
          {labelCode ? (
            <QrCodeCanvas value={labelCode} size={104} />
          ) : (
            <div style={{ width: '100%', height: 104, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 }}>
              CÓDIGO QR
            </div>
          )}
        </div>
        <div style={{ width: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 6px' }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>箱数</div>
          {isMultiBox ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 900, marginTop: 2, lineHeight: 1.1 }}>{boxIndex}/{boxTotal}</div>
              <div style={{ fontSize: 9, fontWeight: 700, marginTop: 1, color: '#b45309' }}>Caja</div>
            </>
          ) : (
            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>{form.boxCount || '1'}</div>
          )}
          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: '#444' }}>海运</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 12px', fontSize: 11, lineHeight: 1.6, borderTop: '1px solid #999' }}>
        {warehouseAddress && <div>地址：{warehouseAddress}</div>}
        {warehouseName && <div>仓库负责人：{warehouseName}</div>}
        {warehouseZipcode && <div>邮编：{warehouseZipcode}</div>}
        {warehousePhone && <div>电话：{warehousePhone}</div>}
      </div>
    </div>
  );
}