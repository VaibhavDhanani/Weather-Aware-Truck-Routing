import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // react-map-gl loads maplibre-gl via a lazy import() that Vite only finds at
    // runtime; pre-bundle both so the dev server never serves a stale chunk.
    include: ['maplibre-gl', 'react-map-gl/maplibre'],
  },
  server: {
    port: 5175,
    strictPort: true, // fail loudly instead of drifting to another port
    // Forward API calls to the Django dev server (port 8010) so the browser sees one origin.
    proxy: {
      '/api': 'http://127.0.0.1:8010', // explicit IPv4: Django binds 127.0.0.1 only
    },
  },
  preview: {
    port: 5175,
    strictPort: true,
  },
})
