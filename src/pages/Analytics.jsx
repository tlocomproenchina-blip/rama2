import React, { Suspense } from "react";
import AdvancedAnalytics from "@/components/dashboard/AdvancedAnalytics.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Analytics({ user }) {
  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8 w-full">
      <Card className="border-0 shadow-lg">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg font-semibold text-slate-800">
            Analítica de Envíos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 md:p-6">
            <Suspense fallback={<div className="h-64 bg-slate-200 rounded-lg animate-pulse" /> }>
              <AdvancedAnalytics userEmail={user?.email} />
            </Suspense>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}