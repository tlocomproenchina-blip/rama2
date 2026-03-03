import React from 'react';
import { Button } from "@/components/ui/button";

export default function MaintenanceScreen({ message, imageUrl }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow border p-8 text-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Mantenimiento en astillero"
            className="w-full h-40 object-cover rounded-xl mb-4 border"
            loading="eager"
          />
        ) : (
          <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
        )}
        <h1 className="text-2xl font-bold text-slate-800 mb-2">En mantenimiento</h1>
        <p className="text-slate-600 mb-6">{message || 'Estamos realizando mantenimiento. Por favor, inténtalo más tarde.'}</p>
        <div className="text-xs text-slate-400">TLEC Cargo</div>
      </div>
    </div>
  );
}