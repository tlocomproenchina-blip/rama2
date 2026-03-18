import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardDrive, Database, Boxes, Cpu, RefreshCw } from "lucide-react";

function formatBytes(bytes) {
  if (bytes === 0 || bytes == null) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default function ResourceInspector() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    storageEstimate: null,
    localStorage: { keys: 0, sizeBytes: 0 },
    sessionStorage: { keys: 0, sizeBytes: 0 },
    indexedDB: { supported: false, databases: [] },
    caches: { supported: false, items: [] },
    memory: { supported: false, usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 },
  });

  const estimateLocalStorage = () => {
    try {
      const enc = new TextEncoder();
      let total = 0;
      const len = window.localStorage.length;
      for (let i = 0; i < len; i++) {
        const key = window.localStorage.key(i);
        const val = window.localStorage.getItem(key);
        total += (key ? enc.encode(key).length : 0) + (val ? enc.encode(val).length : 0);
      }
      return { keys: len, sizeBytes: total };
    } catch (e) {
      return { keys: 0, sizeBytes: 0 };
    }
  };

  const estimateSessionStorage = () => {
    try {
      const enc = new TextEncoder();
      let total = 0;
      const len = window.sessionStorage.length;
      for (let i = 0; i < len; i++) {
        const key = window.sessionStorage.key(i);
        const val = window.sessionStorage.getItem(key);
        total += (key ? enc.encode(key).length : 0) + (val ? enc.encode(val).length : 0);
      }
      return { keys: len, sizeBytes: total };
    } catch (e) {
      return { keys: 0, sizeBytes: 0 };
    }
  };

  const listIndexedDBs = async () => {
    try {
      if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
        return { supported: false, databases: [] };
      }
      const dbs = (await indexedDB.databases()) || [];
      return { supported: true, databases: dbs.map((d) => ({ name: d.name || "(sin nombre)", version: d.version || 0 })) };
    } catch {
      return { supported: false, databases: [] };
    }
  };

  const listCaches = async () => {
    try {
      if (!("caches" in window)) return { supported: false, items: [] };
      const names = await caches.keys();
      const items = [];
      for (const name of names) {
        try {
          const cache = await caches.open(name);
          const reqs = await cache.keys();
          items.push({ name, entries: reqs.length });
        } catch {
          items.push({ name, entries: 0 });
        }
      }
      return { supported: true, items };
    } catch {
      return { supported: false, items: [] };
    }
  };

  const getMemory = () => {
    const mem = (typeof performance !== "undefined" && performance && performance.memory) ? performance.memory : null;
    if (!mem) return { supported: false, usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
    return { supported: true, usedJSHeapSize: mem.usedJSHeapSize, totalJSHeapSize: mem.totalJSHeapSize, jsHeapSizeLimit: mem.jsHeapSizeLimit };
  };

  const getEstimate = async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        return est; // {usage, quota, usageDetails?}
      }
      return null;
    } catch {
      return null;
    }
  };

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const refresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getEstimate(),
        listIndexedDBs(),
        listCaches(),
      ]);
      const storageEstimate = results[0].status === 'fulfilled' ? results[0].value : null;
      const idbs = results[1].status === 'fulfilled' ? results[1].value : { supported: false, databases: [] };
      const cachesList = results[2].status === 'fulfilled' ? results[2].value : { supported: false, items: [] };
      const ls = estimateLocalStorage();
      const ss = estimateSessionStorage();
      const mem = getMemory();

      if (!isMounted.current) return;
      setData({
        storageEstimate,
        localStorage: ls,
        sessionStorage: ss,
        indexedDB: idbs,
        caches: cachesList,
        memory: mem,
      });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  return (
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Recursos del Navegador
        </CardTitle>
        <Button onClick={refresh} disabled={loading} variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Actualizando..." : "Actualizar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Almacenamiento total */}
        <div className="p-3 sm:p-4 rounded-lg border bg-slate-50">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-4 w-4 text-slate-600" />
            <h3 className="font-semibold text-slate-800">Almacenamiento (estimate)</h3>
          </div>
          {data.storageEstimate ? (
            <div className="text-sm text-slate-700 space-y-1">
              <p>Uso total: <span className="font-medium">{formatBytes(data.storageEstimate.usage || 0)}</span></p>
              <p>Cuota estimada: <span className="font-medium">{formatBytes(data.storageEstimate.quota || 0)}</span></p>
              {data.storageEstimate.quota ? (
                <div className="mt-2 h-2 w-full bg-white rounded overflow-hidden border">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${Math.min(100, Math.round(((data.storageEstimate.usage || 0) / (data.storageEstimate.quota || 1)) * 100))}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No disponible en este navegador.</p>
          )}
        </div>

        {/* localStorage / sessionStorage */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="p-3 sm:p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <Boxes className="h-4 w-4 text-slate-600" />
              <h4 className="font-medium text-slate-800">localStorage</h4>
            </div>
            <p className="text-sm text-slate-700">Claves: <span className="font-medium">{data.localStorage.keys}</span></p>
            <p className="text-sm text-slate-700">Tamaño aprox.: <span className="font-medium">{formatBytes(data.localStorage.sizeBytes)}</span></p>
          </div>
          <div className="p-3 sm:p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <Boxes className="h-4 w-4 text-slate-600" />
              <h4 className="font-medium text-slate-800">sessionStorage</h4>
            </div>
            <p className="text-sm text-slate-700">Claves: <span className="font-medium">{data.sessionStorage.keys}</span></p>
            <p className="text-sm text-slate-700">Tamaño aprox.: <span className="font-medium">{formatBytes(data.sessionStorage.sizeBytes)}</span></p>
          </div>
        </div>

        {/* IndexedDB */}
        <div className="p-3 sm:p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Database className="h-4 w-4 text-slate-600" />
            <h4 className="font-semibold text-slate-800">IndexedDB</h4>
          </div>
          {data.indexedDB.supported ? (
            data.indexedDB.databases.length > 0 ? (
              <ul className="text-sm text-slate-700 list-disc list-inside space-y-1 max-h-48 overflow-auto pr-1">
                {data.indexedDB.databases.map((db, idx) => (
                  <li key={`${db.name}-${db.version}-${idx}`}>
                    {db.name} <span className="text-slate-500">(v{db.version})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Sin bases de datos.</p>
            )
          ) : (
            <p className="text-sm text-slate-500">No disponible para listar en este navegador.</p>
          )}
        </div>

        {/* Cache Storage */}
        <div className="p-3 sm:p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Boxes className="h-4 w-4 text-slate-600" />
            <h4 className="font-semibold text-slate-800">Cache Storage</h4>
          </div>
          {data.caches.supported ? (
            data.caches.items.length > 0 ? (
              <ul className="text-sm text-slate-700 list-disc list-inside space-y-1 max-h-48 overflow-auto pr-1">
                {data.caches.items.map((c) => (
                  <li key={c.name}>
                    {c.name} <span className="text-slate-500">({c.entries} elementos)</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Sin cachés.</p>
            )
          ) : (
            <p className="text-sm text-slate-500">No disponible en este navegador.</p>
          )}
        </div>

        {/* Memoria JS */}
        <div className="p-3 sm:p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="h-4 w-4 text-slate-600" />
            <h4 className="font-semibold text-slate-800">Memoria JS</h4>
          </div>
          {data.memory.supported ? (
            <div className="text-sm text-slate-700 space-y-1">
              <p>Usada: <span className="font-medium">{formatBytes(data.memory.usedJSHeapSize)}</span></p>
              <p>Total: <span className="font-medium">{formatBytes(data.memory.totalJSHeapSize)}</span></p>
              <p>Límite: <span className="font-medium">{formatBytes(data.memory.jsHeapSizeLimit)}</span></p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No disponible en este navegador.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}