import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/maplibreWorker'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
