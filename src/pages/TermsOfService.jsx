import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function TermsOfService() {
  const [privacyCfg, setPrivacyCfg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const rows = await base44.entities.PrivacyConfig.filter({ config_key: 'main' }, '-updated_date', 1);
        setPrivacyCfg(rows && rows[0] ? rows[0] : null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const content = privacyCfg?.terms_of_service || '';
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(content || '');

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando términos...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-slate-900">Términos de servicio</CardTitle>
          {privacyCfg?.updated_date && (
            <p className="text-sm text-slate-500">Actualizado: {new Date(privacyCfg.updated_date).toLocaleDateString()}</p>
          )}
        </CardHeader>
        <CardContent className="prose prose-slate max-w-none">
          {content ? (
            isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              <ReactMarkdown>{content}</ReactMarkdown>
            )
          ) : (
            <p className="text-slate-600">Aún no se han configurado los términos de servicio.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}