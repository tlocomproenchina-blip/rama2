import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ApprovalAlertCard({ pendingApprovalCount }) {
  if (!pendingApprovalCount) return null;

  return (
    <Card className="border border-blue-200 bg-blue-50/90 shadow-card">
      <CardContent className="p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3 lg:gap-4 flex-1">
            <div className="p-2.5 lg:p-3 bg-blue-200 rounded-lg lg:rounded-xl flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 lg:h-6 lg:w-6 text-blue-700" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-blue-900 text-sm lg:text-lg">¡Consolidaciones listas para aprobar!</h3>
              <p className="text-blue-700 text-xs lg:text-base mt-1">
                Tienes {pendingApprovalCount} consolidación(es) esperando tu aprobación de despacho
              </p>
            </div>
          </div>
          <Link to={createPageUrl('MyConsolidations')} className="w-full lg:w-auto">
            <Button className="bg-blue-600 hover:bg-blue-700 w-full lg:w-auto">Ver Consolidaciones</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}