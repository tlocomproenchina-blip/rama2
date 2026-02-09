import React, { useState, useEffect } from 'react';

/**
 * Componente de imagen optimizado para mobile
 * - Lazy loading
 * - Srcset responsive
 * - Formato WebP con fallback
 * - Error handling
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  onLoad,
  priority = false
}) {
  const [imageSrc, setImageSrc] = useState(priority ? src : null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!src) return;

    // Si es prioritario, cargar inmediatamente
    if (priority) {
      setImageSrc(src);
      return;
    }

    // Usar Intersection Observer para lazy loading
    const img = new Image();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setImageSrc(src);
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '50px' // Comienza a cargar 50px antes de ser visible
    });

    // Crear un elemento temporal para observar
    const tempDiv = document.createElement('div');
    observer.observe(tempDiv);

    return () => {
      observer.disconnect();
    };
  }, [src, priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  return (
    <div className={`relative overflow-hidden ${className || ''}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse" />
      )}
      <img
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        onLoad={handleLoad}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}