import React from 'react';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CrmTagFilter from './CrmTagFilter';
import CrmAgendaList from './CrmAgendaList';
import CrmCasesList from './CrmCasesList';

// Bandeja de trabajo: pestañas Agenda y Casos con el filtro por etiqueta.
export default function CrmInbox({ inbox, onOpen, user }) {
  const { data, loading } = inbox;
  const catalog = data?.catalog || [];

  return (
    <div className="space-y-3">
      <CrmTagFilter value={inbox.tag} onChange={inbox.setTag} catalog={catalog} mine={inbox.mine} onMineChange={inbox.setMine} />
      <Tabs defaultValue="agenda">
        <TabsList>
          <TabsTrigger value="agenda">Agenda ({data?.agenda?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="casos">Casos ({data?.cases?.length ?? 0})</TabsTrigger>
        </TabsList>
        {loading && !data ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando bandeja…</p>
        ) : (
          <>
            <TabsContent value="agenda">
              <CrmAgendaList agenda={data?.agenda} tagsByEmail={data?.tags_by_email} catalog={catalog} onOpen={onOpen} onDone={(row) => inbox.markDone(row, user)} />
            </TabsContent>
            <TabsContent value="casos">
              <CrmCasesList cases={data?.cases} profiles={data?.profiles} tagsByEmail={data?.tags_by_email} catalog={catalog} onOpen={onOpen} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}