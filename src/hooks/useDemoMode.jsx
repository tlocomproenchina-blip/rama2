import { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

let cachedResult = null;

export default function useDemoMode() {
  const [demoMode, setDemoMode] = useState(cachedResult ?? false);
  const [demoMessage, setDemoMessage] = useState('');

  useEffect(() => {
    base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1).then(cfgs => {
      const cfg = cfgs?.[0];
      const on = !!cfg?.demo_mode;
      cachedResult = on;
      setDemoMode(on);
      setDemoMessage(cfg?.demo_mode_message || 'Modo demo activo: integraciones externas desactivadas.');
    }).catch(() => {});
  }, []);

  return { demoMode, demoMessage };
}