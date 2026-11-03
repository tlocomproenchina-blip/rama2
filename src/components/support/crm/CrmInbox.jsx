import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import CrmSupervisionList from './CrmSupervisionList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CrmTagFilter from './CrmTagFilter';
import CrmAgendaList from './CrmAgendaList';
import CrmCasesList from './CrmCasesList';
import CrmDepartmentBoard from './departments/CrmDepartmentBoard';
import useSupportDepartments from '@/hooks/useSupportDepartments';

const AdminSupportTickets = lazy(() => import('@/pages/AdminSupportTickets'));
const loader = <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>;

// Bandeja de trabajo: Agenda, Casos, Departamentos, Supervisión y Todos los tickets.
// Cualquier caso se abre en la misma ficha (conversación, asistente y supervisión).
export default function CrmInbox({ inbox, onOpen, user }) {
  const { data, loading } = inbox;
  const deps = useSupportDepartments(user);
  const catalog = data?.catalog || [];

  return (
    <div className="space-y-3">
      <CrmTagFilter value={inbox.tag} onChange={inbox.setTag} catalog={catalog} mine={inbox.mine} onMineChange={inbox.setMine} />
      <Tabs defaultValue="agenda">
        <TabsList>
          <TabsTrigger value="agenda">Agenda ({data?.agenda?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="casos">Casos ({data?.cases?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="departamentos">Departamentos ({deps.departments.length})</TabsTrigger>
          <TabsTrigger value="supervision">Supervisión</TabsTrigger>
          <TabsTrigger value="tickets">Todos los tickets</TabsTrigger>
        </TabsList>
        <TabsContent value="supervision">
          <CrmSupervisionList onOpen={onOpen} />
        </TabsContent>
        <TabsContent value="tickets">
          <Suspense fallback={loader}>
            <AdminSupportTickets user={user} embedded onOpenCase={(t) => onOpen(t.client_email, t.id)} />
          </Suspense>
        </TabsContent>
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