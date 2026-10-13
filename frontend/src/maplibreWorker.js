// MapLibre v6 runs tile parsing in a web worker. Under Vite the default worker
// URL breaks after dependency pre-bundling, so bundle the worker ourselves and
// point MapLibre at it before any map is created.
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(workerUrl)
