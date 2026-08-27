import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  resolve: {
    // NO usar alias con rutas absolutas para react/react-dom: eso crea un
    // segundo chunk pre-empaquetado (dos copias de React, dos hashes ?v=)
    // y provoca "Cannot read properties of null (reading 'useState')".
    // `dedupe` es suficiente para garantizar una única copia.
    dedupe: ['react', 'react-dom', 'react-router-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
  },
  optimizeDeps: {
    // Incluir aquí todo lo que consume React evita que Vite descubra una
    // dependencia nueva a mitad de sesión y reoptimice (lo que cambia el
    // hash ?v= mientras el navegador ya cargó los chunks viejos).
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
      'recharts'
    ]
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