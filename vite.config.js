import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  server: {
    // CAUSA RAÍZ del error "Cannot read properties of null (reading 'useState')":
    // Vite sirve /node_modules/.vite/deps/* con `Cache-Control: max-age=31536000,
    // immutable`. Cuando el optimizador vuelve a correr y cambia el hash ?v=,
    // el navegador sigue usando los chunks viejos guardados en disco y los
    // mezcla con los nuevos → DOS copias de React conviviendo.
    // `no-store` obliga al navegador a pedir siempre la versión actual.
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  },
  resolve: {
    // NO usar alias con rutas absolutas para react/react-dom: eso crea un
    // segundo chunk pre-empaquetado (dos copias de React, dos hashes ?v=)
    // y provoca "Cannot read properties of null (reading 'useState')".
    // `dedupe` es suficiente para garantizar una única copia.
    dedupe: ['react', 'react-dom', 'react-router-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
  },
  optimizeDeps: {
    // `force: true` re-empaqueta TODAS las dependencias en cada arranque del
    // servidor, generando un hash ?v= NUEVO y consistente para todos los chunks.
    // Esto es necesario porque el navegador puede tener chunks de React cacheados
    // como `immutable` (de antes de que se añadiera el header `no-store`), y la
    // única forma de bypasear esa caché HTTP obsoleta es cambiar la URL (?v= nuevo).
    // Sin `force`, Vite reutiliza la caché de disco y el navegador sigue sirviendo
    // el chunk viejo immutable → DOS copias de React → "useState null".
    // El header `no-store` (server.headers) impide que los NUEVOS chunks se
    // cacheen, y el staleChunkGuard recarga la página si una pestaña abierta
    // mezcla hashes viejos/nuevos tras un reinicio.
    force: true,
    // Vite espera a terminar de rastrear TODO antes de servir dependencias,
    // así no sirve un chunk con un hash que después cambia.
    holdUntilCrawlEnd: true,
    // esbuildOptions cambia el metadataHash de Vite, forzando un NUEVO hash ?v=
    // para TODOS los chunks. Esto bypasea la caché HTTP obsoleta del navegador
    // (chunks de React cacheados como `immutable` con el hash anterior, que
    // el navegador sigue sirviendo sin revalidar). keepNames preserva nombres
    // de funciones (mejor debugging en dev) y es inofensivo.
    esbuildOptions: { keepNames: true },
    // CLAVE: el rastreo por defecto solo sigue imports estáticos desde index.html.
    // Como casi todas las páginas se cargan con import() diferido, sus dependencias
    // se descubren recién al navegar → Vite reoptimiza y cambia el hash ?v=,
    // conviviendo dos copias de React ("Cannot read properties of null (useState)").
    // Al declarar todos los archivos fuente como entradas, el escáner las ve todas
    // antes de servir nada y el hash queda fijo para toda la sesión.
    entries: [
      'index.html',
      'src/**/*.{js,jsx,ts,tsx}'
    ],
    // Incluir aquí todo lo que consume React evita que Vite descubra una
    // dependencia nueva a mitad de sesión y reoptimice (lo que cambia el
    // hash ?v= mientras el navegador ya cargó los chunks viejos).
    // Las páginas se cargan en diferido, así que muchas de estas librerías
    // solo aparecen al navegar: si no están declaradas aquí, provocan una
    // reoptimización tardía y dos copias de React conviviendo.
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router-dom',
      '@base44/sdk',
      '@tanstack/react-query',
      'framer-motion',
      'lucide-react',
      'recharts',
      'react-hook-form',
      '@hookform/resolvers/zod',
      'zod',
      'date-fns',
      'moment',
      'lodash',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'react-markdown',
      'react-day-picker',
      'react-resizable-panels',
      'react-hot-toast',
      'sonner',
      'next-themes',
      'cmdk',
      'vaul',
      'embla-carousel-react',
      'input-otp',
      'canvas-confetti',
      'html2canvas',
      'jspdf',
      'xlsx',
      'three',
      // 'react-leaflet' NO se pre-empaqueta: requiere `leaflet` como peer y no
      // está instalado, así que el optimizador falla a mitad de la corrida y
      // deja dos conjuntos de chunks (dos copias de React con hashes ?v= distintos).
      '@hello-pangea/dnd',
      '@stripe/stripe-js',
      '@stripe/react-stripe-js',
      // Radix UI primitives — usados por componentes shadcn dentro de páginas
      // con lazy loading. Si no se pre-empaquetan, Vite los descubre tarde al
      // navegar y reoptimiza, cambiando el hash ?v= de React (copia duplicada).
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      'react-quill'
    ]
  },
  plugins: [
    // Forzar `no-store` en chunks internos de Vite (.vite/deps, /@vite, /@react-refresh, /src).
    // Vite envía `Cache-Control: max-age=31536000, immutable` para .vite/deps por defecto,
    // lo que hace que el navegador cachee React por un año. Cuando Vite re-optimiza y
    // cambia el hash ?v= de algunos chunks pero no de otros, el navegador mezcla chunks
    // de optimizaciones distintas → DOS copias de React → "useState null".
    // Este plugin intercepta setHeader y reemplaza cualquier Cache-Control por no-store.
    {
      name: 'force-no-store-vite-chunks',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          if (url.includes('/.vite/deps/') || url.includes('/@vite/') || url.includes('/@react-refresh') || url.includes('/@fs/') || url.startsWith('/src/')) {
            const origSetHeader = res.setHeader.bind(res);
            res.setHeader = function (name, value) {
              if (name.toLowerCase() === 'cache-control') {
                return origSetHeader(name, 'no-store, no-cache, must-revalidate');
              }
              return origSetHeader(name, value);
            };
          }
          next();
        });
      }
    },
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: true
    }),
    react(),
  ]
});