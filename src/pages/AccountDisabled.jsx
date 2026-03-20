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
    <div className="flex min-h-[75vh] items-center justify-center">
      <Card className="w-full max-w-2xl overflow-hidden border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-premium">
        <CardHeader className="items-center text-center pb-2">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">Cuenta desactivada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-center text-slate-300">
          <p className="mx-auto max-w-xl text-sm md:text-base">Tu cuenta fue desactivada por el equipo de soporte. Si crees que se trata de un error, por favor comunícate con nosotros para revisarlo.</p>
          <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Mientras tanto, puedes cerrar sesión de forma segura desde aquí.
          </div>
          <div className="flex justify-center">
            <Button onClick={handleLogout} className="bg-white text-slate-900 hover:bg-slate-100">Cerrar sesión</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}