import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

export default function ChangeDetectionBadge({ onRefresh, onRefreshPackages, onRefreshConsolidations }) {
  const [hasNewChanges, setHasNewChanges] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [changedEntities, setChangedEntities] = useState({ packages: false, consolidations: false, requests: false });

  // Función para verificar cambios
  const checkForChanges = async () => {
    try {
      setIsChecking(true);
      
      // Obtener último timestamp del sessionStorage
      const lastChecked = sessionStorage.getItem('lastCheckedTimestamp') || 
        new Date(Date.now() - 180000).toISOString();
      
      // Verificar cambios en las 3 entidades
      const [packages, consolidations, requests] = await Promise.all([
        base44.entities.Package.filter(
          { created_date: { $gte: lastChecked } },
          '-created_date',
          1
        ).catch(() => []),
        base44.entities.Consolidation.filter(
          { created_date: { $gte: lastChecked } },
          '-created_date',
          1
        ).catch(() => []),
        base44.entities.ConsolidationRequest.filter(
          { created_date: { $gte: lastChecked } },
          '-created_date',
          1
        ).catch(() => [])
      ]);

      // Si hay cambios en cualquiera, activar badge
      const hasChanges = packages.length > 0 || 
                        consolidations.length > 0 || 
                        requests.length > 0;
      
      setHasNewChanges(hasChanges);
      setChangedEntities({
        packages: packages.length > 0,
        consolidations: consolidations.length > 0,
        requests: requests.length > 0
      });
      
      // Guardar timestamp actual
      sessionStorage.setItem('lastCheckedTimestamp', new Date().toISOString());
    } catch (error) {
      console.error('Error checking changes:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Polling cada 180 segundos
  useEffect(() => {
    checkForChanges();
    
    const interval = setInterval(() => {
      checkForChanges();
    }, 180000); // 180 segundos

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setHasNewChanges(false);
    sessionStorage.setItem('lastCheckedTimestamp', new Date().toISOString());
    onRefresh();
  };

  const handlePartialRefresh = async () => {
    // Only refresh changed entities
    if (changedEntities.packages && onRefreshPackages) {
      await onRefreshPackages();
    }
    if (changedEntities.consolidations && onRefreshConsolidations) {
      await onRefreshConsolidations();
    }
    setHasNewChanges(false);
    sessionStorage.setItem('lastCheckedTimestamp', new Date().toISOString());
  };

  return (
    <AnimatePresence>
      {hasNewChanges && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-red-800 font-semibold">⚠ Nuevos cambios detectados</p>
                <p className="text-red-700 text-sm">Se han registrado cambios en Paquetes, Consolidaciones o Solicitudes</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(onRefreshPackages || onRefreshConsolidations) && (
                <Button
                  onClick={handlePartialRefresh}
                  disabled={isChecking}
                  className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                  size="sm"
                  title="Solo actualiza las entidades que cambiaron"
                >
                  {isChecking ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Parcial...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Actualizar Parcial
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={handleRefresh}
                disabled={isChecking}
                className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
                size="sm"
              >
                {isChecking ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar Todo
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}