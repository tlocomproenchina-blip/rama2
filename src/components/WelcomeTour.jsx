import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ArrowRight, ArrowLeft, Package, Truck, FileText, CreditCard, HelpCircle, User } from 'lucide-react';
import { base44 } from '@/components/api/ApiQueueManager';

const tourSteps = [
  {
    title: '¡Bienvenido a TLEC Cargo! 🎉',
    description: 'Te guiaremos por las funcionalidades principales de la plataforma para que aproveches al máximo nuestros servicios.',
    icon: Package,
    target: null,
    position: 'center'
  },
  {
    title: 'Tu Shipping Mark',
    description: 'Este es tu código único de identificación. Debes colocarlo en todos tus paquetes para que podamos identificarlos cuando lleguen a nuestro almacén.',
    icon: Package,
    target: '[data-tour="shipping-mark"]',
    position: 'bottom'
  },
  {
    title: 'Dirección del Almacén',
    description: 'Aquí encontrarás la dirección de nuestro almacén en China. Úsala como dirección de envío al comprar tus productos online.',
    icon: Truck,
    target: '[data-tour="warehouse-address"]',
    position: 'bottom'
  },
  {
    title: 'Estadísticas de Envíos',
    description: 'Visualiza el estado de todos tus paquetes: pre-alertas, recibidos, consolidados y entregados en tiempo real.',
    icon: FileText,
    target: '[data-tour="stats"]',
    position: 'top'
  },
  {
    title: 'Crear Pre-Alerta',
    description: 'Antes de que tu paquete llegue al almacén, crea una pre-alerta con el tracking number. Esto nos ayuda a identificar y procesar tu paquete más rápido.',
    icon: Package,
    target: '[data-tour="create-prealert"]',
    position: 'left'
  },
  {
    title: 'Mis Paquetes',
    description: 'Accede a la lista completa de tus paquetes, revisa su estado actual y gestiona tus envíos desde un solo lugar.',
    icon: Package,
    target: '[data-tour="my-packages"]',
    position: 'left'
  },
  {
    title: 'Consolidaciones',
    description: 'Agrupa varios paquetes en un solo envío para ahorrar en costos. Puedes solicitar consolidaciones y ver su progreso aquí.',
    icon: Truck,
    target: '[data-tour="consolidations"]',
    position: 'left'
  },
  {
    title: 'Pagos y Facturas',
    description: 'Gestiona tus pagos pendientes, sube comprobantes y descarga tus facturas desde esta sección.',
    icon: CreditCard,
    target: '[data-tour="invoices"]',
    position: 'left'
  },
  {
    title: 'Centro de Ayuda',
    description: 'Si tienes dudas, consulta nuestras preguntas frecuentes, calcula tarifas de envío o contacta con soporte.',
    icon: HelpCircle,
    target: '[data-tour="help"]',
    position: 'left'
  },
  {
    title: 'Tu Perfil',
    description: 'Actualiza tu información de contacto, ciudad y datos personales desde tu perfil de usuario.',
    icon: User,
    target: '[data-tour="profile"]',
    position: 'left'
  },
  {
    title: '¡Listo para empezar! 🚀',
    description: 'Ya conoces las funcionalidades principales. Puedes revisar el tour nuevamente desde tu perfil cuando lo necesites.',
    icon: Package,
    target: null,
    position: 'center'
  }
];

export default function WelcomeTour({ user, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetPosition, setTargetPosition] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Mostrar el tour solo si el usuario no lo ha completado y tiene perfil completo
    if (user && !user.tour_completed && user.profile_completed && user.shipping_mark) {
      // Pequeño delay para que la página cargue completamente
      setTimeout(() => setShow(true), 1000);
    }
  }, [user]);

  useEffect(() => {
    if (show) {
      updateTargetPosition();
      window.addEventListener('resize', updateTargetPosition);
      return () => window.removeEventListener('resize', updateTargetPosition);
    }
  }, [currentStep, show]);

  const updateTargetPosition = () => {
    const step = tourSteps[currentStep];
    if (step.target) {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
        // Scroll al elemento
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setTargetPosition(null);
    }
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  const handleComplete = async () => {
    try {
      await base44.auth.updateMe({ tour_completed: true });
      setShow(false);
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error al completar tour:', error);
    }
  };

  const getCardPosition = () => {
    if (!targetPosition) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    const step = tourSteps[currentStep];
    const cardWidth = 360;
    const cardHeight = 280;
    const offset = 20;

    switch (step.position) {
      case 'top':
        return {
          top: targetPosition.top - cardHeight - offset,
          left: targetPosition.left + targetPosition.width / 2 - cardWidth / 2
        };
      case 'bottom':
        return {
          top: targetPosition.top + targetPosition.height + offset,
          left: targetPosition.left + targetPosition.width / 2 - cardWidth / 2
        };
      case 'left':
        return {
          top: targetPosition.top + targetPosition.height / 2 - cardHeight / 2,
          left: targetPosition.left - cardWidth - offset
        };
      case 'right':
        return {
          top: targetPosition.top + targetPosition.height / 2 - cardHeight / 2,
          left: targetPosition.left + targetPosition.width + offset
        };
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        };
    }
  };

  if (!show) return null;

  const step = tourSteps[currentStep];
  const Icon = step.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999]">
        {/* Overlay oscuro */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60"
          onClick={handleSkip}
        />

        {/* Spotlight en el elemento objetivo */}
        {targetPosition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute pointer-events-none"
            style={{
              top: targetPosition.top - 8,
              left: targetPosition.left - 8,
              width: targetPosition.width + 16,
              height: targetPosition.height + 16,
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 30px rgba(59, 130, 246, 0.5)',
              borderRadius: '8px',
              border: '2px solid rgb(59, 130, 246)',
              zIndex: 10000
            }}
          />
        )}

        {/* Tarjeta del tour */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="absolute"
          style={{
            ...getCardPosition(),
            zIndex: 10001,
            maxWidth: '90vw',
            width: '360px'
          }}
        >
          <Card className="shadow-2xl border-2 border-blue-500">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-sm text-slate-500">
                    Paso {currentStep + 1} de {tourSteps.length}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSkip}
                  className="h-8 w-8 -mt-2 -mr-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-3">
                {step.title}
              </h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                {step.description}
              </p>

              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {currentStep === tourSteps.length - 1 ? 'Finalizar' : 'Siguiente'}
                  {currentStep < tourSteps.length - 1 && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </div>

              <button
                onClick={handleSkip}
                className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Saltar tour
              </button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}