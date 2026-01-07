import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Loader2 } from 'lucide-react';

export default function Home({ user }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'admin' || user.role === 'employee') {
        navigate(createPageUrl('AdminDashboard'));
      } else {
        navigate(createPageUrl('Dashboard'));
      }
    }
  }, [user, navigate]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        <p className="mt-4 text-slate-600">Redirigiendo...</p>
      </div>
    </div>
  );
}