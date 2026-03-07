import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";

export default function HomeHeroVideo({ onAuthClick, authLoading }) {
  // Placeholder de video (Pexels) hasta subir el clip licenciado
  const videoSrc =
    "https://videos.pexels.com/video-files/10529628/10529628-hd_2560_1440_24fps.mp4";
  const poster =
    "https://images.pexels.com/videos/10529628/pexels-photo-10529628.jpeg?auto=compress&cs=tinysrgb&w=1600";

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-black">
      {/* Video de fondo */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={videoSrc}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />

      {/* Overlay degradado para legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A]/80 via-[#0B1F3A]/60 to-[#0B1F3A]/30" />
      <div className="absolute inset-0 bg-black/20" />

      {/* Contenido */}
      <div className="relative z-10 px-6 py-12 md:px-12 md:py-20">
        <div className="max-w-3xl text-white">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Logística China → Venezuela, sin fricción
          </h1>
          <p className="mt-4 text-lg text-white/90">
            Consolidamos, aseguramos y entregamos puerta a puerta. Transparente,
            rápido y con soporte en español.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={createPageUrl("ShippingCalculator")}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Cotizar envío ahora <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to={createPageUrl("ShipmentTracking")}>
              <Button variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20">
                Rastrear paquete
              </Button>
            </Link>
          </div>

          {/* Acciones auxiliares (opcional, mantienen flujo existente) */}
          {onAuthClick && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={onAuthClick}
                disabled={!!authLoading}
                className="bg-white/10 text-white hover:bg-white/20"
              >
                Registrarse
              </Button>
              <Button
                variant="ghost"
                onClick={onAuthClick}
                disabled={!!authLoading}
                className="text-white hover:bg-white/10"
              >
                Iniciar sesión
              </Button>
            </div>
          )}
        </div>

        {/* Barra de confianza */}
        <div className="mt-8 flex flex-wrap items-center gap-4 text-white/80 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>+10.000 envíos</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-300" />
            <span>97.8% a tiempo</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-300" />
            <span>Seguro opcional</span>
          </div>
        </div>
      </div>

      {/* Altura mínima para impacto visual */}
      <div className="invisible md:visible h-[46vh] md:h-[64vh]" />
    </section>
  );
}