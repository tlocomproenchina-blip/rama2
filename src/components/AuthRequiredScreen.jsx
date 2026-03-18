import React from 'react';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

export default function AuthRequiredScreen({ onLogin }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-blue-100">
          <Lock className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Debes iniciar sesión</h1>
        <p className="text-slate-600 mb-6">Esta sección requiere acceso autorizado para poder continuar.</p>
        <Button onClick={onLogin} className="w-full bg-blue-600 hover:bg-blue-700">
          Iniciar sesión
        </Button>
      </div>
    </div>
  );
}