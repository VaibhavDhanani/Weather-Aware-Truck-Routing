import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // react-map-gl imports maplibre-gl lazily; pre-bundle it so dev never serves a stale chunk.
    include: ['maplibre-gl', 'react-map-gl/maplibre'],
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: 'maplibre', test: /node_modules[\\/]maplibre-gl/ }] },
      },
    },
    // maplibre-gl is one pre-minified ~1 MB file that cannot be split.
    chunkSizeWarningLimit: 1100,
  },
  server: {
    port: 5175,
    strictPort: true,
  },
  preview: {
    port: 5175,
    strictPort: true,
  },
})
