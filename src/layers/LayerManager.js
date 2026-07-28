/**
 * LayerManager — controla TODAS as fontes e camadas do mapa.
 * Nenhum componente deve chamar map.addSource/addLayer/removeLayer diretamente.
 *
 * Responsabilidades:
 * - Registrar fontes e camadas
 * - Adicionar ao mapa
 * - Atualizar dados GeoJSON
 * - Ativar/desativar camadas
 * - Alterar opacidade e ordem
 * - Controlar zoom min/max
 * - Controle de seleção e cliques
 * - Legendas
 * - Carregamento e erros
 * - Gerenciar cache
 */
import maplibregl from 'maplibre-gl';
import { EventBus, EVENTS } from '../core/EventBus';
import { ErrorManager } from '../core/ErrorManager';

class LayerManagerImpl {
  constructor() {
    this._map = null;
    this._layers = new Map(); // id → definition + state
    this._sources = new Map(); // sourceId → { type, data }
    this._clickHandlers = new Map();
  }

  setMap(map) {
    this._map = map;
  }

  isReady() {
    return !!this._map;
  }

  register(definition) {
    this._layers.set(definition.id, {
      ...definition,
      visible: definition.defaultVisible ?? true,
      loading: false,
      error: null,
      lastUpdated: null,
    });
    EventBus.emit(EVENTS.LAYER_REGISTERED, definition);
  }

  registerAll(definitions) {
    definitions.forEach((d) => this.register(d));
  }

  getLayer(id) {
    return this._layers.get(id);
  }

  getAllLayers() {
    return Array.from(this._layers.values());
  }

  getLayersByGroup() {
    const groups = new Map();
    for (const layer of this._layers.values()) {
      const g = layer.group || 'Outros';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(layer);
    }
    return groups;
  }

  addSource(sourceId, data) {
    if (!this._map) return;
    if (this._map.getSource(sourceId)) {
      this._map.getSource(sourceId).setData(data);
    } else {
      this._map.addSource(sourceId, { type: 'geojson', data });
    }
    this._sources.set(sourceId, { type: 'geojson', data });
  }

  addLayerToMap(def) {
    if (!this._map) return;
    const sourceId = `src-${def.id}`;
    const hasData = this._sources.has(sourceId);

    if (!hasData) {
      this.addSource(sourceId, { type: 'FeatureCollection', features: [] });
    }

    const layerConfig = {
      id: def.id,
      source: sourceId,
      minzoom: def.minZoom || 0,
      maxzoom: def.maxZoom || 24,
      layout: { visibility: def.visible !== false ? 'visible' : 'none' },
    };

    if (def.geometryType === 'point') {
      this._map.addLayer({ ...layerConfig, type: 'circle', paint: def.paint || {} });
    } else if (def.geometryType === 'linestring') {
      this._map.addLayer({ ...layerConfig, type: 'line', paint: def.paint || {} });
    } else {
      this._map.addLayer({ ...layerConfig, type: 'fill', paint: def.paint || {} });
      if (def.paint?.['line-color']) {
        this._map.addLayer({
          id: `${def.id}-outline`,
          source: sourceId,
          type: 'line',
          minzoom: def.minZoom || 0,
          maxzoom: def.maxZoom || 24,
          layout: { visibility: def.visible !== false ? 'visible' : 'none' },
          paint: {
            'line-color': def.paint['line-color'],
            'line-width': def.paint['line-width'] || 1,
            'line-opacity': def.paint['line-opacity'] ?? 0.8,
            ...(def.paint['line-dasharray'] ? { 'line-dasharray': def.paint['line-dasharray'] } : {}),
          },
        });
      }
    }

    if (def.interactive) {
      this._attachClickHandler(def);
    }
  }

  _attachClickHandler(def) {
    if (!this._map) return;
    const layerIds = [def.id, `${def.id}-outline`].filter((id) => this._map.getLayer(id));

    const handler = (e) => {
      if (!e.features?.length) return;
      const feature = e.features[0];
      EventBus.emit('layer:click', { layerId: def.id, feature, lngLat: e.lngLat });
    };

    layerIds.forEach((lid) => {
      this._map.on('click', lid, handler);
      this._map.on('mouseenter', lid, () => {
        this._map.getCanvas().style.cursor = 'pointer';
      });
      this._map.on('mouseleave', lid, () => {
        this._map.getCanvas().style.cursor = '';
      });
    });

    this._clickHandlers.set(def.id, { handler, layerIds });
  }

  updateLayerData(layerId, geojson) {
    if (!this._map) return;
    const sourceId = `src-${layerId}`;
    const def = this._layers.get(layerId);

    this.addSource(sourceId, geojson);

    if (!this._map.getLayer(layerId)) {
      this.addLayerToMap(def);
    }

    if (def) {
      def.lastUpdated = Date.now();
      def.loading = false;
      def.error = null;
    }

    EventBus.emit(EVENTS.LAYER_DATA_UPDATED, { layerId, data: geojson });
  }

  setVisibility(layerId, visible) {
    if (!this._map) return;
    const def = this._layers.get(layerId);
    if (!def) return;

    def.visible = visible;
    const layerIds = [layerId, `${layerId}-outline`];
    layerIds.forEach((lid) => {
      if (this._map.getLayer(lid)) {
        this._map.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none');
      }
    });

    EventBus.emit(EVENTS.LAYER_VISIBILITY_CHANGED, { layerId, visible });
  }

  setOpacity(layerId, opacity) {
    if (!this._map) return;
    const def = this._layers.get(layerId);
    if (!def) return;

    def.opacity = opacity;
    const layerIds = [layerId, `${layerId}-outline`];
    layerIds.forEach((lid) => {
      if (!this._map.getLayer(lid)) return;
      const type = this._map.getLayer(lid).type;
      if (type === 'fill') {
        this._map.setPaintProperty(lid, 'fill-opacity', opacity * (def.paint?.['fill-opacity'] ?? 0.5));
      } else if (type === 'line') {
        this._map.setPaintProperty(lid, 'line-opacity', opacity * (def.paint?.['line-opacity'] ?? 0.8));
      } else if (type === 'circle') {
        this._map.setPaintProperty(lid, 'circle-opacity', opacity);
      }
    });
  }

  removeLayer(layerId) {
    if (!this._map) return;
    [layerId, `${layerId}-outline`].forEach((lid) => {
      if (this._map.getLayer(lid)) this._map.removeLayer(lid);
    });
    if (this._map.getSource(`src-${layerId}`)) {
      this._map.removeSource(`src-${layerId}`);
    }
    this._layers.delete(layerId);
    this._sources.delete(`src-${layerId}`);
  }

  setError(layerId, error) {
    const def = this._layers.get(layerId);
    if (def) {
      def.error = error;
      def.loading = false;
    }
    ErrorManager.report('layer', error, { layerId });
  }
}

export const LayerManager = new LayerManagerImpl();