import React, { useEffect, useRef, useState } from 'react';
import { Ship, Globe, RotateCw } from 'lucide-react';

const CONTINENTS = [
  {
    name: 'North America',
    points: [
      [75, -165], [75, -110], [82, -80], [75, -55], [52, -50], [45, -60], [25, -80], [14, -90],
      [14, -105], [30, -115], [32, -125], [48, -125], [60, -145], [60, -165], [75, -165]
    ]
  },
  {
    name: 'South America',
    points: [
      [12, -73], [10, -55], [5, -45], [-5, -34], [-22, -42], [-42, -62], [-55, -68], [-52, -76],
      [-32, -72], [-15, -78], [0, -81], [8, -80], [12, -73]
    ]
  },
  {
    name: 'Eurasia',
    points: [
      [70, -10], [78, 20], [78, 60], [78, 100], [72, 140], [65, 175], [50, 142], [32, 140],
      [22, 118], [10, 108], [8, 96], [20, 72], [10, 72], [8, 50], [15, 45], [12, 35],
      [30, 32], [42, 26], [38, -8], [55, -10], [70, -10]
    ]
  },
  {
    name: 'Africa',
    points: [
      [36, -5], [32, 32], [15, 39], [10, 52], [-5, 40], [-34, 20], [-33, 17], [5, 9],
      [5, -14], [15, -17], [20, -17], [36, -5]
    ]
  },
  {
    name: 'Australia',
    points: [
      [-10, 142], [-15, 146], [-38, 151], [-39, 143], [-34, 114], [-20, 113], [-11, 130], [-10, 142]
    ]
  }
];

function isPointInPolygon(lat, lon, vs) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > lon) !== (yj > lon))
      && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function checkIsLand(lat, lon) {
  for (const continent of CONTINENTS) {
    if (isPointInPolygon(lat, lon, continent.points)) return true;
  }
  return false;
}

function sphericalToCartesian(lat, lon, radius) {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;
  return {
    x: radius * Math.cos(phi) * Math.sin(theta),
    y: radius * Math.sin(phi),
    z: radius * Math.cos(phi) * Math.cos(theta),
  };
}

const WAYPOINTS = [
  { lat: 23.1, lon: 113.3 },  // Guangzhou / Yiwu, China
  { lat: 10.0, lon: 111.0 },  // Mar de China Meridional
  { lat: 1.3, lon: 103.8 },   // Singapur / Estrecho de Malaca
  { lat: 5.0, lon: 80.0 },    // Océano Índico
  { lat: -34.8, lon: 20.0 },  // Cabo de Buena Esperanza
  { lat: -15.0, lon: -6.0 },  // Atlántico Medio
  { lat: 0.0, lon: -35.0 },   // Cruce del Ecuador
  { lat: 8.0, lon: -55.0 },   // Entrada al Caribe
  { lat: 10.4, lon: -68.0 }   // Puerto Cabello, Venezuela
];

export default function InteractiveGlobe() {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const rotRef = useRef({ y: 1.8, x: 0.15 });
  const [manualInteraction, setManualInteraction] = useState(false);
  const dotsRef = useRef([]);

  useEffect(() => {
    const dots = [];
    const radius = 140;
    for (let lat = -80; lat <= 80; lat += 4.5) {
      const latRad = (lat * Math.PI) / 180;
      const lonStep = 5.5 / Math.max(0.1, Math.cos(latRad));
      for (let lon = -180; lon < 180; lon += lonStep) {
        const isLand = checkIsLand(lat, lon);
        const { x, y, z } = sphericalToCartesian(lat, lon, radius);
        dots.push({ x, y, z, isLand });
      }
    }
    dotsRef.current = dots;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    const radius = 140;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.beginPath();
      const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.4, centerX, centerY, radius);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
      grad.addColorStop(0.7, 'rgba(30, 41, 59, 0.3)');
      grad.addColorStop(1, 'rgba(249, 115, 22, 0.05)');
      ctx.fillStyle = grad;
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      if (!isDragging) {
        rotRef.current.y += 0.0028;
      }

      const cosY = Math.cos(rotRef.current.y);
      const sinY = Math.sin(rotRef.current.y);
      const cosX = Math.cos(rotRef.current.x);
      const sinX = Math.sin(rotRef.current.x);

      const project = (x3d, y3d, z3d) => {
        const x1 = x3d * cosY - z3d * sinY;
        const z1 = x3d * sinY + z3d * cosY;
        const y2 = y3d * cosX - z1 * sinX;
        const z2 = y3d * sinX + z1 * cosX;
        return { x: x1 + centerX, y: -y2 + centerY, z: z2 };
      };

      // Back-side dots
      dotsRef.current.forEach((dot) => {
        const proj = project(dot.x, dot.y, dot.z);
        if (proj.z <= 0) {
          const depthAlpha = Math.max(0.04, 0.12 * (1 + proj.z / radius));
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, dot.isLand ? 1.0 : 0.6, 0, Math.PI * 2);
          ctx.fillStyle = dot.isLand
            ? `rgba(249, 115, 22, ${depthAlpha * 0.7})`
            : `rgba(71, 85, 105, ${depthAlpha * 0.4})`;
          ctx.fill();
        }
      });

      // Route path
      const sampledRoutePoints = [];
      const numSegments = WAYPOINTS.length - 1;
      const pointsPerSegment = 18;
      for (let s = 0; s < numSegments; s++) {
        const startPt = sphericalToCartesian(WAYPOINTS[s].lat, WAYPOINTS[s].lon, radius);
        const endPt = sphericalToCartesian(WAYPOINTS[s + 1].lat, WAYPOINTS[s + 1].lon, radius);
        for (let i = 0; i <= pointsPerSegment; i++) {
          const t = i / pointsPerSegment;
          const rawX = startPt.x * (1 - t) + endPt.x * t;
          const rawY = startPt.y * (1 - t) + endPt.y * t;
          const rawZ = startPt.z * (1 - t) + endPt.z * t;
          const len = Math.sqrt(rawX * rawX + rawY * rawY + rawZ * rawZ);
          sampledRoutePoints.push({
            x: (rawX / len) * radius,
            y: (rawY / len) * radius,
            z: (rawZ / len) * radius,
          });
        }
      }

      ctx.beginPath();
      let drawingLine = false;
      sampledRoutePoints.forEach((pt) => {
        const proj = project(pt.x, pt.y, pt.z);
        const isFront = proj.z > -10;
        if (isFront) {
          if (!drawingLine) {
            ctx.moveTo(proj.x, proj.y);
            drawingLine = true;
          } else {
            ctx.lineTo(proj.x, proj.y);
          }
        } else {
          drawingLine = false;
        }
      });
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Front-side dots
      dotsRef.current.forEach((dot) => {
        const proj = project(dot.x, dot.y, dot.z);
        if (proj.z > 0) {
          const depthAlpha = Math.min(1.0, 0.3 + (proj.z / radius) * 0.7);
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, dot.isLand ? 1.4 : 0.8, 0, Math.PI * 2);
          ctx.fillStyle = dot.isLand
            ? `rgba(249, 115, 22, ${depthAlpha * 0.9})`
            : `rgba(51, 65, 85, ${depthAlpha * 0.25})`;
          ctx.fill();
        }
      });

      // Pins
      const pinChina = sphericalToCartesian(23.1, 113.3, radius);
      const pinVenezuela = sphericalToCartesian(10.4, -68.0, radius);

      const drawPin = (pt, emoji, label, color) => {
        const proj = project(pt.x, pt.y, pt.z);
        if (proj.z > 0) {
          const pulse = 1 + 0.18 * Math.sin(Date.now() / 250);
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, 11 * pulse, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          ctx.font = 'bold 9px sans-serif';
          const textWidth = ctx.measureText(label).width;
          ctx.beginPath();
          ctx.roundRect(proj.x - textWidth / 2 - 12, proj.y - 25, textWidth + 24, 15, 4);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fff';
          ctx.fillText(`${emoji} ${label}`, proj.x - textWidth / 2 - 8, proj.y - 14);
        }
      };

      drawPin(pinChina, '🇨🇳', 'China', '#ef4444');
      drawPin(pinVenezuela, '🇻🇪', 'Venezuela', '#f59e0b');

      // Moving cargo ship
      const cycleMs = 18000;
      const progress = (Date.now() % cycleMs) / cycleMs;
      const totalPoints = sampledRoutePoints.length;
      const targetIndex = Math.floor(progress * (totalPoints - 1));
      const nextIndex = Math.min(totalPoints - 1, targetIndex + 1);
      const segmentT = (progress * (totalPoints - 1)) % 1;
      const activePoint = sampledRoutePoints[targetIndex];
      const nextPoint = sampledRoutePoints[nextIndex];

      if (activePoint && nextPoint) {
        const shipX = activePoint.x * (1 - segmentT) + nextPoint.x * segmentT;
        const shipY = activePoint.y * (1 - segmentT) + nextPoint.y * segmentT;
        const shipZ = activePoint.z * (1 - segmentT) + nextPoint.z * segmentT;
        const shipProj = project(shipX, shipY, shipZ);

        if (shipProj.z > 0) {
          const pulse = 1 + 0.15 * Math.sin(Date.now() / 150);
          ctx.beginPath();
          ctx.arc(shipProj.x, shipProj.y, 14 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
          ctx.fill();

          ctx.fillStyle = '#38bdf8';
          ctx.font = '14px sans-serif';
          ctx.fillText('🚢', shipProj.x - 7, shipProj.y + 5);

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
          ctx.fillText('TLEC Cargo', shipProj.x + 12, shipProj.y + 3);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isDragging]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setManualInteraction(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.current.x;
    const deltaY = e.clientY - dragStart.current.y;
    rotRef.current.y += deltaX * 0.007;
    rotRef.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotRef.current.x + deltaY * 0.007));
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setManualInteraction(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - dragStart.current.x;
    const deltaY = e.touches[0].clientY - dragStart.current.y;
    rotRef.current.y += deltaX * 0.007;
    rotRef.current.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotRef.current.x + deltaY * 0.007));
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const resetRotation = () => {
    rotRef.current = { y: 1.8, x: 0.15 };
    setManualInteraction(false);
  };

  return (
    <div className="relative mx-auto flex w-full max-w-sm flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-slate-950/40 p-4 shadow-inner">
      <div className="mb-2 flex w-full items-center justify-between px-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-500">
          <Globe className="h-4 w-4 text-orange-500" />
          <span>Ruta Marítima Directa</span>
        </div>
        <div className="flex items-center gap-1">
          {manualInteraction && (
            <button
              onClick={resetRotation}
              className="cursor-pointer rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
              title="Restaurar vista"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-400">
            75-90 Días
          </span>
        </div>
      </div>

      <div className="relative cursor-grab active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          className="block max-w-full drop-shadow-[0_0_15px_rgba(249,115,22,0.15)]"
        />
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 select-none whitespace-nowrap rounded-full border border-white/5 bg-slate-900/60 px-2.5 py-1 font-mono text-[10px] text-gray-500">
          Arrastra para rotar en 3D ↺
        </div>
      </div>

      <div className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 text-xs">
        <div className="flex items-center gap-2">
          <Ship className="h-4 w-4 animate-pulse text-sky-400" />
          <div>
            <p className="font-semibold text-white">Buque Portacontenedores</p>
            <p className="text-[10px] text-gray-400">Tránsito Internacional Directo</p>
          </div>
        </div>
        <div className="text-right">
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-ping rounded-full bg-orange-500" />
          <span className="font-mono font-bold text-orange-400">Navegando</span>
        </div>
      </div>
    </div>
  );
}