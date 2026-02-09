import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Loader2,
  Download 
} from 'lucide-react';

export default function TestingDashboard() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const runTests = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('runApplicationTests', {});
      setReport(response.data);
    } catch (error) {
      console.error('Error running tests:', error);
      setReport({
        error: error.message,
        timestamp: new Date().toISOString(),
        status: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `testing-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    if (status === 'passed') return 'bg-green-100 text-green-800';
    if (status === 'warning') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusIcon = (status) => {
    if (status === 'passed') return <CheckCircle className="w-5 h-5" />;
    if (status === 'warning') return <AlertCircle className="w-5 h-5" />;
    return <XCircle className="w-5 h-5" />;
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-red-900">Acceso Denegado</h2>
          <p className="text-red-700 mt-2">Solo los administradores pueden acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard de Testing</h1>
      <p className="text-slate-600">Prueba exhaustiva: backend admin + RLS, sincronización, integridad de datos</p>
    </div>

      {!report ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Card className="w-full max-w-md border-2 border-dashed">
            <CardContent className="p-8 text-center">
              <Play className="w-16 h-16 text-indigo-600 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Ejecutar Pruebas</h3>
              <p className="text-slate-600 mb-6">Backend admin + RLS, sincronización cliente-admin, integridad de datos</p>
              <Button 
                onClick={runTests}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-10"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ejecutando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Iniciar Tests
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : report.error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <XCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Error en las Pruebas</h3>
                <p className="text-red-700 font-mono text-sm">{report.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Header Report */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Resultados de Pruebas</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {new Date(report.timestamp).toLocaleString('es-ES')}
                  </p>
                </div>
                <Badge className={`${getStatusColor(report.status)} h-fit flex items-center gap-2 px-3 py-1`}>
                  {getStatusIcon(report.status)}
                  {report.status === 'passed' ? 'Pasadas' : report.status === 'warning' ? 'Advertencias' : 'Fallos'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-600">Total</p>
                  <p className="text-2xl font-bold text-slate-900">{report.totalTests}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600">Pasadas</p>
                  <p className="text-2xl font-bold text-green-700">{report.passed}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-red-600">Fallos</p>
                  <p className="text-2xl font-bold text-red-700">{report.failed}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-sm text-yellow-600">Advertencias</p>
                  <p className="text-2xl font-bold text-yellow-700">{report.warnings.length}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={runTests}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Ejecutando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Ejecutar de Nuevo
                    </>
                  )}
                </Button>
                <Button 
                  onClick={downloadReport}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar Informe
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Passed Tests */}
          {report.passedTests.length > 0 && (
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  Pruebas Exitosas ({report.passed})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.passedTests.map((test, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-slate-700">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="font-mono text-sm">{test}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {report.errors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <XCircle className="w-5 h-5" />
                  Errores Encontrados ({report.failed})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.errors.map((error, idx) => (
                  <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-mono font-semibold text-red-900 text-sm">{error.test}</span>
                      <Badge className={error.severity === 'critical' ? 'bg-red-600' : 'bg-orange-600'}>
                        {error.severity === 'critical' ? 'Crítico' : 'Advertencia'}
                      </Badge>
                    </div>
                    <p className="text-red-700 text-sm font-mono">{error.error}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Warnings */}
          {report.warnings.length > 0 && (
            <Card className="border-yellow-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-700">
                  <AlertCircle className="w-5 h-5" />
                  Advertencias ({report.warnings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.warnings.map((warning, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-700">
                      <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{warning}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}