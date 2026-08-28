import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  resolve: {
    // Garantiza una única copia de React/ReactDOM en todo el árbol de dependencias.
    // Esta es la forma estándar y soportada de evitar "Cannot read properties of
    // null (reading 'useState')" causado por dos instancias de React conviviendo.
    dedupe: ['react', 'react-dom', 'react-router-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
  },
  optimizeDeps: {
    // Escanea TODAS las páginas (incluidas las cargadas con React.lazy) como
    // entradas, para que Vite descubra y pre-empaquete sus dependencias desde
    // el arranque en frío. Sin esto, Vite solo ve los imports estáticos y
    // reoptimiza a mitad de sesión al navegar a una página lazy, generando
    // chunks nuevos de React que conviven con los viejos ("useState" null).
    entries: ['index.html', 'src/**/*.{js,jsx}'],
    // Declara explícitamente las dependencias más usadas para que queden
    // incluidas en el pre-bundle inicial sin depender solo del escaneo.
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router-dom',
      '@tanstack/react-query',
      'lucide-react',
      'recharts',
      'date-fns',
      'moment',
      'lodash',
      'framer-motion',
      'react-hook-form',
      '@hello-pangea/dnd',
      'react-markdown',
      'react-quill-new',
      '@stripe/react-stripe-js',
      '@stripe/stripe-js',
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
      'react-day-picker',
      'react-leaflet',
      'react-resizable-panels',
      'sonner',
      'vaul',
      'xlsx',
      'zod',
      'cmdk',
      'input-otp',
      'canvas-confetti',
      'html2canvas',
      'jspdf',
      'tailwind-merge',
      'class-variance-authority',
      'clsx',
      'next-themes',
      'react-hot-toast',
      'embla-carousel-react',
      '@hookform/resolvers',
      'three',
      'react-quill',
      'react-quill-new'
    ],
    // Espera a terminar de rastrear todas las dependencias antes de servir nada,
    // evitando que Vite reoptimice a mitad de sesión y cambie los chunks de React.
    holdUntilCrawlEnd: true
  },
  plugins: [
    {
      // Evita que el navegador cachee chunks de Vite con `immutable`.
      // Sin esto, el browser sirve chunks de una optimización anterior desde
      // disk cache y los mezcla con los nuevos → dos copias de React →
      // "Cannot read properties of null (reading 'useState')".
      name: 'no-cache-dev-chunks',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          const isDevAsset =
            url.includes('/.vite/deps/') ||
            url.includes('/@vite/') ||
            url.includes('/@react-refresh') ||
            url.includes('/@id/') ||
            url.includes('/@fs/') ||
            url.includes('/src/') ||
            /\.(js|jsx|ts|tsx|css|mjs)(\?|$)/.test(url);
          if (isDevAsset) {
            const orig = res.setHeader.bind(res);
            res.setHeader = function (name, value) {
              if (name.toLowerCase() === 'cache-control') {
                return orig(name, 'no-store, no-cache, must-revalidate');
              }
              return orig(name, value);
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