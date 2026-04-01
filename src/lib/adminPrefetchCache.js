/**
 * Admin Prefetch Cache
 * Pre-loads heavy data (clients, packages) in background for admin pages.
 * Data is available instantly when admin navigates to AdminClients.
 */

import { base44 as base44Direct } from '@/api/base44Client';

const PACKAGE_PAGE_SIZE = 1000;

const cache = {
  clients: null,
  packages: null,
  packagesCount: null,
  loading: false,
  lastFetch: 0,
  listeners: new Set(),
};

const STALE_MS = 5 * 60 * 1000; // 5 minutes

function notifyListeners() {
  cache.listeners.forEach(fn => fn({ ...cache }));
}

export function subscribeAdminPrefetch(listener) {
  cache.listeners.add(listener);
  return () => cache.listeners.delete(listener);
}

export function getAdminPrefetchData() {
  return {
    clients: cache.clients,
    packagesCount: cache.packagesCount,
    loading: cache.loading,
    lastFetch: cache.lastFetch,
  };
}

export async function prefetchAdminClients(force = false) {
  const now = Date.now();
  // Skip if already loading or fresh data exists
  if (cache.loading) return;
  if (!force && cache.clients && (now - cache.lastFetch) < STALE_MS) return;

  cache.loading = true;
  notifyListeners();

  try {
    const clientsRes = await base44Direct.functions.invoke('listClientsForSupport', {});
    cache.clients = Array.isArray(clientsRes?.data) ? clientsRes.data : [];

    const counts = {};
    let skip = 0;
    let batch = [];

    do {
      batch = await base44Direct.entities.Package.list('-created_date', PACKAGE_PAGE_SIZE, skip);
      batch.forEach((pkg) => {
        if (!pkg?.client_email) return;
        counts[pkg.client_email] = (counts[pkg.client_email] || 0) + 1;
      });
      skip += PACKAGE_PAGE_SIZE;
    } while (batch.length === PACKAGE_PAGE_SIZE);

    cache.packagesCount = counts;
    cache.lastFetch = Date.now();
  } catch (err) {
    console.error('[AdminPrefetch] Error:', err);
  } finally {
    cache.loading = false;
    notifyListeners();
  }
}

export function invalidateAdminClientsCache() {
  cache.clients = null;
  cache.packagesCount = null;
  cache.lastFetch = 0;
}