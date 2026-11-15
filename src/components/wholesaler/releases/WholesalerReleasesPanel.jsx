import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import ReleaseForm from './ReleaseForm';
import ReleaseCard from './ReleaseCard';
import ReleasePublishDialog from './ReleasePublishDialog';

// Versiones de la app principal que se distribuyen a las apps de los mayoristas.
// Flujo: borrador → validada → publicada a los mayoristas elegidos. Cada app
// mayorista consulta sus versiones con su clave y reporta si las aplicó.
export default function WholesalerReleasesPanel() {
  const [data, setData] = useState(null);
  const [publishing, setPublishing] = useState(null);

  const load = useCallback(async () => {
    const [releases, statuses, connections] = await Promise.all([
      base44.entities.AppRelease.list('-created_date', 50),
      base44.entities.WholesalerReleaseStatus.list('-created_date', 500),
      base44.entities.WholesalerSync.list('-created_date', 100),
    ]);
    setData({ releases, statuses, connections });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const validate = async (r) => {
    const me = await base44.auth.me();
    await base44.entities.AppRelease.update(r.id, { status: 'validada', validated_by: me.email, validated_date: new Date().toISOString() });
    load();
  };
  const remove = async (r) => { await base44.entities.AppRelease.delete(r.id); load(); };

  return (
    <div className="space-y-4">
      <ReleaseForm onCreated={load} />
      {data.releases.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay versiones.</p>}
      {data.releases.map((r) => (
        <ReleaseCard key={r.id} release={r} statuses={data.statuses.filter((s) => s.release_id === r.id)}
          onValidate={() => validate(r)} onPublish={() => setPublishing(r)} onDelete={() => remove(r)} />
      ))}
      <ReleasePublishDialog release={publishing} connections={data.connections}
        onClose={() => setPublishing(null)} onDone={() => { setPublishing(null); load(); }} />
    </div>
  );
}