import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function OfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOps, setPendingOps] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Intentar sincronizar cuando vuelve la conexión
      if ('serviceWorker' in navigator && 'sync' in self.registration) {
        navigator.serviceWorker.ready.then((registration) => {
          return registration.sync.register('sync-offline-operations');
        });
      } else {
        // Fallback: sincronizar manualmente
        syncOfflineOperations();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cargar operaciones pendientes
    loadPendingOperations();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadPendingOperations = async () => {
    const db = await openDB();
    const ops = await getAllOperations(db);
    setPendingOps(ops.length);
  };

  const syncOfflineOperations = async () => {
    const db = await openDB();
    const operations = await getAllOperations(db);
    
    for (const operation of operations) {
      try {
        const response = await fetch(operation.url, {
          method: operation.method,
          headers: operation.headers,
          body: operation.body
        });

        if (response.ok) {
          await deleteOperation(db, operation.id);
          setPendingOps(prev => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error('Error syncing:', error);
      }
    }
  };

  if (isOnline && pendingOps === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className={`p-4 shadow-lg border-2 ${
        isOnline ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'
      }`}>
        <div className="flex items-center gap-3">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-amber-600" />
          )}
          <div className="flex-1">
            <p className={`font-medium text-sm ${
              isOnline ? 'text-green-800' : 'text-amber-800'
            }`}>
              {isOnline ? 'Conectado - Sincronizando...' : 'Sin conexión'}
            </p>
            {pendingOps > 0 && (
              <p className="text-xs text-slate-600">
                {pendingOps} operación(es) pendiente(s)
              </p>
            )}
          </div>
          {pendingOps > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {pendingOps}
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}

// Funciones de base de datos
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline-operations')) {
        db.createObjectStore('offline-operations', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAllOperations(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-operations'], 'readonly');
    const store = transaction.objectStore('offline-operations');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteOperation(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-operations'], 'readwrite');
    const store = transaction.objectStore('offline-operations');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}