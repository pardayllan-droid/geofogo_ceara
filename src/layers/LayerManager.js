/**
 * LayerManager
 *
 * Gerencia todas as fontes e camadas operacionais do mapa.
 *
 * Nenhum componente React deve chamar diretamente:
 * - map.addSource();
 * - map.addLayer();
 * - map.removeLayer();
 * - source.setData();
 */

import { EventBus, EVENTS } from '../core/EventBus';
import { ErrorManager } from '../core/ErrorManager';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

class LayerManagerImpl {
  constructor() {
    this._map = null;

    /*
     * ID da camada -> definição e estado.
     */
    this._layers = new Map();

    /*
     * ID da source -> dados GeoJSON preservados em memória.
     */
    this._sources = new Map();

    /*
     * ID da definição -> handlers usados pelo MapLibre.
     */
    this._clickHandlers = new Map();

    this._styleChanging = false;
  }

  setMap(map) {
    if (!map) {
      return;
    }

    this._map = map;
    this._styleChanging = false;
  }

  clearMap(expectedMap = null) {
    if (
      expectedMap &&
      this._map &&
      expectedMap !== this._map
    ) {
      return;
    }

    this._clickHandlers.clear();
    this._map = null;
    this._styleChanging = false;
  }

  isReady() {
    return Boolean(
      this._map &&
      !this._styleChanging &&
      this._map.isStyleLoaded?.(),
    );
  }

  prepareForStyleChange() {
    this._styleChanging = true;

    /*
     * O MapLibre remove as layers e seus handlers ao trocar o estilo.
     * Os dados das sources permanecem armazenados em this._sources.
     */
    this._clickHandlers.clear();
  }

  register(definition) {
    if (!definition?.id) {
      console.error(
        '[LayerManager] Tentativa de registrar camada sem ID.',
        definition,
      );

      return null;
    }

    const existing = this._layers.get(definition.id);

    const registeredLayer = {
      ...existing,
      ...definition,
      visible:
        existing?.visible ??
        definition.defaultVisible ??
        true,
      opacity:
        existing?.opacity ??
        definition.opacity ??
        1,
      loading: existing?.loading ?? false,
      error: existing?.error ?? null,
      lastUpdated: existing?.lastUpdated ?? null,
    };

    this._layers.set(
      definition.id,
      registeredLayer,
    );

    EventBus.emit(
      EVENTS.LAYER_REGISTERED,
      registeredLayer,
    );

    return registeredLayer;
  }

  registerAll(definitions = []) {
    if (!Array.isArray(definitions)) {
      console.error(
        '[LayerManager] registerAll recebeu um valor inválido.',
        definitions,
      );

      return;
    }

    definitions.forEach((definition) => {
      this.register(definition);
    });
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
      const groupName = layer.group || 'Outros';

      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }

      groups.get(groupName).push(layer);
    }

    return groups;
  }

  /**
   * Verifica se a instância do MapLibre pode receber sources/layers.
   */
  _canUseMap() {
    return Boolean(
      this._map &&
      !this._styleChanging &&
      this._map.isStyleLoaded?.(),
    );
  }

  /**
   * Normaliza valores inválidos para uma FeatureCollection vazia.
   */
  _normalizeGeoJSON(data) {
    if (!data || typeof data !== 'object') {
      return EMPTY_FEATURE_COLLECTION;
    }

    if (
      data.type === 'FeatureCollection' &&
      Array.isArray(data.features)
    ) {
      return data;
    }

    if (data.type === 'Feature') {
      return {
        type: 'FeatureCollection',
        features: [data],
      };
    }

    return data;
  }

  /**
   * Armazena e/ou atualiza uma source no mapa.
   */
  addSource(sourceId, data) {
    const normalizedData = this._normalizeGeoJSON(data);

    /*
     * O dado é preservado mesmo quando o mapa ainda não está pronto.
     */
    this._sources.set(sourceId, {
      type: 'geojson',
      data: normalizedData,
    });

    if (!this._canUseMap()) {
      return false;
    }

    try {
      const existingSource =
        this._map.getSource(sourceId);

      if (existingSource?.setData) {
        existingSource.setData(normalizedData);
      } else {
        this._map.addSource(sourceId, {
          type: 'geojson',
          data: normalizedData,
        });
      }

      return true;
    } catch (error) {
      console.error(
        `[LayerManager] Falha na source "${sourceId}":`,
        error,
      );

      ErrorManager.report(
        'layer',
        error,
        {
          operation: 'addSource',
          sourceId,
        },
      );

      return false;
    }
  }

  /**
   * Adiciona uma definição de layer ao mapa.
   */
  addLayerToMap(definition) {
    if (!this._canUseMap()) {
      return false;
    }

    if (!definition?.id) {
      const error = new Error(
        'Definição de camada inexistente ou sem ID.',
      );

      ErrorManager.report(
        'layer',
        error,
        {
          operation: 'addLayerToMap',
        },
      );

      return false;
    }

    const sourceId = `src-${definition.id}`;

    const storedSource =
      this._sources.get(sourceId);

    /*
     * A source pode existir na memória, mas não existir no mapa após
     * uma troca de estilo. Sempre consultamos map.getSource().
     */
    if (!this._map.getSource(sourceId)) {
      const sourceData =
        storedSource?.data ||
        EMPTY_FEATURE_COLLECTION;

      const sourceAdded = this.addSource(
        sourceId,
        sourceData,
      );

      if (!sourceAdded) {
        return false;
      }
    }

    if (this._map.getLayer(definition.id)) {
      return true;
    }

    const layerConfig = {
      id: definition.id,
      source: sourceId,
      minzoom: definition.minZoom ?? 0,
      maxzoom: definition.maxZoom ?? 24,
      layout: {
        visibility:
          definition.visible !== false
            ? 'visible'
            : 'none',
      },
    };

    try {
      if (definition.geometryType === 'point') {
        this._map.addLayer({
          ...layerConfig,
          type: 'circle',
          paint: definition.paint || {},
        });
      } else if (
        definition.geometryType === 'linestring'
      ) {
        this._map.addLayer({
          ...layerConfig,
          type: 'line',
          paint: definition.paint || {},
        });
      } else {
        this._map.addLayer({
          ...layerConfig,
          type: 'fill',
          paint: definition.paint || {},
        });

        if (definition.paint?.['line-color']) {
          const outlineId =
            `${definition.id}-outline`;

          if (!this._map.getLayer(outlineId)) {
            this._map.addLayer({
              id: outlineId,
              source: sourceId,
              type: 'line',
              minzoom: definition.minZoom ?? 0,
              maxzoom: definition.maxZoom ?? 24,
              layout: {
                visibility:
                  definition.visible !== false
                    ? 'visible'
                    : 'none',
              },
              paint: {
                'line-color':
                  definition.paint['line-color'],

                'line-width':
                  definition.paint['line-width'] ??
                  1,

                'line-opacity':
                  definition.paint['line-opacity'] ??
                  0.8,

                ...(definition.paint[
                  'line-dasharray'
                ]
                  ? {
                      'line-dasharray':
                        definition.paint[
                          'line-dasharray'
                        ],
                    }
                  : {}),
              },
            });
          }
        }
      }

      if (definition.interactive) {
        this._attachClickHandler(definition);
      }

      this._applyOpacity(definition.id);

      return true;
    } catch (error) {
      console.error(
        `[LayerManager] Falha ao adicionar a camada "${definition.id}":`,
        error,
      );

      this.setError(
        definition.id,
        error,
        {
          operation: 'addLayerToMap',
        },
      );

      return false;
    }
  }

  /**
   * Remove handlers antigos de uma definição.
   */
  _detachClickHandler(layerId) {
    if (!this._map) {
      this._clickHandlers.delete(layerId);
      return;
    }

    const registration =
      this._clickHandlers.get(layerId);

    if (!registration) {
      return;
    }

    const {
      handler,
      mouseEnterHandler,
      mouseLeaveHandler,
      layerIds,
    } = registration;

    layerIds.forEach((mapLayerId) => {
      try {
        this._map.off(
          'click',
          mapLayerId,
          handler,
        );

        this._map.off(
          'mouseenter',
          mapLayerId,
          mouseEnterHandler,
        );

        this._map.off(
          'mouseleave',
          mapLayerId,
          mouseLeaveHandler,
        );
      } catch {
        // A camada pode já ter sido removida pelo MapLibre.
      }
    });

    this._clickHandlers.delete(layerId);
  }

  _attachClickHandler(definition) {
    if (!this._canUseMap()) {
      return;
    }

    this._detachClickHandler(definition.id);

    const layerIds = [
      definition.id,
      `${definition.id}-outline`,
    ].filter((layerId) =>
      Boolean(this._map.getLayer(layerId)),
    );

    if (layerIds.length === 0) {
      return;
    }

    const handler = (event) => {
      if (!event.features?.length) {
        return;
      }

      const feature = event.features[0];

      EventBus.emit('layer:click', {
        layerId: definition.id,
        feature,
        lngLat: event.lngLat,
      });
    };

    const mouseEnterHandler = () => {
      if (this._map?.getCanvas()) {
        this._map.getCanvas().style.cursor =
          'pointer';
      }
    };

    const mouseLeaveHandler = () => {
      if (this._map?.getCanvas()) {
        this._map.getCanvas().style.cursor = '';
      }
    };

    layerIds.forEach((layerId) => {
      this._map.on(
        'click',
        layerId,
        handler,
      );

      this._map.on(
        'mouseenter',
        layerId,
        mouseEnterHandler,
      );

      this._map.on(
        'mouseleave',
        layerId,
        mouseLeaveHandler,
      );
    });

    this._clickHandlers.set(
      definition.id,
      {
        handler,
        mouseEnterHandler,
        mouseLeaveHandler,
        layerIds,
      },
    );
  }

  /**
   * Atualiza os dados de uma camada.
   *
   * Os dados são armazenados mesmo se o mapa ainda não estiver pronto.
   */
  updateLayerData(layerId, geoJSON) {
    const definition =
      this._layers.get(layerId);

    if (!definition) {
      const error = new Error(
        `Camada não registrada: ${layerId}`,
      );

      console.error(
        '[LayerManager]',
        error.message,
      );

      ErrorManager.report(
        'layer',
        error,
        {
          operation: 'updateLayerData',
          layerId,
        },
      );

      return false;
    }

    const sourceId = `src-${layerId}`;
    const normalizedData =
      this._normalizeGeoJSON(geoJSON);

    /*
     * Guarda os dados mesmo que o mapa ainda esteja carregando.
     */
    this._sources.set(sourceId, {
      type: 'geojson',
      data: normalizedData,
    });

    if (!this._canUseMap()) {
      return false;
    }

    try {
      const existingSource =
        this._map.getSource(sourceId);

      if (existingSource?.setData) {
        existingSource.setData(
          normalizedData,
        );
      } else {
        this._map.addSource(sourceId, {
          type: 'geojson',
          data: normalizedData,
        });
      }

      if (!this._map.getLayer(layerId)) {
        const added =
          this.addLayerToMap(definition);

        if (!added) {
          return false;
        }
      }

      definition.lastUpdated = Date.now();
      definition.loading = false;
      definition.error = null;

      /*
       * Este evento informa à interface que a source foi atualizada.
       * MapView não deve responder a ele chamando updateLayerData outra vez.
       */
      EventBus.emit(
        EVENTS.LAYER_DATA_UPDATED,
        {
          layerId,
          data: normalizedData,
        },
      );

      return true;
    } catch (error) {
      this.setError(
        layerId,
        error,
        {
          operation: 'updateLayerData',
        },
      );

      return false;
    }
  }

  /**
   * Recria todas as sources e layers depois da troca de estilo.
   */
  restoreAllLayers() {
    if (!this._map) {
      return false;
    }

    this._styleChanging = false;

    if (!this._map.isStyleLoaded?.()) {
      return false;
    }

    for (const definition of this._layers.values()) {
      const sourceId =
        `src-${definition.id}`;

      const storedSource =
        this._sources.get(sourceId);

      /*
       * Não é necessário criar no mapa uma camada que nunca recebeu
       * dados, exceto quando ela já possuir dados armazenados.
       */
      if (!storedSource) {
        continue;
      }

      try {
        if (!this._map.getSource(sourceId)) {
          this._map.addSource(sourceId, {
            type: 'geojson',
            data:
              storedSource.data ||
              EMPTY_FEATURE_COLLECTION,
          });
        }

        if (!this._map.getLayer(definition.id)) {
          this.addLayerToMap(definition);
        }

        this.setVisibility(
          definition.id,
          definition.visible !== false,
          false,
        );
      } catch (error) {
        this.setError(
          definition.id,
          error,
          {
            operation: 'restoreAllLayers',
          },
        );
      }
    }

    return true;
  }

  setVisibility(
    layerId,
    visible,
    emitEvent = true,
  ) {
    const definition =
      this._layers.get(layerId);

    if (!definition) {
      return false;
    }

    definition.visible = Boolean(visible);

    if (this._canUseMap()) {
      const layerIds = [
        layerId,
        `${layerId}-outline`,
      ];

      layerIds.forEach((mapLayerId) => {
        if (this._map.getLayer(mapLayerId)) {
          this._map.setLayoutProperty(
            mapLayerId,
            'visibility',
            visible ? 'visible' : 'none',
          );
        }
      });
    }

    if (emitEvent) {
      EventBus.emit(
        EVENTS.LAYER_VISIBILITY_CHANGED,
        {
          layerId,
          visible: Boolean(visible),
        },
      );
    }

    return true;
  }

  _applyOpacity(layerId) {
    const definition =
      this._layers.get(layerId);

    if (!definition || !this._canUseMap()) {
      return;
    }

    const opacity =
      Number.isFinite(definition.opacity)
        ? definition.opacity
        : 1;

    const layerIds = [
      layerId,
      `${layerId}-outline`,
    ];

    layerIds.forEach((mapLayerId) => {
      const mapLayer =
        this._map.getLayer(mapLayerId);

      if (!mapLayer) {
        return;
      }

      if (mapLayer.type === 'fill') {
        const originalOpacity =
          definition.paint?.['fill-opacity'] ??
          0.5;

        this._map.setPaintProperty(
          mapLayerId,
          'fill-opacity',
          opacity * originalOpacity,
        );
      } else if (mapLayer.type === 'line') {
        const originalOpacity =
          definition.paint?.['line-opacity'] ??
          0.8;

        this._map.setPaintProperty(
          mapLayerId,
          'line-opacity',
          opacity * originalOpacity,
        );
      } else if (mapLayer.type === 'circle') {
        const originalOpacity =
          definition.paint?.[
            'circle-opacity'
          ] ?? 1;

        this._map.setPaintProperty(
          mapLayerId,
          'circle-opacity',
          opacity * originalOpacity,
        );

        if (
          definition.paint?.[
            'circle-stroke-opacity'
          ] !== undefined
        ) {
          this._map.setPaintProperty(
            mapLayerId,
            'circle-stroke-opacity',
            opacity *
              definition.paint[
                'circle-stroke-opacity'
              ],
          );
        }
      }
    });
  }

  setOpacity(layerId, opacity) {
    const definition =
      this._layers.get(layerId);

    if (!definition) {
      return false;
    }

    const numericOpacity =
      Number(opacity);

    definition.opacity = Math.min(
      1,
      Math.max(
        0,
        Number.isFinite(numericOpacity)
          ? numericOpacity
          : 1,
      ),
    );

    this._applyOpacity(layerId);

    return true;
  }

  removeLayer(layerId) {
    const definition =
      this._layers.get(layerId);

    if (!definition) {
      return false;
    }

    this._detachClickHandler(layerId);

    if (this._canUseMap()) {
      [
        layerId,
        `${layerId}-outline`,
      ].forEach((mapLayerId) => {
        if (this._map.getLayer(mapLayerId)) {
          this._map.removeLayer(mapLayerId);
        }
      });

      const sourceId = `src-${layerId}`;

      if (this._map.getSource(sourceId)) {
        this._map.removeSource(sourceId);
      }
    }

    this._layers.delete(layerId);
    this._sources.delete(
      `src-${layerId}`,
    );

    return true;
  }

  setError(layerId, error, context = {}) {
    const definition =
      this._layers.get(layerId);

    if (definition) {
      definition.error =
        error?.message || String(error);

      definition.loading = false;
    }

    ErrorManager.report(
      'layer',
      error,
      {
        layerId,
        ...context,
      },
    );
  }
}

export const LayerManager =
  new LayerManagerImpl();