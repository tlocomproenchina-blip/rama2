import React, { useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

// Precalienta en caché las consultas más usadas para transiciones rápidas
export default function PagePrefetcher({ user, currentPageName }) {
  // Prefetch inicial al tener usuario
  useEffect(() => {
    if (!user) return;

    const prefetch = (fn) => {
      try { base44.enqueue(fn, 'LOW', 'read'); } catch (_) {}
    };

    if (user.role === 'admin') {
      prefetch(async () => base44.entities.Invoice.filter({}, '-updated_date', 20));
      prefetch(async () => base44.entities.ShippingProvider.filter({ is_active: true }, '-updated_date', 20));
      prefetch(async () => base44.entities.Package.filter({}, '-updated_date', 20));
    } else {
      prefetch(async () => base44.entities.Invoice.filter({ client_email: user.email }, '-updated_date', 20));
      prefetch(async () => base44.entities.Package.filter({ client_email: user.email }, '-updated_date', 20));
    }
  }, [user?.email, user?.role]);

  // Predicción simple: al estar en una de las tres vistas, calienta las otras dos
  useEffect(() => {
    if (!user) return;
    const prefetch = (fn) => { try { base44.enqueue(fn, 'LOW', 'read'); } catch (_) {} };

    if (user.role === 'admin') {
      if (currentPageName === 'AdminInvoices') {
        prefetch(async () => base44.entities.Package.filter({}, '-updated_date', 20));
        prefetch(async () => base44.entities.ShippingProvider.filter({ is_active: true }, '-updated_date', 20));
      } else if (currentPageName === 'AdminProviders') {
        prefetch(async () => base44.entities.Invoice.filter({}, '-updated_date', 20));
        prefetch(async () => base44.entities.Package.filter({}, '-updated_date', 20));
      } else if (currentPageName === 'AdminPackages') {
        prefetch(async () => base44.entities.Invoice.filter({}, '-updated_date', 20));
        prefetch(async () => base44.entities.ShippingProvider.filter({ is_active: true }, '-updated_date', 20));
      }
    } else {
      if (currentPageName === 'MyInvoices') {
        prefetch(async () => base44.entities.Package.filter({ client_email: user.email }, '-updated_date', 20));
      }
      if (currentPageName === 'MyPackages') {
        prefetch(async () => base44.entities.Invoice.filter({ client_email: user.email }, '-updated_date', 20));
      }
    }
  }, [currentPageName, user?.email, user?.role]);

  return null;
}