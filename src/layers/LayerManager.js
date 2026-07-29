/**
 * LayerManager
 *
 * Gerencia todas as fontes e camadas operacionais do mapa.
 *
 * Responsabilidades:
 * - registrar definições de camadas;
 * - preservar dados GeoJSON em memória;
 * - criar sources e layers no MapLibre;
 * - separar propriedades paint por tipo de layer;
 * - restaurar as camadas após troca de estilo;
 * - controlar visibilidade e opacidade;
 * - registrar interações de clique;
 * - informar falhas ao ErrorManager.
 *
 * Nenhum componente React deve chamar diretamente:
 * - map.addSource();
 * - map.addLayer();
 * - map.removeLayer();
 * - source.setData().
 */

import {
  EventBus,
  EVENTS,
} from '../core/EventBus';

import { ErrorManager } from '../core/ErrorManager';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * Prefixos permitidos para cada tipo de layer do MapLibre.
 */
const PAINT_PREFIXES = {
  fill: ['fill-'],
  line: ['line-'],
  circle: ['circle-'],
  symbol: ['icon-', 'text-'],
  heatmap: ['heatmap-'],
  raster: ['raster-'],
  hillshade: ['hillshade-'],
  background: ['background-'],
};

/**
 * Retorna apenas as propriedades paint compatíveis
 * com o tipo de layer informado.
 */
function filterPaintByType(
  paint = {},
  layerType,
) {
  if (
    !paint ||
    typeof paint !== 'object' ||
    Array.isArray(paint)
  ) {
    return {};
  }

  const prefixes =
    PAINT_PREFIXES[layerType] || [];

  return Object.fromEntries(
    Object.entries(paint).filter(([key]) =>
      prefixes.some((prefix) =>
        key.startsWith(prefix),
      ),
    ),
  );
}

/**
 * Retorna apenas propriedades layout apropriadas.
 *
 * Propriedades específicas de símbolos são mantidas
 * apenas para layers do tipo symbol.
 */
function normalizeLayout(
  layout = {},
  layerType,
  visible = true,
) {
  const normalized = {
    visibility: visible
      ? 'visible'
      : 'none',
  };

  if (
    !layout ||
    typeof layout !== 'object' ||
    Array.isArray(layout)
  ) {
    return normalized;
  }

  if (layerType === 'symbol') {
    return {
      ...layout,
      ...normalized,
    };
  }

  /*
   * Para layers que não são symbol, preservamos
   * apenas propriedades comuns e compatíveis.
   */
  const allowedCommonProperties = [
    'visibility',
    'line-cap',
    'line-join',
    'line-miter-limit',
    'line-round-limit',
  ];

  for (const property of allowedCommonProperties) {
    if (layout[property] !== undefined) {
      normalized[property] =
        layout[property];
    }
  }

  normalized.visibility = visible
    ? 'visible'
    : 'none';

  return normalized;
}

function hasFeatures(data) {
  return (
    data?.type === 'FeatureCollection' &&
    Array.isArray(data.features) &&
    data.features.length > 0
  );
}

function countFeatures(data) {
  return Array.isArray(data?.features)
    ? data.features.length
    : 0;
}

class LayerManagerImpl {
  constructor() {
    this._map = null;

    /**
     * ID da camada -> definição e estado.
     */
    this._layers = new Map();

    /**
     * ID da source -> configuração e dados GeoJSON.
     */
    this._sources = new Map();

    /**
     * ID da definição -> handlers usados pelo MapLibre.
     */
    this._clickHandlers = new Map();

    /**
     * Indica que map.setStyle() está em andamento.
     */
    this._styleChanging = false;

    /**
     * Evita restaurações simultâneas.
     */
    this._restoring = false;
  }

  /**
   * Associa uma instância MapLibre ao gerenciador.
   */
  setMap(map) {
    if (!map) {
      return false;
    }

    if (
      this._map &&
      this._map !== map
    ) {
      this._detachAllClickHandlers();
    }

    this._map = map;
    this._styleChanging = false;

    return true;
  }

  /**
   * Remove a referência ao mapa sem apagar
   * registros e dados armazenados.
   */
  clearMap(expectedMap = null) {
    if (
      expectedMap &&
      this._map &&
      expectedMap !== this._map
    ) {
      return false;
    }

    this._detachAllClickHandlers();

    this._map = null;
    this._styleChanging = false;
    this._restoring = false;

    return true;
  }

  /**
   * Informa se o mapa pode receber sources e layers.
   */
  isReady() {
    return this._canUseMap();
  }

  /**
   * Prepara o gerenciador para map.setStyle().
   *
   * O novo estilo apagará sources e layers do mapa,
   * mas os dados continuam preservados em _sources.
   */
  prepareForStyleChange() {
    this._styleChanging = true;
    this._detachAllClickHandlers();
  }

  /**
   * Registra uma definição de camada.
   */
  register(definition) {
    if (!definition?.id) {
      const error = new Error(
        'Tentativa de registrar camada sem ID.',
      );

      console.error(
        '[LayerManager]',
        error.message,
        definition,
      );

      ErrorManager.report(
        'layer',
        error,
        {
          operation: 'register',
        },
      );

      return null;
    }

    const existing =
      this._layers.get(definition.id);

    const registeredLayer = {
      ...existing,
      ...definition,

      visible:
        existing?.visible ??
        definition.defaultVisible ??
        definition.visible ??
        true,

      opacity:
        existing?.opacity ??
        definition.opacity ??
        1,

      loading:
        existing?.loading ??
        false,

      error:
        existing?.error ??
        null,

      lastUpdated:
        existing?.lastUpdated ??
        null,
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

  /**
   * Registra múltiplas definições.
   */
  registerAll(definitions = []) {
    if (!Array.isArray(definitions)) {
      const error = new Error(
        'registerAll recebeu um valor que não é uma lista.',
      );

      console.error(
        '[LayerManager]',
        error.message,
        definitions,
      );

      ErrorManager.report(
        'layer',
        error,
        {
          operation: 'registerAll',
        },
      );

      return false;
    }

    definitions.forEach((definition) => {
      this.register(definition);
    });

    return true;
  }

  getLayer(id) {
    return this._layers.get(id);
  }

  getAllLayers() {
    return Array.from(
      this._layers.values(),
    );
  }

  getLayersByGroup() {
    const groups = new Map();

    for (const layer of this._layers.values()) {
      const groupName =
        layer.group || 'Outros';

      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }

      groups.get(groupName).push(layer);
    }

    return groups;
  }

  /**
   * Verifica se a instância do MapLibre pode
   * receber operações de estilo.
   */
  _canUseMap() {
    if (
      !this._map ||
      this._styleChanging
    ) {
      return false;
    }

    try {
      const style =
        this._map.getStyle?.();

      return Boolean(
        style &&
          Number(style.version) === 8 &&
          Array.isArray(style.layers),
      );
    } catch {
      return false;
    }
  }

  /**
   * Normaliza valores aceitos pelo MapLibre.
   */
  _normalizeGeoJSON(data) {
    if (
      !data ||
      typeof data !== 'object'
    ) {
      return {
        type: 'FeatureCollection',
        features: [],
      };
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

    if (
      typeof data.type === 'string' &&
      Array.isArray(data.coordinates)
    ) {
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: data,
          },
        ],
      };
    }

    console.warn(
      '[LayerManager] GeoJSON inválido recebido:',
      data,
    );

    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  /**
   * Identifica o tipo de layer MapLibre com base
   * na definição arquitetural.
   */
  _resolveMapLayerType(definition) {
    if (definition.mapLayerType) {
      return definition.mapLayerType;
    }

    const geometryType = String(
      definition.geometryType || '',
    ).toLowerCase();

    switch (geometryType) {
      case 'point':
      case 'multipoint':
        return definition.symbol
          ? 'symbol'
          : 'circle';

      case 'linestring':
      case 'multilinestring':
      case 'line':
        return 'line';

      case 'polygon':
      case 'multipolygon':
      case 'fill':
      default:
        return 'fill';
    }
  }

  /**
   * Monta a configuração básica de uma layer.
   */
  _createBaseLayerConfig(
    definition,
    sourceId,
    layerType,
  ) {
    const config = {
      id: definition.id,
      source: sourceId,
      type: layerType,

      minzoom:
        definition.minZoom ??
        definition.minzoom ??
        0,

      maxzoom:
        definition.maxZoom ??
        definition.maxzoom ??
        24,

      layout: normalizeLayout(
        definition.layout,
        layerType,
        definition.visible !== false,
      ),

      paint: filterPaintByType(
        definition.paint,
        layerType,
      ),
    };

    if (definition.filter) {
      config.filter = definition.filter;
    }

    if (definition.sourceLayer) {
      config['source-layer'] =
        definition.sourceLayer;
    }

    return config;
  }

  /**
   * Monta a layer de contorno para polígonos.
   */
  _createOutlineLayerConfig(
    definition,
    sourceId,
  ) {
    const linePaint =
      filterPaintByType(
        definition.paint,
        'line',
      );

    if (
      Object.keys(linePaint).length === 0
    ) {
      return null;
    }

    const outlineConfig = {
      id: `${definition.id}-outline`,
      source: sourceId,
      type: 'line',

      minzoom:
        definition.minZoom ??
        definition.minzoom ??
        0,

      maxzoom:
        definition.maxZoom ??
        definition.maxzoom ??
        24,

      layout: normalizeLayout(
        definition.layout,
        'line',
        definition.visible !== false,
      ),

      paint: linePaint,
    };

    if (definition.filter) {
      outlineConfig.filter =
        definition.filter;
    }

    if (definition.sourceLayer) {
      outlineConfig['source-layer'] =
        definition.sourceLayer;
    }

    return outlineConfig;
  }

  /**
   * Armazena e cria ou atualiza uma source.
   */
  addSource(sourceId, data) {
    const normalizedData =
      this._normalizeGeoJSON(data);

    /*
     * O dado é preservado mesmo quando
     * o estilo ainda não está pronto.
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
      } else if (!existingSource) {
        this._map.addSource(sourceId, {
          type: 'geojson',
          data: normalizedData,
        });
      }

      return Boolean(
        this._map.getSource(sourceId),
      );
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
          featureCount:
            countFeatures(normalizedData),
        },
      );

      return false;
    }
  }

  /**
   * Cria a layer principal e, quando necessário,
   * a layer de contorno.
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

    const sourceId =
      `src-${definition.id}`;

    const storedSource =
      this._sources.get(sourceId);

    try {
      if (!this._map.getSource(sourceId)) {
        const sourceData =
          storedSource?.data ||
          EMPTY_FEATURE_COLLECTION;

        const sourceAdded =
          this.addSource(
            sourceId,
            sourceData,
          );

        if (!sourceAdded) {
          throw new Error(
            `Não foi possível criar a source "${sourceId}".`,
          );
        }
      }

      const layerType =
        this._resolveMapLayerType(
          definition,
        );

      /*
       * Agora cada tipo recebe somente propriedades
       * paint compatíveis:
       *
       * fill   -> fill-*
       * line   -> line-*
       * circle -> circle-*
       */
      if (!this._map.getLayer(definition.id)) {
        const mainLayerConfig =
          this._createBaseLayerConfig(
            definition,
            sourceId,
            layerType,
          );

        this._map.addLayer(
          mainLayerConfig,
        );
      }

      /*
       * Polígonos podem possuir uma segunda layer
       * exclusiva para o contorno.
       */
      if (layerType === 'fill') {
        const outlineConfig =
          this._createOutlineLayerConfig(
            definition,
            sourceId,
          );

        if (
          outlineConfig &&
          !this._map.getLayer(
            outlineConfig.id,
          )
        ) {
          this._map.addLayer(
            outlineConfig,
          );
        }
      }

      if (definition.interactive) {
        this._attachClickHandler(
          definition,
        );
      }

      this._applyOpacity(
        definition.id,
      );

      definition.loading = false;
      definition.error = null;

      return Boolean(
        this._map.getLayer(
          definition.id,
        ),
      );
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
          sourceId,
          geometryType:
            definition.geometryType,
        },
      );

      return false;
    }
  }

  /**
   * Atualiza os dados associados a uma camada.
   *
   * O GeoJSON é sempre armazenado, mesmo que
   * o mapa ainda não esteja pronto.
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
          operation:
            'updateLayerData',
          layerId,
        },
      );

      return false;
    }

    const sourceId =
      `src-${layerId}`;

    const normalizedData =
      this._normalizeGeoJSON(
        geoJSON,
      );

    /*
     * Preserva o dado imediatamente.
     */
    this._sources.set(sourceId, {
      type: 'geojson',
      data: normalizedData,
    });

    definition.loading = true;

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

      if (
        !this._map.getLayer(layerId)
      ) {
        const added =
          this.addLayerToMap(
            definition,
          );

        if (!added) {
          return false;
        }
      } else if (
        definition.interactive &&
        !this._clickHandlers.has(
          definition.id,
        )
      ) {
        this._attachClickHandler(
          definition,
        );
      }

      definition.lastUpdated =
        Date.now();

      definition.loading = false;
      definition.error = null;

      EventBus.emit(
        EVENTS.LAYER_DATA_UPDATED,
        {
          layerId,
          data: normalizedData,
          featureCount:
            countFeatures(normalizedData),
        },
      );

      return true;
    } catch (error) {
      this.setError(
        layerId,
        error,
        {
          operation:
            'updateLayerData',
          sourceId,
          featureCount:
            countFeatures(normalizedData),
        },
      );

      return false;
    }
  }

  /**
   * Recria todas as sources e layers depois
   * de uma troca de estilo.
   */
  restoreAllLayers() {
    if (
      !this._map ||
      this._restoring
    ) {
      return false;
    }

    this._styleChanging = false;

    if (!this._canUseMap()) {
      return false;
    }

    this._restoring = true;

    let restoredCount = 0;
    let failedCount = 0;

    try {
      for (
        const definition
        of this._layers.values()
      ) {
        const sourceId =
          `src-${definition.id}`;

        const storedSource =
          this._sources.get(sourceId);

        /*
         * Não cria uma source para uma camada
         * que nunca recebeu dados.
         */
        if (!storedSource) {
          continue;
        }

        try {
          if (
            !this._map.getSource(
              sourceId,
            )
          ) {
            this._map.addSource(
              sourceId,
              {
                type: 'geojson',
                data:
                  storedSource.data ||
                  EMPTY_FEATURE_COLLECTION,
              },
            );
          } else {
            const mapSource =
              this._map.getSource(
                sourceId,
              );

            mapSource?.setData?.(
              storedSource.data ||
              EMPTY_FEATURE_COLLECTION,
            );
          }

          const added =
            this.addLayerToMap(
              definition,
            );

          if (!added) {
            failedCount += 1;
            continue;
          }

          this.setVisibility(
            definition.id,
            definition.visible !== false,
            false,
          );

          this._applyOpacity(
            definition.id,
          );

          restoredCount += 1;
        } catch (error) {
          failedCount += 1;

          this.setError(
            definition.id,
            error,
            {
              operation:
                'restoreAllLayers',
            },
          );
        }
      }

      return failedCount === 0;
    } finally {
      this._restoring = false;

      console.info(
        '[LayerManager] Restauração concluída:',
        {
          restoredCount,
          failedCount,
        },
      );
    }
  }

  /**
   * Remove um handler de clique e cursor.
   */
  _detachClickHandler(layerId) {
    const registration =
      this._clickHandlers.get(
        layerId,
      );

    if (!registration) {
      return;
    }

    if (!this._map) {
      this._clickHandlers.delete(
        layerId,
      );

      return;
    }

    const {
      handler,
      mouseEnterHandler,
      mouseLeaveHandler,
      layerIds,
    } = registration;

    layerIds.forEach(
      (mapLayerId) => {
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
          /*
           * A layer pode ter sido removida
           * durante troca de estilo.
           */
        }
      },
    );

    this._clickHandlers.delete(
      layerId,
    );
  }

  _detachAllClickHandlers() {
    const layerIds = Array.from(
      this._clickHandlers.keys(),
    );

    layerIds.forEach((layerId) => {
      this._detachClickHandler(
        layerId,
      );
    });

    this._clickHandlers.clear();
  }

  /**
   * Registra eventos de clique nas layers
   * existentes no estilo.
   */
  _attachClickHandler(definition) {
    if (!this._canUseMap()) {
      return false;
    }

    this._detachClickHandler(
      definition.id,
    );

    const layerIds = [
      definition.id,
      `${definition.id}-outline`,
    ].filter((mapLayerId) =>
      Boolean(
        this._map.getLayer(mapLayerId),
      ),
    );

    if (layerIds.length === 0) {
      return false;
    }

    const handler = (event) => {
      if (!event.features?.length) {
        return;
      }

      const feature =
        event.features[0];

      EventBus.emit(
        'layer:click',
        {
          layerId: definition.id,
          feature,
          lngLat: event.lngLat,
        },
      );
    };

    const mouseEnterHandler = () => {
      const canvas =
        this._map?.getCanvas?.();

      if (canvas) {
        canvas.style.cursor =
          'pointer';
      }
    };

    const mouseLeaveHandler = () => {
      const canvas =
        this._map?.getCanvas?.();

      if (canvas) {
        canvas.style.cursor = '';
      }
    };

    layerIds.forEach(
      (mapLayerId) => {
        this._map.on(
          'click',
          mapLayerId,
          handler,
        );

        this._map.on(
          'mouseenter',
          mapLayerId,
          mouseEnterHandler,
        );

        this._map.on(
          'mouseleave',
          mapLayerId,
          mouseLeaveHandler,
        );
      },
    );

    this._clickHandlers.set(
      definition.id,
      {
        handler,
        mouseEnterHandler,
        mouseLeaveHandler,
        layerIds,
      },
    );

    return true;
  }

  /**
   * Altera a visibilidade da layer principal
   * e de seu contorno.
   */
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

    definition.visible =
      Boolean(visible);

    if (this._canUseMap()) {
      const mapLayerIds = [
        layerId,
        `${layerId}-outline`,
      ];

      mapLayerIds.forEach(
        (mapLayerId) => {
          if (
            this._map.getLayer(
              mapLayerId,
            )
          ) {
            this._map.setLayoutProperty(
              mapLayerId,
              'visibility',
              visible
                ? 'visible'
                : 'none',
            );
          }
        },
      );
    }

    if (emitEvent) {
      EventBus.emit(
        EVENTS.LAYER_VISIBILITY_CHANGED,
        {
          layerId,
          visible:
            Boolean(visible),
        },
      );
    }

    return true;
  }

  /**
   * Aplica a opacidade relativa definida pelo usuário.
   */
  _applyOpacity(layerId) {
    const definition =
      this._layers.get(layerId);

    if (
      !definition ||
      !this._canUseMap()
    ) {
      return;
    }

    const opacity =
      Number.isFinite(
        definition.opacity,
      )
        ? Math.min(
            1,
            Math.max(
              0,
              definition.opacity,
            ),
          )
        : 1;

    const layerIds = [
      layerId,
      `${layerId}-outline`,
    ];

    layerIds.forEach(
      (mapLayerId) => {
        const mapLayer =
          this._map.getLayer(
            mapLayerId,
          );

        if (!mapLayer) {
          return;
        }

        try {
          if (
            mapLayer.type === 'fill'
          ) {
            const originalOpacity =
              definition.paint?.[
                'fill-opacity'
              ] ?? 0.5;

            this._map.setPaintProperty(
              mapLayerId,
              'fill-opacity',
              opacity *
                originalOpacity,
            );
          }

          if (
            mapLayer.type === 'line'
          ) {
            const originalOpacity =
              definition.paint?.[
                'line-opacity'
              ] ?? 0.8;

            this._map.setPaintProperty(
              mapLayerId,
              'line-opacity',
              opacity *
                originalOpacity,
            );
          }

          if (
            mapLayer.type === 'circle'
          ) {
            const originalOpacity =
              definition.paint?.[
                'circle-opacity'
              ] ?? 1;

            this._map.setPaintProperty(
              mapLayerId,
              'circle-opacity',
              opacity *
                originalOpacity,
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

          if (
            mapLayer.type === 'symbol'
          ) {
            if (
              definition.paint?.[
                'icon-opacity'
              ] !== undefined
            ) {
              this._map.setPaintProperty(
                mapLayerId,
                'icon-opacity',
                opacity *
                  definition.paint[
                    'icon-opacity'
                  ],
              );
            }

            if (
              definition.paint?.[
                'text-opacity'
              ] !== undefined
            ) {
              this._map.setPaintProperty(
                mapLayerId,
                'text-opacity',
                opacity *
                  definition.paint[
                    'text-opacity'
                  ],
              );
            }
          }
        } catch (error) {
          console.warn(
            `[LayerManager] Não foi possível aplicar opacidade em "${mapLayerId}":`,
            error,
          );
        }
      },
    );
  }

  /**
   * Define a opacidade relativa de uma camada.
   */
  setOpacity(layerId, opacity) {
    const definition =
      this._layers.get(layerId);

    if (!definition) {
      return false;
    }

    const numericOpacity =
      Number(opacity);

    definition.opacity =
      Math.min(
        1,
        Math.max(
          0,
          Number.isFinite(
            numericOpacity,
          )
            ? numericOpacity
            : 1,
        ),
      );

    this._applyOpacity(layerId);

    return true;
  }

  /**
   * Remove uma camada, seu contorno, sua source
   * e seu registro.
   */
  removeLayer(layerId) {
    const definition =
      this._layers.get(layerId);

    if (!definition) {
      return false;
    }

    this._detachClickHandler(
      layerId,
    );

    if (this._canUseMap()) {
      [
        `${layerId}-outline`,
        layerId,
      ].forEach((mapLayerId) => {
        try {
          if (
            this._map.getLayer(
              mapLayerId,
            )
          ) {
            this._map.removeLayer(
              mapLayerId,
            );
          }
        } catch (error) {
          console.warn(
            `[LayerManager] Falha ao remover "${mapLayerId}":`,
            error,
          );
        }
      });

      const sourceId =
        `src-${layerId}`;

      try {
        if (
          this._map.getSource(
            sourceId,
          )
        ) {
          this._map.removeSource(
            sourceId,
          );
        }
      } catch (error) {
        console.warn(
          `[LayerManager] Falha ao remover source "${sourceId}":`,
          error,
        );
      }
    }

    this._layers.delete(layerId);

    this._sources.delete(
      `src-${layerId}`,
    );

    return true;
  }

  /**
   * Define estado de erro para uma camada.
   */
  setError(
    layerId,
    error,
    context = {},
  ) {
    const normalizedError =
      error instanceof Error
        ? error
        : new Error(
            error?.message ||
            String(error),
          );

    const definition =
      this._layers.get(layerId);

    if (definition) {
      definition.error =
        normalizedError.message;

      definition.loading = false;
    }

    ErrorManager.report(
      'layer',
      normalizedError,
      {
        layerId,
        ...context,
      },
    );
  }

  /**
   * Informações resumidas úteis para diagnóstico.
   */
  getDiagnosticState() {
    return {
      mapConnected:
        Boolean(this._map),

      mapReady:
        this._canUseMap(),

      styleChanging:
        this._styleChanging,

      restoring:
        this._restoring,

      registeredLayers:
        this._layers.size,

      storedSources:
        this._sources.size,

      layers: Array.from(
        this._layers.values(),
      ).map((definition) => {
        const sourceId =
          `src-${definition.id}`;

        const storedSource =
          this._sources.get(
            sourceId,
          );

        return {
          id: definition.id,
          visible:
            definition.visible !== false,

          featureCount:
            countFeatures(
              storedSource?.data,
            ),

          hasFeatures:
            hasFeatures(
              storedSource?.data,
            ),

          sourceCreated:
            Boolean(
              this._map?.getSource?.(
                sourceId,
              ),
            ),

          layerCreated:
            Boolean(
              this._map?.getLayer?.(
                definition.id,
              ),
            ),

          outlineCreated:
            Boolean(
              this._map?.getLayer?.(
                `${definition.id}-outline`,
              ),
            ),

          error:
            definition.error ||
            null,

          lastUpdated:
            definition.lastUpdated ||
            null,
        };
      }),
    };
  }
}

export const LayerManager =
  new LayerManagerImpl();