import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // react-map-gl loads maplibre-gl via a lazy import() that Vite only finds at
    // runtime; pre-bundle both so the dev server never serves a stale chunk.
    include: ['maplibre-gl', 'react-map-gl/maplibre'],
  },
  build: {
    rolldownOptions: {
      output: {
        // Keep MapLibre in its own long-cached chunk instead of inside the planner code.
        codeSplitting: { groups: [{ name: 'maplibre', test: /node_modules[\\/]maplibre-gl/ }] },
      },
    },
    // maplibre-gl ships as one pre-minified ~1 MB file that cannot be split further;
    // it is loaded only on /plan. Every other chunk stays far below this.
    chunkSizeWarningLimit: 1100,
  },
  server: {
    port: 5175,
    strictPort: true, // fail loudly instead of drifting to another port
  },
  preview: {
    port: 5175,
    strictPort: true,
  },
})
