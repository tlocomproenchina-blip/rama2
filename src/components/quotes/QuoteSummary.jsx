import React from 'react';

export default function QuoteSummary({ subtotalCny, serviceTotalCny, totalCny, totalUsd, servicePercentage, conversionRate }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-bold" style={{ color: '#c52899' }}>Resumen en Yuanes (¥)</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal productos:</span>
            <span className="font-medium">¥{(Number(subtotalCny) || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Servicio {servicePercentage || 0}%:</span>
            <span className="font-medium">¥{(Number(serviceTotalCny) || 0).toFixed(2)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
            <span className="font-bold" style={{ color: '#c52899' }}>Total:</span>
            <span className="text-lg font-bold" style={{ color: '#c52899' }}>¥{(Number(totalCny) || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-bold" style={{ color: '#c52899' }}>Resumen en Dólares ($)</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Tasa de conversión:</span>
            <span className="font-medium">1¥ = ${(Number(conversionRate) || 0.15).toFixed(2)}</span>
          </div>
          <div className="my-2 border-t border-gray-200" />
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-700">TOTAL USD:</span>
            <span className="text-2xl font-bold" style={{ color: '#10b981' }}>${(Number(totalUsd) || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}