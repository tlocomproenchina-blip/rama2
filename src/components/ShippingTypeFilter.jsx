import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Hook para obtener los tipos de envío habilitados
export function useEnabledShippingTypes() {
  const [enabledTypes, setEnabledTypes] = useState({
    aereo: true,
    maritimo: true,
    loading: true
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        const config = configs[0];
        setEnabledTypes({
          aereo: config.shipping_type_air_enabled !== false,
          maritimo: config.shipping_type_sea_enabled !== false,
          loading: false
        });
      } else {
        setEnabledTypes({ aereo: true, maritimo: true, loading: false });
      }
    } catch (error) {
      console.error('Error loading shipping config:', error);
      setEnabledTypes({ aereo: true, maritimo: true, loading: false });
    }
  };

  return enabledTypes;
}

// Función helper para filtrar opciones de tipo de envío
export function getAvailableShippingTypes(config) {
  const types = [];
  
  if (config?.shipping_type_air_enabled !== false) {
    types.push({ value: 'aereo', label: 'Aéreo' });
  }
  
  if (config?.shipping_type_sea_enabled !== false) {
    types.push({ value: 'maritimo', label: 'Marítimo' });
  }
  
  return types;
}

// Función para validar si un tipo de envío está habilitado
export function isShippingTypeEnabled(type, config) {
  if (type === 'aereo') {
    return config?.shipping_type_air_enabled !== false;
  }
  if (type === 'maritimo') {
    return config?.shipping_type_sea_enabled !== false;
  }
  return false;
}