/**
 * MapController — wrapper do MapLibre GL JS.
 * Inicializa o mapa, gerencia estilos de mapa-base e expõe operações de controle.
 * A adição de camadas é feita via LayerManager, não aqui.
 */
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as turf from '@turf/turf';
import { BASE_MAPS } from '../layers/LayerDefinitions';
import { LayerManager } from '../layers/LayerManager';
import { EventBus, EVENTS } from '../core/EventBus';
import { config } from '../core/config';

export function createMap(container, opts = {}) {
  const baseMap = BASE_MAPS[opts.baseMapId || config.defaultBaseMap] || BASE_MAPS.standard;

  const map = new maplibregl.Map({
    container,
    style: baseMap.style,
    center: opts.center || [-39.5, -5.2],
    zoom: opts.zoom || 6,
    maxZoom: 18,
    minZoom: 4,
    attributionControl: true,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  map.on('load', () => {
    LayerManager.setMap(map);
    EventBus.emit(EVENTS.MAP_READY, { map });
  });

  return map;
}

export function changeBaseMap(map, baseMapId) {
  const baseMap = BASE_MAPS[baseMapId];
  if (!baseMap || !map) return;

  const center = map.getCenter();
  const zoom = map.getZoom();
  const bearing = map.getBearing();
  const pitch = map.getPitch();

  map.setStyle(baseMap.style, { diff: false });

  map.once('styledata', () => {
    // Re-adicionar fontes e camadas via LayerManager (dados preservados em memória)
    for (const def of LayerManager.getAllLayers()) {
      if (!map.getLayer(def.id)) {
        try {
          LayerManager.addLayerToMap(def);
        } catch (err) {
          console.error('[MapController] addLayerToMap falhou para', def.id, err);
        }
      }
    }
    try { map.resize(); } catch { /* skip */ }
    map.jumpTo({ center, zoom, bearing, pitch });
  });
}

export function fitToCeara(map, boundaryGeojson) {
  if (!map || !boundaryGeojson?.features?.length) return;
  try {
    const bbox = turf.bbox(boundaryGeojson);
    map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 1000 });
  } catch (err) {
    console.error('[MapController] fitToCeara falhou:', err);
  }
}