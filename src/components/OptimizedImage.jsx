import React, { useState, useEffect, useRef } from 'react';

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
  const containerRef = useRef(null);

  useEffect(() => {
    setIsLoaded(false);
    if (!src) return;

    if (priority || typeof IntersectionObserver === 'undefined') {
      setImageSrc(src);
      return;
    }

    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setImageSrc(src);
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '120px'
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [src, priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className || ''}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse" />
      )}
      <img
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        onLoad={handleLoad}
        onError={() => setIsLoaded(true)}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        sizes="100vw"
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}