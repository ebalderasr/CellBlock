import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/CellBlock/', 
  build: {
    // Esto evita que la app se rompa al actualizar
    chunkSizeWarningLimit: 2000, 
    rollupOptions: {
      output: {
        manualChunks: undefined // Desactiva la división de código
      }
    }
  }
})