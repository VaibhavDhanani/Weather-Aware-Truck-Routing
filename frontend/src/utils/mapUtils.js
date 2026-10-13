// MapLibre layer styles and the GeoJSON the map's sources draw from.

import {
  HEATMAP_COLOR_STOPS,
  HEATMAP_INTENSITY,
  HEATMAP_KERNEL_CELLS,
  HEATMAP_MIN_SCORE,
  HEATMAP_OPACITY,
  RISK_LEVELS,
} from '../constants'
import { routeColor } from './routeUtils'

const isSelected = ['get', 'selected']

// ------------------------------------------------------------------ layers

export const ROUTE_CASING_LAYER = {
  id: 'route-casing',
  type: 'line',
  layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['case', isSelected, 1, 0] },
  paint: { 'line-color': '#ffffff', 'line-width': ['case', isSelected, 10, 6] },
}

export const ROUTE_LINE_LAYER = {
  id: 'route-line',
  type: 'line',
  layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['case', isSelected, 1, 0] },
  paint: {
    'line-color': ['get', 'color'],
    'line-width': ['case', isSelected, 6, 3.5],
    'line-opacity': ['case', isSelected, 1, 0.5],
  },
}

export const CHECKPOINT_LAYER = {
  id: 'checkpoint-dots',
  type: 'circle',
  paint: {
    'circle-color': ['match', ['get', 'level'], ...RISK_LEVELS.flatMap((l) => [l.key, l.color]), '#888'],
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3.5, 8, 7],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 1.5,
  },
}

/** Heatmap whose kernel stays ~HEATMAP_KERNEL_CELLS grid cells wide at every zoom. */
export function heatmapLayer(cellSizeDeg, visible) {
  const radiusAtZoom0 = cellSizeDeg * (512 / 360) * HEATMAP_KERNEL_CELLS // 512 px per 360° at zoom 0
  return {
    id: 'weather-heat',
    type: 'heatmap',
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: {
      'heatmap-weight': ['get', 'score'],
      // Pixels per degree double with each zoom level.
      'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, radiusAtZoom0, 12, radiusAtZoom0 * 4096],
      'heatmap-intensity': HEATMAP_INTENSITY,
      'heatmap-opacity': HEATMAP_OPACITY,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], ...HEATMAP_COLOR_STOPS.flat()],
    },
  }
}

// ----------------------------------------------------------------- geojson

const featureCollection = (features) => ({ type: 'FeatureCollection', features })
const point = (lon, lat, properties) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties })

export function routesGeoJson(routes, selectedRouteId) {
  return featureCollection(
    routes.map((route) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: route.geometry },
      properties: { id: route.id, color: routeColor(route.id), selected: route.id === selectedRouteId },
    })),
  )
}

export function checkpointsGeoJson(route) {
  return featureCollection(route.checkpoints.map((c) => point(c.lon, c.lat, { index: c.index, level: c.risk.level })))
}

/** Heatmap cells for one forecast hour; near-calm cells get no weight. */
export function heatmapGeoJson(heatmap, hour) {
  return featureCollection(
    heatmap.points.map((p) => {
      const score = p.values[hour]
      return point(p.lon, p.lat, { score: score < HEATMAP_MIN_SCORE ? 0 : score })
    }),
  )
}
