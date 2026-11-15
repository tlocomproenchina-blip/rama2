import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import PasswordGate from '@/components/common/PasswordGate';
import WholesalerPortalView from '@/components/wholesaler/portal/WholesalerPortalView';

// Portal privado de un mayorista por enlace: solo sus clientes, trackings y facturas.
export default function WholesalerPortal() {
  const { token } = useParams();
  const storageKey = `wholesaler-portal-pw:${token}`;
  const [data, setData] = useState(null);
  const [gate, setGate] = useState(null);
  const [invalid, setInvalid] = useState(false);

  const load = (password) => base44.functions.invoke('wholesalerPortal', { action: 'access', token, password })
    .then((res) => { sessionStorage.setItem(storageKey, password); setGate(null); setData(res.data); })
    .catch((err) => {
      const d = err?.response?.data;
      if (d?.password_required) { sessionStorage.removeItem(storageKey); setGate({ error: password ? d.error : '', loading: false }); }
      else setInvalid(true);
    });

  useEffect(() => { load(sessionStorage.getItem(storageKey) || ''); }, [token]);

  if (invalid) return <p className="py-20 text-center text-muted-foreground">Este enlace no es válido o fue reemplazado.</p>;
  if (gate) return <PasswordGate title="Portal de mayoristas" error={gate.error} loading={gate.loading} onSubmit={(pw) => { setGate({ error: '', loading: true }); load(pw); }} />;
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  return <WholesalerPortalView data={data} />;
}