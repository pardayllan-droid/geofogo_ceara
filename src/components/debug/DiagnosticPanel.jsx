/**
 * DiagnosticPanel
 *
 * Painel de diagnóstico do GeoFogo Ceará.
 *
 * Responsabilidades:
 * - mostrar o estado geral da aplicação;
 * - mostrar quantidades armazenadas no AppCore;
 * - inspecionar sources e layers do LayerManager;
 * - consultar o estado real das layers no MapLibre;
 * - contar feições renderizadas na área visível;
 * - mostrar amostras de geometria e coordenadas;
 * - listar erros registrados;
 * - permitir copiar ou baixar o relatório.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { createPortal } from 'react-dom';

import {
  AlertTriangle,
  Bug,
  Check,
  Clipboard,
  Download,
  RefreshCw,
  X,
} from 'lucide-react';

import { AppCore } from '../../core/AppCore';
import { config } from '../../core/config';
import { describeCacheStatus, formatCacheDuration } from '../../core/CachePolicy';
import { ErrorManager } from '../../core/ErrorManager';
import { LayerManager } from '../../layers/LayerManager';

const REFRESH_INTERVAL_MS = 3000;

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * Converte diferentes formatos de dados em quantidade
 * de feições.
 */
function countFeatures(data) {
  if (!data) {
    return 0;
  }

  if (
    data.type === 'FeatureCollection' &&
    Array.isArray(data.features)
  ) {
    return data.features.length;
  }

  if (data.type === 'Feature') {
    return 1;
  }

  if (Array.isArray(data)) {
    return data.length;
  }

  return 0;
}

/**
 * Formata data e hora para pt-BR.
 */
function formatDateTime(value) {
  if (!value) {
    return 'Nunca';
  }

  try {
    const date =
      value instanceof Date
        ? value
        : new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return 'Não disponível';
    }

    return date.toLocaleString(
      'pt-BR',
    );
  } catch {
    return 'Não disponível';
  }
}

/**
 * Formata valores booleanos.
 */
function yesNo(value) {
  return value ? 'sim' : 'não';
}

/**
 * Protege o relatório contra objetos circulares.
 */
function safeJson(
  value,
  fallback = 'não disponível',
) {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  try {
    return JSON.stringify(
      value,
    );
  } catch {
    return fallback;
  }
}

/**
 * Retorna somente uma pequena amostra das coordenadas.
 *
 * Isso evita que o relatório fique enorme quando a
 * geometria é Polygon ou MultiPolygon.
 */
function getCoordinateSample(
  coordinates,
  depth = 0,
) {
  if (
    coordinates === null ||
    coordinates === undefined
  ) {
    return null;
  }

  if (
    !Array.isArray(
      coordinates,
    )
  ) {
    return coordinates;
  }

  /*
   * Par de coordenadas:
   * [longitude, latitude]
   */
  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] ===
      'number' &&
    typeof coordinates[1] ===
      'number'
  ) {
    return [
      coordinates[0],
      coordinates[1],
    ];
  }

  if (
    coordinates.length === 0
  ) {
    return [];
  }

  /*
   * Limita a profundidade apenas como proteção.
   */
  if (depth >= 6) {
    return '[estrutura profunda]';
  }

  return getCoordinateSample(
    coordinates[0],
    depth + 1,
  );
}

/**
 * Verifica se uma coordenada parece estar dentro
 * da região aproximada do Ceará.
 */
function evaluateCoordinate(
  coordinate,
) {
  if (
    !Array.isArray(coordinate) ||
    coordinate.length < 2
  ) {
    return {
      valid: false,
      message:
        'Coordenada não encontrada.',
    };
  }

  const longitude =
    Number(coordinate[0]);

  const latitude =
    Number(coordinate[1]);

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    return {
      valid: false,
      message:
        'Coordenada não numérica.',
    };
  }

  const insideCearaApprox =
    longitude >= -42.5 &&
    longitude <= -36.5 &&
    latitude >= -9 &&
    latitude <= -2;

  const apparentlyInverted =
    latitude >= -42.5 &&
    latitude <= -36.5 &&
    longitude >= -9 &&
    longitude <= -2;

  if (apparentlyInverted) {
    return {
      valid: false,
      message:
        'Possível inversão entre latitude e longitude.',
    };
  }

  if (!insideCearaApprox) {
    return {
      valid: false,
      message:
        'Coordenada fora da região aproximada do Ceará.',
    };
  }

  return {
    valid: true,
    message:
      'Coordenada compatível com o Ceará.',
  };
}

/**
 * Obtém a source armazenada internamente
 * pelo LayerManager.
 */
function getStoredSource(
  sourceId,
) {
  return (
    LayerManager._sources?.get?.(
      sourceId,
    ) || null
  );
}

/**
 * Obtém os dados de uma source.
 *
 * O MapLibre normalmente preserva o GeoJSON original
 * em _data, mas usamos também o armazenamento interno
 * do LayerManager como alternativa.
 */
function getSourceData(
  map,
  sourceId,
) {
  const mapSource =
    map?.getSource?.(
      sourceId,
    );

  const storedSource =
    getStoredSource(
      sourceId,
    );

  return (
    mapSource?._data ||
    storedSource?.data ||
    EMPTY_FEATURE_COLLECTION
  );
}

/**
 * Extrai uma amostra da primeira feição da source.
 */
function getSourceSample(
  map,
  sourceId,
) {
  const data =
    getSourceData(
      map,
      sourceId,
    );

  const feature =
    data?.features?.[0] ||
    null;

  const coordinate =
    getCoordinateSample(
      feature?.geometry
        ?.coordinates,
    );

  return {
    exists: Boolean(
      map?.getSource?.(
        sourceId,
      ) ||
        getStoredSource(
          sourceId,
        ),
    ),

    featureCount:
      countFeatures(data),

    geometryType:
      feature?.geometry?.type ||
      null,

    coordinate,

    coordinateEvaluation:
      evaluateCoordinate(
        coordinate,
      ),

    properties:
      feature?.properties ||
      null,
  };
}

/**
 * Consulta o estado real da layer no MapLibre.
 */
function getLayerRuntimeInfo(
  map,
  layerId,
) {
  const emptyResult = {
    exists: false,
    type: null,
    source: null,
    visibility:
      'camada inexistente',
    minzoom: null,
    maxzoom: null,
    renderedCount: 0,
    renderedQueryError: null,
    paint: {},
  };

  if (!map) {
    return {
      ...emptyResult,
      visibility:
        'mapa indisponível',
    };
  }

  let layer = null;

  try {
    layer =
      map.getLayer?.(
        layerId,
      ) || null;
  } catch {
    layer = null;
  }

  if (!layer) {
    return emptyResult;
  }

  let renderedCount = 0;
  let renderedQueryError =
    null;

  try {
    /*
     * Sem geometry/bbox, o MapLibre consulta
     * toda a viewport atual.
     */
    renderedCount =
      map.queryRenderedFeatures?.(
        undefined,
        {
          layers: [
            layerId,
          ],
        },
      )?.length || 0;
  } catch (firstError) {
    /*
     * Algumas versões aceitam apenas o objeto
     * com a lista de layers.
     */
    try {
      renderedCount =
        map.queryRenderedFeatures?.(
          {
            layers: [
              layerId,
            ],
          },
        )?.length || 0;
    } catch (secondError) {
      renderedCount = -1;

      renderedQueryError =
        secondError?.message ||
        firstError?.message ||
        String(secondError);
    }
  }

  let visibility =
    'visible';

  try {
    visibility =
      map.getLayoutProperty?.(
        layerId,
        'visibility',
      ) || 'visible';
  } catch {
    visibility =
      layer.layout
        ?.visibility ||
      'visible';
  }

  const paint = {};

  const paintProperties = [
    'fill-color',
    'fill-opacity',
    'line-color',
    'line-width',
    'line-opacity',
    'circle-radius',
    'circle-color',
    'circle-opacity',
    'circle-stroke-color',
    'circle-stroke-width',
    'circle-stroke-opacity',
    'icon-opacity',
    'text-opacity',
  ];

  paintProperties.forEach(
    (property) => {
      try {
        const value =
          map.getPaintProperty?.(
            layerId,
            property,
          );

        if (
          value !== undefined
        ) {
          paint[property] =
            value;
        }
      } catch {
        // Propriedade incompatível com o tipo.
      }
    },
  );

  return {
    exists: true,
    type:
      layer.type || null,

    source:
      layer.source || null,

    visibility,

    minzoom:
      layer.minzoom ??
      null,

    maxzoom:
      layer.maxzoom ??
      null,

    renderedCount,
    renderedQueryError,
    paint,
  };
}

/**
 * Obtém erros de diferentes versões possíveis
 * do ErrorManager.
 */
function getRegisteredErrors() {
  try {
    const fromMethod =
      ErrorManager.getErrors?.();

    if (
      Array.isArray(
        fromMethod,
      )
    ) {
      return fromMethod;
    }

    const fromAll =
      ErrorManager.getAll?.();

    if (
      Array.isArray(
        fromAll,
      )
    ) {
      return fromAll;
    }

    if (
      Array.isArray(
        ErrorManager.errors,
      )
    ) {
      return ErrorManager.errors;
    }

    if (
      Array.isArray(
        ErrorManager._errors,
      )
    ) {
      return ErrorManager._errors;
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Obtém informações do resultado mais recente
 * da sincronização.
 */
function normalizeSyncResult(
  syncResult,
) {
  const completed =
    syncResult?.completed ||
    syncResult?.succeeded ||
    syncResult?.success ||
    syncResult?.successful ||
    [];

  const failed =
    syncResult?.failed ||
    syncResult?.errors ||
    [];

  return {
    completed:
      Array.isArray(completed)
        ? completed
        : Object.keys(
            completed || {},
          ),

    failed:
      Array.isArray(failed)
        ? failed
        : Object.keys(
            failed || {},
          ),
  };
}

/**
 * Cria um retrato completo do estado da aplicação.
 */
function collectDiagnosticData({
  syncState,
  syncing,
  syncMessage,
  syncResult,
}) {
  const map =
    LayerManager._map ||
    LayerManager.getMap?.() ||
    null;

  const layers =
    LayerManager.getAllLayers?.() ||
    [];

  const normalizedSync =
    normalizeSyncResult(
      syncResult,
    );

  const isStandalone =
    typeof window !==
      'undefined' &&
    (
      window.matchMedia?.(
        '(display-mode: standalone)',
      )?.matches ||
      window.navigator
        ?.standalone === true
    );

  const runtime = {
    fireEvents:
      getLayerRuntimeInfo(
        map,
        'fire-events',
      ),

    fireEventsOutline:
      getLayerRuntimeInfo(
        map,
        'fire-events-outline',
      ),

    fireMarkers:
      getLayerRuntimeInfo(
        map,
        'fire-events-markers',
      ),

    fireFronts:
      getLayerRuntimeInfo(
        map,
        'fire-fronts',
      ),

    municipalities:
      getLayerRuntimeInfo(
        map,
        'municipalities',
      ),

    conservationUnits:
      getLayerRuntimeInfo(
        map,
        'conservation-units',
      ),

    indigenousLands:
    getLayerRuntimeInfo(
      map,
      'indigenous-lands',
    ),
  };

  const sourceSamples = {
    fireEvents:
      getSourceSample(
        map,
        'src-fire-events',
      ),

    fireMarkers:
      getSourceSample(
        map,
        'src-fire-events-markers',
      ),

    fireFronts:
      getSourceSample(
        map,
        'src-fire-fronts',
      ),
  };

  let mapZoom = null;
  let mapCenter = null;
  let mapBounds = null;
  let styleLoaded = false;

  if (map) {
    try {
      mapZoom =
        map.getZoom?.() ??
        null;
    } catch {
      mapZoom = null;
    }

    try {
      const center =
        map.getCenter?.();

      if (center) {
        mapCenter = [
          center.lng,
          center.lat,
        ];
      }
    } catch {
      mapCenter = null;
    }

    try {
      const bounds =
        map.getBounds?.();

      if (bounds) {
        mapBounds = {
          west:
            bounds.getWest?.(),
          south:
            bounds.getSouth?.(),
          east:
            bounds.getEast?.(),
          north:
            bounds.getNorth?.(),
        };
      }
    } catch {
      mapBounds = null;
    }

    try {
      styleLoaded =
        Boolean(
          map.isStyleLoaded?.(),
        );
    } catch {
      styleLoaded = false;
    }
  }

  const stats =
    AppCore.getStats?.() ||
    null;

  const sensitiveSummary =
    AppCore
      .getSensitiveAreaSummary
      ?.() ||
    {
      total:
        countFeatures(
          AppCore.sensitiveAreas,
        ),

      byType:
        {},
    };

  const cacheRecords =
    AppCore.cacheRecords ||
    {};

  const cache = {
    boundary:
      describeCacheStatus(
        cacheRecords.boundary,
        'boundary',
      ),

    municipalities:
      describeCacheStatus(
        cacheRecords.municipalities,
        'municipalities',
      ),

    conservationUnits:
      describeCacheStatus(
        cacheRecords.conservationUnits,
        'conservationUnits',
      ),

    indigenousLands:
      describeCacheStatus(
        cacheRecords.indigenousLands,
        'indigenousLands',
      ),
  };

  const refreshMinutes =
    Number(
      config.fireRefreshMinutes,
    ) ||
    60;

  const lastUpdated =
    Number(
      stats?.lastUpdated,
    ) ||
    null;

  const nextDynamicRefresh =
    lastUpdated
      ? lastUpdated +
        refreshMinutes *
          60 *
          1000
      : null;

  return {
    generatedAt:
      new Date(),

    application: {
      initialized:
        Boolean(
          AppCore.initialized,
        ),

      mapConnected:
        Boolean(
          map &&
            LayerManager.isReady?.(),
        ),

      online:
        typeof navigator ===
          'undefined'
          ? true
          : navigator.onLine,

      installed:
        Boolean(
          isStandalone,
        ),

      syncState:
        syncState ||
        'desconhecido',

      syncing:
        Boolean(syncing),

      syncMessage:
        syncMessage ||
        'Sem mensagem.',

      completedTasks:
        normalizedSync.completed,

      failedTasks:
        normalizedSync.failed,

      bbox:
        AppCore.cearaBbox ||
        null,
    },

    appCore: {
      cearaBoundary:
        countFeatures(
          AppCore.cearaBoundary,
        ),

      municipalities:
        countFeatures(
          AppCore.municipalities,
        ),

      conservationUnits:
        countFeatures(
          AppCore.conservationUnits,
        ),

      indigenousLands:
        countFeatures(
          AppCore.indigenousLands,
        ),

      sensitiveAreas:
        sensitiveSummary.total,

      sensitiveAreasByType:
        sensitiveSummary.byType,

      fireEvents:
        countFeatures(
          AppCore.fireEvents,
        ),

      fireFronts:
        countFeatures(
          AppCore.fireFronts,
        ),

      alerts:
        Array.isArray(
          AppCore.alerts,
        )
          ? AppCore.alerts
              .length
          : 0,
    },

    synchronization: {
      refreshMinutes,
      lastUpdated,
      nextDynamicRefresh,
    },

    cache,

    map: {
      connected:
        Boolean(map),

      styleLoaded,

      zoom:
        mapZoom,

      center:
        mapCenter,

      bounds:
        mapBounds,
    },

    layers:
      layers.map(
        (definition) => {
          const sourceId =
            `src-${definition.id}`;

          const source =
            getStoredSource(
              sourceId,
            );

          let sourceCreated =
            false;

          let layerCreated =
            false;

          let outlineCreated =
            false;

          try {
            sourceCreated =
              Boolean(
                map?.getSource?.(
                  sourceId,
                ),
              );

            layerCreated =
              Boolean(
                map?.getLayer?.(
                  definition.id,
                ),
              );

            outlineCreated =
              Boolean(
                map?.getLayer?.(
                  `${definition.id}-outline`,
                ),
              );
          } catch {
            // Mantém os valores falsos.
          }

          return {
            id:
              definition.id,

            title:
              definition.title ||
              definition.id,

            group:
              definition.group ||
              'Sem grupo',

            visible:
              definition.visible !==
              false,

            featureCount:
              countFeatures(
                source?.data,
              ),

            sourceCreated,
            layerCreated,
            outlineCreated,

            lastUpdated:
              definition.lastUpdated ||
              null,

            error:
              definition.error ||
              null,
          };
        },
      ),

    runtime,
    sourceSamples,

    errors:
      getRegisteredErrors(),

    device: {
      language:
        typeof navigator !==
        'undefined'
          ? navigator.language
          : 'não disponível',

      userAgent:
        typeof navigator !==
        'undefined'
          ? navigator.userAgent
          : 'não disponível',
    },
  };
}

/**
 * Adiciona informações de uma layer runtime
 * ao relatório.
 */
function appendRuntimeLayer(
  lines,
  title,
  layerId,
  runtime,
) {
  lines.push(
    `${title} [${layerId}]`,
  );

  lines.push(
    `- existe no estilo: ${yesNo(
      runtime.exists,
    )}`,
  );

  lines.push(
    `- tipo real: ${
      runtime.type ||
      'não disponível'
    }`,
  );

  lines.push(
    `- source real: ${
      runtime.source ||
      'não disponível'
    }`,
  );

  lines.push(
    `- visibilidade real: ${
      runtime.visibility ||
      'não disponível'
    }`,
  );

  lines.push(
    `- minzoom real: ${
      runtime.minzoom ??
      'não disponível'
    }`,
  );

  lines.push(
    `- maxzoom real: ${
      runtime.maxzoom ??
      'não disponível'
    }`,
  );

  lines.push(
    `- feições renderizadas na tela: ${
      runtime.renderedCount
    }`,
  );

  if (
    runtime.renderedQueryError
  ) {
    lines.push(
      `- falha ao contar renderização: ${runtime.renderedQueryError}`,
    );
  }

  lines.push(
    `- paint real: ${safeJson(
      runtime.paint,
      '{}',
    )}`,
  );

  lines.push('');
}

/**
 * Adiciona a amostra de uma source ao relatório.
 */
function appendSourceSample(
  lines,
  title,
  sourceId,
  sample,
) {
  lines.push(
    `${title} [${sourceId}]`,
  );

  lines.push(
    `- source encontrada: ${yesNo(
      sample.exists,
    )}`,
  );

  lines.push(
    `- feições: ${
      sample.featureCount
    }`,
  );

  lines.push(
    `- geometria da primeira feição: ${
      sample.geometryType ||
      'não disponível'
    }`,
  );

  lines.push(
    `- coordenada inicial: ${safeJson(
      sample.coordinate,
    )}`,
  );

  lines.push(
    `- avaliação: ${
      sample
        .coordinateEvaluation
        .message
    }`,
  );

  lines.push(
    `- propriedades da primeira feição: ${safeJson(
      sample.properties,
    )}`,
  );

  lines.push('');
}

/**
 * Gera relatório textual.
 */
function buildReport(
  diagnostic,
) {
  const lines = [];

  lines.push(
    'DIAGNÓSTICO GEOFOGO CEARÁ',
  );

  lines.push(
    `Gerado em: ${formatDateTime(
      diagnostic.generatedAt,
    )}`,
  );

  lines.push('');
  lines.push('APLICAÇÃO');

  lines.push(
    `Inicializada: ${yesNo(
      diagnostic.application
        .initialized,
    )}`,
  );

  lines.push(
    `Mapa conectado: ${yesNo(
      diagnostic.application
        .mapConnected,
    )}`,
  );

  lines.push(
    `Internet: ${
      diagnostic.application
        .online
        ? 'online'
        : 'offline'
    }`,
  );

  lines.push(
    `Modo instalado/PWA: ${yesNo(
      diagnostic.application
        .installed,
    )}`,
  );

  lines.push(
    `Sincronização: ${
      diagnostic.application
        .syncState
    }`,
  );

  lines.push(
    `Sincronizando agora: ${yesNo(
      diagnostic.application
        .syncing,
    )}`,
  );

  lines.push(
    `BBOX do Ceará: ${
      Array.isArray(
        diagnostic.application
          .bbox,
      )
        ? diagnostic.application
            .bbox.join(',')
        : diagnostic.application
              .bbox ||
          'não disponível'
    }`,
  );

  lines.push(
    `Mensagem: ${
      diagnostic.application
        .syncMessage
    }`,
  );

  lines.push(
    `Tarefas concluídas: ${
      diagnostic.application
        .completedTasks
        .length
        ? diagnostic.application
            .completedTasks.join(
              ', ',
            )
        : 'nenhuma'
    }`,
  );

  lines.push(
    `Tarefas com falha: ${
      diagnostic.application
        .failedTasks.length
        ? diagnostic.application
            .failedTasks.join(
              ', ',
            )
        : 'nenhuma'
    }`,
  );

  lines.push('');
  lines.push(
    'DADOS NO APPCORE',
  );

  lines.push(
    `Limite do Ceará: ${diagnostic.appCore.cearaBoundary}`,
  );

  lines.push(
    `Municípios: ${diagnostic.appCore.municipalities}`,
  );

  lines.push(
    `Unidades de Conservação: ${diagnostic.appCore.conservationUnits}`,
  );

  lines.push(
    `Eventos de fogo: ${diagnostic.appCore.fireEvents}`,
  );

  lines.push(
    `Frentes de fogo: ${diagnostic.appCore.fireFronts}`,
  );

  lines.push(
    `Alertas: ${diagnostic.appCore.alerts}`,
  );

  lines.push(
    `Terras Indígenas: ${diagnostic.appCore.indigenousLands}`,
  );

  lines.push(
    `Áreas Sensíveis: ${diagnostic.appCore.sensitiveAreas}`,
  );

  lines.push(
    `Áreas Sensíveis por tipo: ${safeJson(
      diagnostic.appCore.sensitiveAreasByType,
      '{}',
    )}`,
  );

  lines.push('');
  lines.push(
    'ESTADO DO MAPA',
  );

  lines.push(
    `Instância disponível: ${yesNo(
      diagnostic.map.connected,
    )}`,
  );

  lines.push(
    `Estilo carregado: ${yesNo(
      diagnostic.map
        .styleLoaded,
    )}`,
  );

  lines.push(
    `Zoom atual: ${
      diagnostic.map.zoom ??
      'não disponível'
    }`,
  );

  lines.push(
    `Centro atual: ${safeJson(
      diagnostic.map.center,
    )}`,
  );

  lines.push(
    `Limites visíveis: ${safeJson(
      diagnostic.map.bounds,
    )}`,
  );

  lines.push('');
  lines.push(
    'CAMADAS DO MAPA',
  );
  lines.push('');

  diagnostic.layers.forEach(
    (layer) => {
      lines.push(
        `${layer.title} [${layer.id}]`,
      );

      lines.push(
        `- grupo: ${layer.group}`,
      );

      lines.push(
        `- visível: ${yesNo(
          layer.visible,
        )}`,
      );

      lines.push(
        `- feições na fonte: ${layer.featureCount}`,
      );

      lines.push(
        `- source criada: ${yesNo(
          layer.sourceCreated,
        )}`,
      );

      lines.push(
        `- layer criada: ${yesNo(
          layer.layerCreated,
        )}`,
      );

      lines.push(
        `- outline criada: ${yesNo(
          layer.outlineCreated,
        )}`,
      );

      lines.push(
        `- última atualização: ${formatDateTime(
          layer.lastUpdated,
        )}`,
      );

      if (layer.error) {
        lines.push(
          `- erro da camada: ${
            layer.error
              ?.message ||
            String(
              layer.error,
            )
          }`,
        );
      }

      lines.push('');
    },
  );

  lines.push('');
  lines.push(
    'SINCRONIZAÇÃO AUTOMÁTICA',
  );

  lines.push(
    `Intervalo: ${diagnostic.synchronization.refreshMinutes} minutos`,
  );

  lines.push(
    `Última atualização: ${formatDateTime(
      diagnostic.synchronization.lastUpdated,
    )}`,
  );

  lines.push(
    `Próxima atualização prevista: ${formatDateTime(
      diagnostic.synchronization.nextDynamicRefresh,
    )}`,
  );

  lines.push('');
  lines.push(
    'VALIDADE DO CACHE',
  );

  for (
    const [
      key,
      cache,
    ]
    of Object.entries(
      diagnostic.cache,
    )
  ) {
    lines.push(
      `${cache.label || key}`,
    );

    lines.push(
      `- estado: ${cache.status}`,
    );

    lines.push(
      `- atualizado em: ${formatDateTime(
        cache.updatedAt,
      )}`,
    );

    lines.push(
      `- idade: ${formatCacheDuration(
        cache.ageMs,
      )}`,
    );

    lines.push(
      `- validade: ${formatCacheDuration(
        cache.policy?.maxAgeMs,
      )}`,
    );

    lines.push(
      `- expira em: ${formatCacheDuration(
        cache.remainingMs,
      )}`,
    );

    lines.push('');
  }

  lines.push(
    'RENDERIZAÇÃO REAL DO MAPLIBRE',
  );

  lines.push('');

  appendRuntimeLayer(
    lines,
    'Eventos de fogo',
    'fire-events',
    diagnostic.runtime
      .fireEvents,
  );

  appendRuntimeLayer(
    lines,
    'Contorno dos eventos',
    'fire-events-outline',
    diagnostic.runtime
      .fireEventsOutline,
  );

  appendRuntimeLayer(
    lines,
    'Centroide dos eventos',
    'fire-events-markers',
    diagnostic.runtime
      .fireMarkers,
  );

  appendRuntimeLayer(
    lines,
    'Frentes de fogo',
    'fire-fronts',
    diagnostic.runtime
      .fireFronts,
  );

  appendRuntimeLayer(
    lines,
    'Municípios',
    'municipalities',
    diagnostic.runtime
      .municipalities,
  );

  appendRuntimeLayer(
    lines,
    'Unidades de Conservação',
    'conservation-units',
    diagnostic.runtime
      .conservationUnits,
  );

  appendRuntimeLayer(
    lines,
    'Terras Indígenas',
    'indigenous-lands',
    diagnostic.runtime
      .indigenousLands,
  );

  lines.push(
    'AMOSTRA DAS FONTES',
  );

  lines.push('');

  appendSourceSample(
    lines,
    'Eventos de fogo',
    'src-fire-events',
    diagnostic.sourceSamples
      .fireEvents,
  );

  appendSourceSample(
    lines,
    'Centroide dos eventos',
    'src-fire-events-markers',
    diagnostic.sourceSamples
      .fireMarkers,
  );

  appendSourceSample(
    lines,
    'Frentes de fogo',
    'src-fire-fronts',
    diagnostic.sourceSamples
      .fireFronts,
  );

  lines.push('ERROS');
  lines.push('');

  if (
    diagnostic.errors.length ===
    0
  ) {
    lines.push(
      'Nenhum erro registrado.',
    );
  } else {
    diagnostic.errors.forEach(
      (entry, index) => {
        const error =
          entry?.error ||
          entry;

        const message =
          error?.message ||
          entry?.message ||
          String(error);

        lines.push(
          `${index + 1}. Módulo: ${
            entry?.module ||
            entry?.source ||
            'desconhecido'
          }`,
        );

        lines.push(
          `Mensagem: ${message}`,
        );

        if (
          entry?.detail ||
          entry?.details
        ) {
          lines.push(
            `Detalhe: ${
              entry.detail ||
              entry.details
            }`,
          );
        }

        if (
          entry?.timestamp ||
          entry?.time ||
          entry?.createdAt
        ) {
          lines.push(
            `Horário: ${formatDateTime(
              entry.timestamp ||
                entry.time ||
                entry.createdAt,
            )}`,
          );
        }

        if (entry?.context) {
          lines.push(
            `Contexto: ${safeJson(
              entry.context,
            )}`,
          );
        }

        lines.push('');
      },
    );
  }

  lines.push('');
  lines.push('DISPOSITIVO');

  lines.push(
    `Idioma: ${diagnostic.device.language}`,
  );

  lines.push(
    `User agent: ${diagnostic.device.userAgent}`,
  );

  return lines.join('\n');
}

/**
 * Copia texto com alternativa para navegadores
 * que não suportam Clipboard API.
 */
async function copyText(
  text,
  textareaRef,
) {
  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      text,
    );

    return;
  }

  const textarea =
    textareaRef.current;

  if (!textarea) {
    throw new Error(
      'Área de relatório não encontrada.',
    );
  }

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(
    0,
    textarea.value.length,
  );

  const copied =
    document.execCommand(
      'copy',
    );

  if (!copied) {
    throw new Error(
      'O navegador não permitiu copiar o relatório.',
    );
  }
}

/**
 * Baixa o relatório como arquivo TXT.
 */
function downloadReport(
  text,
) {
  const blob = new Blob(
    [text],
    {
      type: 'text/plain;charset=utf-8',
    },
  );

  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      'a',
    );

  const timestamp =
    new Date()
      .toISOString()
      .replace(
        /[:.]/g,
        '-',
      );

  anchor.href = url;

  anchor.download =
    `diagnostico-geofogo-${timestamp}.txt`;

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

/**
 * Componente principal.
 *
 * Propriedades aceitas:
 * - open/isOpen: controla exibição;
 * - onClose: fecha o painel;
 * - syncState: success, partial, error etc.;
 * - syncing: sincronização em andamento;
 * - syncMessage: mensagem da sincronização;
 * - syncResult: resultado das tarefas.
 */
export default function DiagnosticPanel({
  open = true,
  isOpen,
  onClose,
  syncState = 'desconhecido',
  syncing = false,
  syncMessage = '',
  syncResult = null,
}) {
  const visible =
    isOpen ?? open;

  const textareaRef =
    useRef(null);

  const [diagnostic, setDiagnostic] =
    useState(null);

  const [copied, setCopied] =
    useState(false);

  const [copyError, setCopyError] =
    useState('');

  const collect = useCallback(
    () => {
      const next =
        collectDiagnosticData({
          syncState,
          syncing,
          syncMessage,
          syncResult,
        });

      setDiagnostic(next);
    },
    [
      syncState,
      syncing,
      syncMessage,
      syncResult,
    ],
  );

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    collect();

    const interval =
      window.setInterval(
        collect,
        REFRESH_INTERVAL_MS,
      );

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [collect, visible]);

  const report = useMemo(
    () =>
      diagnostic
        ? buildReport(
            diagnostic,
          )
        : 'Coletando diagnóstico...',
    [diagnostic],
  );

  const handleCopy =
    useCallback(async () => {
      setCopyError('');

      try {
        await copyText(
          report,
          textareaRef,
        );

        setCopied(true);

        window.setTimeout(
          () => {
            setCopied(false);
          },
          2000,
        );
      } catch (error) {
        setCopyError(
          error?.message ||
            'Não foi possível copiar.',
        );
      }
    }, [report]);

  const handleDownload =
    useCallback(() => {
      downloadReport(
        report,
      );
    }, [report]);


  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (
        event.key === 'Escape' &&
        typeof onClose === 'function'
      ) {
        onClose();
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [onClose, visible]);

  if (!visible) {
    return null;
  }

  const fireEventsRendered =
    diagnostic?.runtime
      ?.fireEvents
      ?.renderedCount;

  const fireMarkersRendered =
    diagnostic?.runtime
      ?.fireMarkers
      ?.renderedCount;

  const hasRenderingWarning =
    diagnostic &&
    diagnostic.appCore
      .fireEvents > 0 &&
    fireEventsRendered === 0 &&
    fireMarkersRendered === 0;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center overflow-hidden bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-background shadow-2xl sm:h-[min(94dvh,900px)] sm:rounded-xl sm:border sm:border-border">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
              <Bug className="h-5 w-5 text-orange-500" />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">
                Diagnóstico GeoFogo Ceará
              </h2>

              <p className="text-xs text-muted-foreground">
                Atualização automática a cada 3 segundos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 hover:bg-accent"
            aria-label="Fechar diagnóstico"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {hasRenderingWarning && (
          <div className="mx-4 mt-3 flex shrink-0 items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />

            <div>
              <p className="font-medium">
                Os eventos estão carregados, mas não aparecem na área visível.
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Consulte as seções “Renderização real do MapLibre” e
                “Amostra das fontes”.
              </p>
            </div>
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center gap-2 overflow-x-auto border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={collect}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Clipboard className="h-4 w-4" />
            )}

            {copied
              ? 'Copiado'
              : 'Copiar relatório'}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Baixar TXT
          </button>

          {copyError && (
            <span className="text-xs text-destructive">
              {copyError}
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-4">
          <textarea
            ref={textareaRef}
            readOnly
            value={report}
            spellCheck={false}
            className="h-full min-h-0 w-full resize-none overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring"
            aria-label="Relatório de diagnóstico"
          />
        </div>

        <footer className="flex shrink-0 items-center justify-end border-t border-border bg-background px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <X className="h-4 w-4" />
            Fechar relatório
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}