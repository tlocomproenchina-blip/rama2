// Utilidad para manejar operaciones offline
export async function queueOfflineOperation(url, method, body, headers = {}) {
  const db = await openDB();
  const operation = {
    url,
    method,
    body: JSON.stringify(body),
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    timestamp: Date.now()
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-operations'], 'readwrite');
    const store = transaction.objectStore('offline-operations');
    const request = store.add(operation);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openDB() {
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

// Wrapper para operaciones que soportan offline
export async function offlineCapableRequest(url, options = {}) {
  try {
    // Intentar hacer la petición normal
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    // Si falla y no hay internet, encolar
    if (!navigator.onLine) {
      await queueOfflineOperation(url, options.method || 'GET', options.body, options.headers);
      return { 
        ok: true, 
        offline: true,
        json: async () => ({ success: true, message: 'Operación guardada. Se sincronizará cuando haya conexión.' })
      };
    }
    throw error;
  }
}