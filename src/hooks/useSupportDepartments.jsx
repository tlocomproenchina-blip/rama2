import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Departamentos del CRM a los que se arrastran los casos.
export default function useSupportDepartments(user) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const rows = await base44.entities.SupportDepartment.list('sort_order', 100);
    setDepartments(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // En vivo: un departamento creado o eliminado en otra pantalla aparece aquí también.
  useEffect(() => base44.entities.SupportDepartment.subscribe(() => load()), [load]);

  const create = useCallback(async ({ name, color }) => {
    await base44.entities.SupportDepartment.create({
      name: name.trim(),
      color,
      sort_order: departments.length,
      created_by_email: user?.email || '',
    });
    toast.success('Departamento creado');
    await load();
  }, [departments.length, user?.email, load]);

  const remove = useCallback(async (dep) => {
    await base44.entities.SupportDepartment.delete(dep.id);
    toast.success(`Departamento ${dep.name} eliminado`);
    await load();
  }, [load]);

  return { departments, loading, create, remove };
}