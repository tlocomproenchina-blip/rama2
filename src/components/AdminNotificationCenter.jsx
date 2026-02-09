import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AdminNotificationCenter({ user }) {
  useEffect(() => {
    // Real-time subscriptions disabled to prevent rate limiting
    // Admin notifications will be created via backend functions when needed
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