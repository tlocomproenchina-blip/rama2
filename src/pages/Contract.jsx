import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Loader2 } from 'lucide-react';

export default function Contract() {
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const configs = await base44.entities.PrivacyConfig.filter({ config_key: 'main' });
        if (configs.length > 0) {
          setTerms(configs[0].terms_of_service || '');
        }
      } catch (error) {
        console.error('Error loading terms:', error);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 rounded-xl">
          <FileText className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contrato</h1>
          <p className="text-slate-500">Términos de servicio</p>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          {terms ? (
            <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
              {terms}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-16 w-16 text-slate-300 mb-4" />
              <p className="text-slate-500 text-center">
                Aún no se han publicado los términos de servicio.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}