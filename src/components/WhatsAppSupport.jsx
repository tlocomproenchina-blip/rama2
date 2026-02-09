import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle } from 'lucide-react';

export default function WhatsAppSupport() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        setConfig(configs[0]);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    setLoading(false);
  };

  if (loading || !config || !config.whatsapp_enabled || !config.whatsapp_number) {
    return null;
  }

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent(config.whatsapp_message || 'Hola, necesito ayuda');
    const whatsappUrl = `https://wa.me/${config.whatsapp_number}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <button
      onClick={handleWhatsAppClick}
      className="fixed bottom-6 right-6 z-30 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center"
      title="Soporte por WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  );
}