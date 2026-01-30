import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { AlertCircle, Package, Truck, DollarSign } from 'lucide-react';

export default function AdminNotificationCenter({ user }) {
  const [activeNotifications, setActiveNotifications] = useState([]);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    // Subscribe to Package changes
    const unsubPackages = base44.entities.Package.subscribe((event) => {
      const messages = {
        create: `📦 Nuevo paquete: ${event.data?.tracking_number}`,
        update: `✏️ Paquete actualizado: ${event.data?.tracking_number} - Estado: ${event.data?.status}`,
        delete: `🗑️ Paquete eliminado: ${event.data?.tracking_number}`
      };
      
      const message = messages[event.type];
      if (message) {
        toast.success(message, { duration: 6000 });
        playSound();
        addNotification('Package', event.type, message, event.data);
      }
    });

    // Subscribe to Consolidation changes
    const unsubConsolidations = base44.entities.Consolidation.subscribe((event) => {
      const messages = {
        create: `📦 Nueva consolidación: ${event.data?.consolidation_tracking}`,
        update: `✏️ Consolidación actualizada: ${event.data?.consolidation_tracking} - Estado: ${event.data?.status}`,
        delete: `🗑️ Consolidación eliminada: ${event.data?.consolidation_tracking}`
      };
      
      const message = messages[event.type];
      if (message) {
        toast.info(message, { duration: 6000 });
        playSound();
        addNotification('Consolidation', event.type, message, event.data);
      }
    });

    // Subscribe to ConsolidationRequest changes
    const unsubRequests = base44.entities.ConsolidationRequest.subscribe((event) => {
      const messages = {
        create: `🛒 Nueva solicitud de ${event.data?.client_email}`,
        update: `🛒 Solicitud actualizada: ${event.data?.client_email} - Estado: ${event.data?.status}`,
        delete: `🗑️ Solicitud cancelada de ${event.data?.client_email}`
      };
      
      const message = messages[event.type];
      if (message) {
        toast.warning(message, { duration: 6000 });
        playSound();
        addNotification('ConsolidationRequest', event.type, message, event.data);
      }
    });

    // Subscribe to Invoice changes
    const unsubInvoices = base44.entities.Invoice.subscribe((event) => {
      const messages = {
        create: `💵 Nueva factura: ${event.data?.invoice_number}`,
        update: `💵 Factura actualizada: ${event.data?.invoice_number} - Estado: ${event.data?.status}`,
        delete: `🗑️ Factura eliminada: ${event.data?.invoice_number}`
      };
      
      const message = messages[event.type];
      if (message) {
        toast.success(message, { duration: 6000 });
        playSound();
        addNotification('Invoice', event.type, message, event.data);
      }
    });

    return () => {
      unsubPackages();
      unsubConsolidations();
      unsubRequests();
      unsubInvoices();
    };
  }, [user]);

  const addNotification = (entity, type, message, data) => {
    const notification = {
      id: `${Date.now()}-${Math.random()}`,
      entity,
      type,
      message,
      timestamp: new Date(),
      data
    };
    
    setActiveNotifications(prev => [notification, ...prev].slice(0, 10));
    
    // Remove after 10 seconds
    setTimeout(() => {
      setActiveNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 10000);
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