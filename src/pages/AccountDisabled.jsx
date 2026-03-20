import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

export default function AccountDisabled({ user }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate(createPageUrl('AdminDashboard'));
      return;
    }

    if (user && user.is_active !== false) {
      navigate(createPageUrl('Dashboard'));
      return;
    }

    if (!user) {
      navigate(createPageUrl('Home'));
    }
  }, [user, navigate]);

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (!user || user.is_active !== false) {
    return null;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="max-w-lg w-full border-0 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 p-3 rounded-full bg-red-100 w-14 h-14 flex items-center justify-center">
            <Lock className="h-7 w-7 text-red-600" />
          </div>
          <CardTitle className="text-xl">Cuenta desactivada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-slate-600">
          <p>Tu cuenta ha sido desactivada por el equipo de soporte. Si crees que es un error, por favor contáctanos.</p>
          <div className="flex justify-center">
            <Button onClick={handleLogout} className="bg-blue-600 hover:bg-blue-700">Cerrar sesión</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}