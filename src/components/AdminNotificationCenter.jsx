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