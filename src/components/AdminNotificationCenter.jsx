import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AdminNotificationCenter({ user }) {
  useEffect(() => {
    if (!user?.email || user?.role !== 'admin') return;

    // Escuchar todas las notificaciones nuevas para admins en vivo
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      const data = event?.data;
      if (!data) return;

      // Si la notificación está dirigida a este admin, mostrar toast
      if (event.type === 'create' && data.user_email === user.email) {
        toast.message(data.title || 'Nueva notificación', { description: data.message });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user]);

  // Escuchar actividades directas del cliente (fallback por si aún no existe la notificación)
  useEffect(() => {
    if (!user?.email || user?.role !== 'admin') return;

    const unsubs = [];

    // Tickets de soporte (mensajes del cliente)
    unsubs.push(
      base44.entities.SupportTicket.subscribe((event) => {
        const d = event?.data;
        if (!d) return;

        if (event.type === 'create') {
          // Crear registro para que la campana muestre contador
          saveNotification(
            'Nuevo ticket de soporte',
            d.subject || 'Nuevo mensaje de soporte',
            'system',
            'alert',
            d.id || d.ticket_number || 'support'
          );
        } else if (event.type === 'update') {
          // Detectar si el ÚLTIMO mensaje lo envió el cliente
          const lastMsg = Array.isArray(d.messages) && d.messages.length > 0 ? d.messages[d.messages.length - 1] : null;
          if (lastMsg && lastMsg.is_admin === false && lastMsg.sender_email !== user.email) {
            saveNotification(
              'Nuevo mensaje del cliente',
              d.subject || 'Actualización en soporte',
              'system',
              'alert',
              d.id || d.ticket_number || 'support'
            );
          }
        }
      })
    );

    // Solicitudes de consolidación creadas/actualizadas por clientes
    unsubs.push(
      base44.entities.ConsolidationRequest.subscribe((event) => {
        const d = event?.data;
        if (!d) return;
        const fromClient = d.created_by && d.created_by !== user.email;
        if ((event.type === 'create' || event.type === 'update') && fromClient) {
          saveNotification(
            'Solicitud de consolidación',
            `${d.client_email || 'Cliente'} (${event.type === 'create' ? 'nueva' : 'actualizada'})`,
            'request',
            'alert',
            d.id || 'consolidation_request'
          );
        }
      })
    );

    // Prealertas/paquetes registrados por clientes
    unsubs.push(
      base44.entities.Package.subscribe((event) => {
        const d = event?.data;
        if (!d) return;
        const fromClient = d.created_by && d.created_by !== user.email;
        if (event.type === 'create' && fromClient) {
          saveNotification(
            'Nuevo paquete prealertado',
            d.tracking_number || 'Sin tracking',
            'package',
            'package',
            d.id || d.tracking_number || 'package'
          );
        }
      })
    );

    // Actualizaciones en consolidaciones (pagos, estado, etc.)
    unsubs.push(
      base44.entities.Consolidation.subscribe((event) => {
        const d = event?.data;
        if (!d) return;
        if (event.type === 'create') {
          toast.message('📦 Nueva consolidación', { description: d.consolidation_tracking || 'Sin tracking' });
        } else if (event.type === 'update') {
          const label = d.payment_proof_url ? 'Comprobante de pago cargado' : `Estado: ${d.status || 'actualizado'}`;
          toast.message('🚚 Consolidación actualizada', { description: `${d.consolidation_tracking || 'Sin tracking'} • ${label}` });
        }
      })
    );

    // Facturas generadas/actualizadas
    unsubs.push(
      base44.entities.Invoice.subscribe((event) => {
        const d = event?.data;
        if (!d) return;
        if (event.type === 'create') {
          toast.message('🧾 Nueva factura', { description: d.invoice_number || d.consolidation_tracking || 'Factura generada' });
        } else if (event.type === 'update') {
          toast.message('🧾 Factura actualizada', { description: d.invoice_number || d.consolidation_tracking || 'Actualización de factura' });
        }
      })
    );

    return () => {
      unsubs.forEach((u) => { try { typeof u === 'function' && u(); } catch (_) {} });
    };
  }, [user]);

  const saveNotification = async (title, message, type, icon, referenceId) => {
    try {
      // Check if notification already exists for this user and reference
      if (user?.email && referenceId) {
        const existing = await base44.entities.Notification.filter({
          user_email: user.email,
          reference_id: referenceId,
          title: title
        }, '-created_date', 1);
        
        // If exists and was created in the last 5 seconds, skip
        if (existing.length > 0) {
          const lastNotif = existing[0];
          const timeDiff = Date.now() - new Date(lastNotif.created_date).getTime();
          if (timeDiff < 5000) {
            return; // Skip duplicate
          }
        }
        
        // Save notification
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