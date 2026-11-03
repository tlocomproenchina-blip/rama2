import React, { lazy, Suspense, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CrmSupervisionList from './CrmSupervisionList';
import CrmTagFilter from './CrmTagFilter';
import CrmAgendaList from './CrmAgendaList';
import CrmDepartmentBoard from './departments/CrmDepartmentBoard';
import useSupportDepartments from '@/hooks/useSupportDepartments';

const AdminSupportTickets = lazy(() => import('@/pages/AdminSupportTickets'));
const loader = <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>;

// Bandeja de trabajo: Agenda, Casos (lista única de tickets con datos del CRM),
// Departamentos y Supervisión. Cualquier caso se abre en la misma ficha.
export default function CrmInbox({ inbox, onOpen, user }) {
  const { data, loading } = inbox;
  const deps = useSupportDepartments(user);
  const catalog = data?.catalog || [];
  const crm = useMemo(() => ({
    casesById: Object.fromEntries((data?.cases || []).map((c) => [c.id, c])),
    profiles: data?.profiles || {},
    tagsByEmail: data?.tags_by_email || {},
    catalog,
    filterActive: !!inbox.tag || !!inbox.mine,
  }), [data, inbox.tag, inbox.mine]);

  return (
    <div className="space-y-3">
      <CrmTagFilter value={inbox.tag} onChange={inbox.setTag} catalog={catalog} mine={inbox.mine} onMineChange={inbox.setMine} />
      <Tabs defaultValue="agenda">
        <TabsList>
          <TabsTrigger value="agenda">Agenda ({data?.agenda?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="casos">Casos ({data?.cases?.length ?? 0} abiertos)</TabsTrigger>
          <TabsTrigger value="departamentos">Departamentos ({deps.departments.length})</TabsTrigger>
          <TabsTrigger value="supervision">Supervisión</TabsTrigger>
        </TabsList>
        <TabsContent value="casos">
          <Suspense fallback={loader}>
            <AdminSupportTickets user={user} embedded crm={crm} onOpenCase={(t) => onOpen(t.client_email, t.id)} />
          </Suspense>
        </TabsContent>
        <TabsContent value="supervision">
          <CrmSupervisionList onOpen={onOpen} />
        </TabsContent>
        {loading && !data ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando bandeja…</p>
        ) : (
          <>
            <TabsContent value="agenda">
              <CrmAgendaList agenda={data?.agenda} tagsByEmail={data?.tags_by_email} catalog={catalog} onOpen={onOpen} onDone={(row) => inbox.markDone(row, user)} />
            </TabsContent>
            <TabsContent value="departamentos">
              <CrmDepartmentBoard
                cases={data?.cases}
                profiles={data?.profiles}
                deps={deps}
                onMove={(id, dep) => inbox.moveCase(id, dep, user)}
                onOpen={onOpen}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}