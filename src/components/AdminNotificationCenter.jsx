import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AdminNotificationCenter({ user }) {
  useEffect(() => {
    if (user?.role !== 'admin') return;

    // Subscribe to Package changes
    const unsubPackages = base44.entities.Package.subscribe((event) => {
      const iconMap = {
        create: 'package',
        update: 'truck',
        delete: 'alert'
      };

      const titleMap = {
        create: `📦 Nuevo paquete: ${event.data?.tracking_number}`,
        update: `🚚 Paquete actualizado: ${event.data?.tracking_number}`,
        delete: `🗑️ Paquete eliminado: ${event.data?.tracking_number}`
      };

      saveNotification(
        titleMap[event.type],
        `Estado: ${event.data?.status}`,
        'package',
        iconMap[event.type],
        event.data?.id
      );
    });

    // Subscribe to Consolidation changes
    const unsubConsolidations = base44.entities.Consolidation.subscribe((event) => {
      const iconMap = {
        create: 'package',
        update: 'truck',
        delete: 'alert'
      };

      const titleMap = {
        create: `📦 Nueva consolidación: ${event.data?.consolidation_tracking}`,
        update: `🚚 Consolidación actualizada: ${event.data?.consolidation_tracking}`,
        delete: `🗑️ Consolidación eliminada: ${event.data?.consolidation_tracking}`
      };

      saveNotification(
        titleMap[event.type],
        `Estado: ${event.data?.status}`,
        'consolidation',
        iconMap[event.type],
        event.data?.id
      );
    });

    // Subscribe to ConsolidationRequest changes
    const unsubRequests = base44.entities.ConsolidationRequest.subscribe((event) => {
      const iconMap = {
        create: 'package',
        update: 'truck',
        delete: 'alert'
      };

      const titleMap = {
        create: `🛒 Nueva solicitud de ${event.data?.client_email}`,
        update: `✏️ Solicitud actualizada de ${event.data?.client_email}`,
        delete: `🗑️ Solicitud cancelada de ${event.data?.client_email}`
      };

      saveNotification(
        titleMap[event.type],
        `Estado: ${event.data?.status}`,
        'general',
        iconMap[event.type],
        event.data?.id
      );
    });

    // Subscribe to Invoice changes
    const unsubInvoices = base44.entities.Invoice.subscribe((event) => {
      const iconMap = {
        create: 'dollar',
        update: 'dollar',
        delete: 'alert'
      };

      const titleMap = {
        create: `💵 Nueva factura: ${event.data?.invoice_number}`,
        update: `💵 Factura actualizada: ${event.data?.invoice_number}`,
        delete: `🗑️ Factura eliminada: ${event.data?.invoice_number}`
      };

      saveNotification(
        titleMap[event.type],
        `Estado: ${event.data?.status}`,
        'payment',
        iconMap[event.type],
        event.data?.id
      );
    });

    return () => {
      unsubPackages();
      unsubConsolidations();
      unsubRequests();
      unsubInvoices();
    };
  }, [user]);

  const saveNotification = async (title, message, type, icon, referenceId) => {
    try {
      // Save notification only for current user
      if (user?.email) {
        await base44.entities.Notification.create({
          user_email: user.email,
          title,
          message,
          type,
          icon,
          reference_id: referenceId
        });
      }

      // Play sound
      playSound();
    } catch (error) {
      console.error('Error saving notification:', error);
    }
  };

  const playSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 1000;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Audio context not available');
    }
  };

  if (user?.role !== 'admin') return null;

  return null;
}