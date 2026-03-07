import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Register() {
  const navigate = useNavigate();

  return (
    <div className="max-w-xl mx-auto">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-slate-900">Registrarse</CardTitle>
        </CardHeader>
        <CardContent className="space-x-3 space-y-3">
          <p className="text-slate-600">Crea tu cuenta para empezar a pre-alertar y hacer seguimiento de tus envíos.</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate(-1)}>Atrás</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => base44.auth.redirectToLogin()}>Iniciar registro</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}