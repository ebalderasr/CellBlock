import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ajusta 'base' si el repositorio en GitHub no se llama exactamente CellBlock
  base: '/CellBlock/', 
  build: {
    rollupOptions: {
      output: {
        // Manual Chunks: Dividimos las dependencias para una carga más rápida
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('date-fns')) return 'date-fns';
            if (id.includes('lucide-react')) return 'icons';
            return 'vendor';
          }
        },
      },
    },
    // Aumentamos el límite de advertencia de tamaño ya que usamos librerías robustas
    chunkSizeWarningLimit: 800,
    sourcemap: false, // Desactivado para producción para ahorrar espacio
    minify: 'esbuild', // El minificador más rápido para mantener la Suite HostCell ligera
  },
  server: {
    port: 5173,
    host: true, // Permite ver la app en tu celular mediante la IP local
  },
})