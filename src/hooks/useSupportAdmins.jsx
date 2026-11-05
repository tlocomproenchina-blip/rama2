import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Cuentas del equipo que pueden ser responsables de un caso.
export default function useSupportAdmins() {
  const [admins, setAdmins] = useState([]);
  useEffect(() => {
    base44.functions.invoke('listAdmins', { kind: 'all', limit: 500 })
      .then((r) => setAdmins(r?.data?.admins || []))
      .catch(() => setAdmins([]));
  }, []);
  return admins;
}