import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Download, RefreshCw, FileCode } from 'lucide-react';
import { PUBLIC_BASE_URL } from '@/lib/publicLinks';

export default function Sitemap() {
  const [xml, setXml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [urlCount, setUrlCount] = useState(0);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = PUBLIC_BASE_URL;
      const res = await base44.functions.invoke('generateSitemap', { baseUrl });
      const xmlContent = typeof res.data === 'string' ? res.data : res.data?.sitemap || '';
      setXml(xmlContent);
      setUrlCount((xmlContent.match(/<url>/g) || []).length);
    } catch (err) {
      setError(err.message || 'Error generando sitemap');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(xml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileCode className="h-6 w-6 text-primary" />
          Sitemap.xml
        </h1>
        <p className="text-slate-500 mt-1">
          Generación automática del sitemap para buscadores. Incluye páginas públicas y todos los artículos del blog publicados.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={generate} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Generando...' : 'Regenerar'}
        </Button>
        <Button onClick={handleCopy} disabled={!xml} variant="outline">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copiado' : 'Copiar XML'}
        </Button>
        <Button onClick={handleDownload} disabled={!xml}>
          <Download className="h-4 w-4" />
          Descargar
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 text-red-700 text-sm">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Vista previa del sitemap</span>
            {urlCount > 0 && (
              <span className="text-sm font-normal text-slate-500">{urlCount} URLs</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-slate-400 text-sm">Cargando...</div>
          ) : (
            <pre className="text-xs text-slate-700 bg-slate-50 rounded-lg p-4 overflow-x-auto max-h-[60vh] whitespace-pre-wrap break-all">
              {xml}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}