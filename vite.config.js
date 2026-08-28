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
    // Espera a terminar de rastrear todas las dependencias antes de servir nada,
    // evitando que Vite reoptimice a mitad de sesión y cambie los chunks de React.
    holdUntilCrawlEnd: true
  },
  plugins: [
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