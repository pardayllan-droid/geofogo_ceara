/**
 * MapView
 *
 * Cria o mapa MapLibre e coordena a instalação das
 * camadas operacionais do GeoFogo Ceará.
 *
 * Também recebe solicitações para centralizar o mapa
 * em eventos de fogo selecionados no painel de alertas.
 *
 * Importante:
 * map.isStyleLoaded() não é usado como condição principal.
 * Em mapas raster, ele pode permanecer falso enquanto
 * tiles continuam sendo baixados, embora o estilo já aceite
 * novas sources e layers.
 */

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';

import {
  createMap,
  changeBaseMap as applyBaseMap,
  fitToCeara,
} from './MapController';

import {
  LayerManager,
} from '../layers/LayerManager';

import {
  EventBus,
  EVENTS,
} from '../core/EventBus';

import {
  ErrorManager,
} from '../core/ErrorManager';

import {
  AppCore,
} from '../core/AppCore';

import {
  FieldController,
} from '../field/FieldController';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

function isFeatureCollection(value) {
  return (
    value?.type === 'FeatureCollection' &&
    Array.isArray(value.features)
  );
}

function featureCount(value) {
  return Array.isArray(value?.features)
    ? value.features.length
    : 0;
}

/**
 * Verifica se o mapa já possui um objeto de estilo
 * utilizável, sem depender de isStyleLoaded().
 */
function mapHasStyle(map) {
  if (!map) {
    return false;
  }

  try {
    const style =
      map.getStyle?.();

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
 * Percorre recursivamente as coordenadas de uma geometria.
 */
function walkCoordinates(
  coordinates,
  callback,
) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (
    coordinates.length >= 2 &&
    Number.isFinite(
      Number(coordinates[0]),
    ) &&
    Number.isFinite(
      Number(coordinates[1]),
    )
  ) {
    callback(
      Number(coordinates[0]),
      Number(coordinates[1]),
    );

    return;
  }

  for (const item of coordinates) {
    walkCoordinates(
      item,
      callback,
    );
  }
}

/**
 * Calcula o BBOX de uma feição GeoJSON.
 *
 * Retorno:
 * [west, south, east, north]
 */
function calculateFeatureBbox(feature) {
  const geometry =
    feature?.geometry;

  if (!geometry) {
    return null;
  }

  if (
    geometry.type === 'GeometryCollection'
  ) {
    const geometries =
      geometry.geometries || [];

    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;

    for (const item of geometries) {
      const bbox =
        calculateFeatureBbox({
          type: 'Feature',
          geometry: item,
          properties: {},
        });

      if (!bbox) {
        continue;
      }

      west = Math.min(
        west,
        bbox[0],
      );

      south = Math.min(
        south,
        bbox[1],
      );

      east = Math.max(
        east,
        bbox[2],
      );

      north = Math.max(
        north,
        bbox[3],
      );
    }

    if (
      !Number.isFinite(west) ||
      !Number.isFinite(south) ||
      !Number.isFinite(east) ||
      !Number.isFinite(north)
    ) {
      return null;
    }

    return [
      west,
      south,
      east,
      north,
    ];
  }

  if (!geometry.coordinates) {
    return null;
  }

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  walkCoordinates(
    geometry.coordinates,
    (
      longitude,
      latitude,
    ) => {
      west = Math.min(
        west,
        longitude,
      );

      south = Math.min(
        south,
        latitude,
      );

      east = Math.max(
        east,
        longitude,
      );

      north = Math.max(
        north,
        latitude,
      );
    },
  );

  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    return null;
  }

  return [
    west,
    south,
    east,
    north,
  ];
}

/**
 * Obtém o centro aproximado de uma feição por meio
 * de seu BBOX.
 */
function calculateFeatureCenter(feature) {
  const bbox =
    calculateFeatureBbox(feature);

  if (!bbox) {
    return null;
  }

  const [
    west,
    south,
    east,
    north,
  ] = bbox;

  return [
    (west + east) / 2,
    (south + north) / 2,
  ];
}

/**
 * Tenta obter o identificador do evento independentemente
 * do nome utilizado pelo SIPAM.
 */
function getFeatureIdentifiers(feature) {
  const properties =
    feature?.properties || {};

  return [
    feature?.id,

    properties.id,
    properties.ID,

    properties.eventId,
    properties.event_id,

    properties.identificador,
    properties.identificador_evento,

    properties.codigo,
    properties.cod_evento,
    properties.codigo_evento,

    properties.id_evento,
    properties.idEvento,

    properties.objectid,
    properties.OBJECTID,

    properties.fid,
    properties.FID,
  ]
    .filter(
      (value) =>
        value !== undefined &&
        value !== null &&
        String(value).trim() !== '',
    )
    .map(
      (value) =>
        String(value).trim(),
    );
}

/**
 * Localiza no AppCore o evento relacionado ao alerta.
 */
function findFireEventById(eventId) {
  if (
    eventId === undefined ||
    eventId === null
  ) {
    return null;
  }

  const target =
    String(eventId).trim();

  const features =
    AppCore.fireEvents?.features || [];

  return (
    features.find(
      (feature) =>
        getFeatureIdentifiers(
          feature,
        ).includes(target),
    ) ||
    null
  );
}

/**
 * Padding aplicado ao enquadrar um evento.
 *
 * No desktop, reserva espaço para o painel lateral.
 * No celular, reserva espaço para o painel inferior.
 */
function getFocusPadding() {
  const mobile =
    typeof window !== 'undefined' &&
    window.innerWidth < 768;

  if (mobile) {
    return {
      top: 70,
      right: 35,
      bottom: 260,
      left: 35,
    };
  }

  return {
    top: 70,
    right: 390,
    bottom: 70,
    left: 80,
  };
}

/**
 * Centraliza ou enquadra uma feição no mapa.
 */
function focusMapOnFeature(
  map,
  feature,
) {
  if (
    !map ||
    !feature?.geometry
  ) {
    return false;
  }

  try {
    if (
      feature.geometry.type === 'Point'
    ) {
      const coordinates =
        feature.geometry.coordinates;

      if (
        !Array.isArray(coordinates) ||
        coordinates.length < 2
      ) {
        return false;
      }

      const longitude =
        Number(coordinates[0]);

      const latitude =
        Number(coordinates[1]);

      if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude)
      ) {
        return false;
      }

      map.easeTo({
        center: [
          longitude,
          latitude,
        ],

        zoom: Math.max(
          map.getZoom?.() || 0,
          14,
        ),

        duration: 900,
      });

      return true;
    }

    const bbox =
      calculateFeatureBbox(feature);

    if (!bbox) {
      return false;
    }

    const [
      west,
      south,
      east,
      north,
    ] = bbox;

    const width =
      Math.abs(east - west);

    const height =
      Math.abs(north - south);

    /*
     * Para eventos muito pequenos, fitBounds pode aplicar
     * um zoom excessivo. Nesse caso, centralizamos usando
     * um zoom operacional.
     */
    if (
      width < 0.00001 &&
      height < 0.00001
    ) {
      const center =
        calculateFeatureCenter(feature);

      if (!center) {
        return false;
      }

      map.easeTo({
        center,

        zoom: Math.max(
          map.getZoom?.() || 0,
          14,
        ),

        duration: 900,
      });

      return true;
    }

    map.fitBounds(
      [
        [
          west,
          south,
        ],

        [
          east,
          north,
        ],
      ],
      {
        padding:
          getFocusPadding(),

        maxZoom: 14,

        duration: 900,
      },
    );

    return true;
  } catch (error) {
    ErrorManager.report(
      'map',
      error,
      {
        operation:
          'MapView.focusMapOnFeature',

        featureId:
          feature?.id ??
          feature?.properties?.id ??
          null,
      },
    );

    return false;
  }
}

export default function MapView({
  baseMapId,
  onReady,
}) {
  const containerRef =
    useRef(null);

  const mapRef =
    useRef(null);

  const mountedRef =
    useRef(false);

  const styleReadyRef =
    useRef(false);

  const fittedRef =
    useRef(false);

  const baseMapRef =
    useRef(baseMapId);

  const installingRef =
    useRef(false);

  const pendingInstallRef =
    useRef(false);

  const retryTimerRef =
    useRef(null);

  const clearRetry =
    useCallback(() => {
      if (!retryTimerRef.current) {
        return;
      }

      window.clearTimeout(
        retryTimerRef.current,
      );

      retryTimerRef.current = null;
    }, []);

  /**
   * Atualiza uma camada no LayerManager.
   */
  const updateLayer =
    useCallback(
      (
        layerId,
        data,
      ) => {
        if (!isFeatureCollection(data)) {
          return false;
        }

        try {
          return LayerManager.updateLayerData(
            layerId,
            data,
          );
        } catch (error) {
          ErrorManager.report(
            'layer',
            error,
            {
              operation:
                'MapView.updateLayer',

              layerId,

              featureCount:
                featureCount(data),
            },
          );

          return false;
        }
      },
      [],
    );

  /**
   * Envia todos os dados existentes no AppCore
   * para o LayerManager.
   *
   * Coleções vazias também são enviadas para limpar
   * dados anteriores.
   */
  const updateAllLayerData =
    useCallback(() => {
      updateLayer(
        'ceara-boundary',
        AppCore.cearaBoundary ||
          EMPTY_FEATURE_COLLECTION,
      );

      updateLayer(
        'municipalities',
        AppCore.municipalities ||
          EMPTY_FEATURE_COLLECTION,
      );

      updateLayer(
        'conservation-units',
        AppCore.conservationUnits ||
          EMPTY_FEATURE_COLLECTION,
      );

      updateLayer(
        'fire-events',
        AppCore.fireEvents ||
          EMPTY_FEATURE_COLLECTION,
      );

      updateLayer(
        'fire-events-markers',
        AppCore.getFireEventMarkers?.() ||
          EMPTY_FEATURE_COLLECTION,
      );

      updateLayer(
        'fire-fronts',
        AppCore.fireFronts ||
          EMPTY_FEATURE_COLLECTION,
      );

      updateLayer(
        'alert-buffers',
        AppCore.getAlertBuffers?.() ||
          EMPTY_FEATURE_COLLECTION,
      );
    }, [updateLayer]);

  /**
   * Tenta instalar as camadas operacionais sem depender
   * de map.isStyleLoaded().
   */
  const installOperationalLayers =
    useCallback(
      ({
        reason = 'manual',
        attempt = 0,
      } = {}) => {
        const map =
          mapRef.current;

        if (
          !mountedRef.current ||
          !map
        ) {
          return false;
        }

        if (installingRef.current) {
          pendingInstallRef.current = true;

          return false;
        }

        const styleAvailable =
          styleReadyRef.current ||
          mapHasStyle(map);

        if (!styleAvailable) {
          if (attempt < 20) {
            clearRetry();

            retryTimerRef.current =
              window.setTimeout(
                () => {
                  installOperationalLayers({
                    reason:
                      `${reason}:retry`,

                    attempt:
                      attempt + 1,
                  });
                },
                250,
              );
          }

          return false;
        }

        installingRef.current = true;
        pendingInstallRef.current = false;

        try {
          LayerManager.setMap(map);

          /*
           * Primeira passagem:
           * envia os dados atuais.
           */
          updateAllLayerData();

          /*
           * Segunda passagem:
           * recria camadas perdidas após troca de estilo.
           */
          LayerManager.restoreAllLayers?.();

          /*
           * Terceira passagem:
           * garante setData nas sources recém-criadas.
           */
          updateAllLayerData();

          try {
            map.resize();
          } catch {
            // Não impede o funcionamento das camadas.
          }

          const boundarySourceCreated =
            Boolean(
              map.getSource?.(
                'src-ceara-boundary',
              ),
            );

          const boundaryLayerCreated =
            Boolean(
              map.getLayer?.(
                'ceara-boundary',
              ),
            );

          const municipalitySourceCreated =
            Boolean(
              map.getSource?.(
                'src-municipalities',
              ),
            );

          const municipalityLayerCreated =
            Boolean(
              map.getLayer?.(
                'municipalities',
              ),
            );

          /*
           * Só registra erros após algumas tentativas,
           * evitando registrar falhas transitórias.
           */
          if (
            attempt >= 3 &&
            featureCount(
              AppCore.cearaBoundary,
            ) > 0 &&
            !boundaryLayerCreated
          ) {
            ErrorManager.report(
              'layer',

              new Error(
                'O limite do Ceará possui dados, mas não foi criado no mapa.',
              ),

              {
                operation:
                  'installOperationalLayers',

                reason,
                attempt,

                styleReadyEvent:
                  styleReadyRef.current,

                styleObjectAvailable:
                  mapHasStyle(map),

                isStyleLoaded:
                  map.isStyleLoaded?.() ??
                  false,

                sourceCreated:
                  boundarySourceCreated,
              },
            );
          }

          if (
            attempt >= 3 &&
            featureCount(
              AppCore.municipalities,
            ) > 0 &&
            !municipalityLayerCreated
          ) {
            ErrorManager.report(
              'layer',

              new Error(
                'Os municípios possuem dados, mas não foram criados no mapa.',
              ),

              {
                operation:
                  'installOperationalLayers',

                reason,
                attempt,

                featureCount:
                  featureCount(
                    AppCore.municipalities,
                  ),

                styleReadyEvent:
                  styleReadyRef.current,

                styleObjectAvailable:
                  mapHasStyle(map),

                isStyleLoaded:
                  map.isStyleLoaded?.() ??
                  false,

                sourceCreated:
                  municipalitySourceCreated,
              },
            );
          }

          /*
           * Enquadra o Ceará apenas na primeira
           * instalação bem-sucedida.
           */
          if (
            !fittedRef.current &&
            boundaryLayerCreated &&
            featureCount(
              AppCore.cearaBoundary,
            ) > 0
          ) {
            const fitted =
              fitToCeara(
                map,
                AppCore.cearaBoundary,
              );

            if (fitted) {
              fittedRef.current = true;
              AppCore._fitted = true;
            }
          }

          const territorialLayersMissing =
            (
              featureCount(
                AppCore.cearaBoundary,
              ) > 0 &&
              !boundaryLayerCreated
            ) ||
            (
              featureCount(
                AppCore.municipalities,
              ) > 0 &&
              !municipalityLayerCreated
            );

          if (
            territorialLayersMissing &&
            attempt < 20
          ) {
            clearRetry();

            retryTimerRef.current =
              window.setTimeout(
                () => {
                  installOperationalLayers({
                    reason:
                      `${reason}:layer-retry`,

                    attempt:
                      attempt + 1,
                  });
                },
                300,
              );
          }

          return (
            boundaryLayerCreated ||
            municipalityLayerCreated
          );
        } catch (error) {
          ErrorManager.report(
            'layer',
            error,
            {
              operation:
                'installOperationalLayers',

              reason,
              attempt,

              styleReadyEvent:
                styleReadyRef.current,

              styleObjectAvailable:
                mapHasStyle(map),

              isStyleLoaded:
                map.isStyleLoaded?.() ??
                false,
            },
          );

          return false;
        } finally {
          installingRef.current = false;

          if (
            pendingInstallRef.current &&
            mountedRef.current
          ) {
            pendingInstallRef.current = false;

            window.setTimeout(
              () => {
                installOperationalLayers({
                  reason:
                    'pending-installation',
                });
              },
              0,
            );
          }
        }
      },
      [
        clearRetry,
        updateAllLayerData,
      ],
    );

  /**
   * Cria e destrói o mapa.
   */
  useEffect(() => {
    mountedRef.current = true;

    if (
      !containerRef.current ||
      mapRef.current
    ) {
      return undefined;
    }

    const map =
      createMap(
        containerRef.current,
        {
          baseMapId:
            baseMapRef.current,
        },
      );

    mapRef.current = map;

    const handleLoad = () => {
      if (!mountedRef.current) {
        return;
      }

      styleReadyRef.current = true;

      LayerManager.setMap(map);

      onReady?.(map);

      installOperationalLayers({
        reason: 'map-load',
      });
    };

    const handleStyleLoad = () => {
      if (!mountedRef.current) {
        return;
      }

      styleReadyRef.current = true;
      fittedRef.current = false;
      AppCore._fitted = false;

      LayerManager.setMap(map);

      installOperationalLayers({
        reason: 'style-load',
      });
    };

    const handleStyleData = () => {
      if (!mountedRef.current) {
        return;
      }

      if (!mapHasStyle(map)) {
        return;
      }

      styleReadyRef.current = true;

      installOperationalLayers({
        reason: 'style-data',
      });
    };

    const handleIdle = () => {
      if (!mountedRef.current) {
        return;
      }

      if (!mapHasStyle(map)) {
        return;
      }

      const boundaryMissing =
        featureCount(
          AppCore.cearaBoundary,
        ) > 0 &&
        !map.getLayer?.(
          'ceara-boundary',
        );

      const municipalitiesMissing =
        featureCount(
          AppCore.municipalities,
        ) > 0 &&
        !map.getLayer?.(
          'municipalities',
        );

      if (
        boundaryMissing ||
        municipalitiesMissing
      ) {
        installOperationalLayers({
          reason: 'map-idle',
        });
      }
    };

    const handleMapError = (
      event,
    ) => {
      const error =
        event?.error ||
        event ||
        new Error(
          'Erro desconhecido no MapLibre.',
        );

      /*
       * Erros em tiles raster não devem impedir
       * as camadas GeoJSON operacionais.
       */
      console.warn(
        '[MapView] Erro reportado pelo MapLibre:',
        error,
      );
    };

    map.on(
      'load',
      handleLoad,
    );

    map.on(
      'style.load',
      handleStyleLoad,
    );

    map.on(
      'styledata',
      handleStyleData,
    );

    map.on(
      'idle',
      handleIdle,
    );

    map.on(
      'error',
      handleMapError,
    );

    /*
     * Proteção para o caso de o estilo já estar
     * disponível antes do registro dos listeners.
     */
    if (mapHasStyle(map)) {
      styleReadyRef.current = true;

      LayerManager.setMap(map);

      installOperationalLayers({
        reason:
          'style-already-available',
      });
    }

    return () => {
      mountedRef.current = false;
      styleReadyRef.current = false;

      clearRetry();

      installingRef.current = false;
      pendingInstallRef.current = false;

      try {
        map.off(
          'load',
          handleLoad,
        );

        map.off(
          'style.load',
          handleStyleLoad,
        );

        map.off(
          'styledata',
          handleStyleData,
        );

        map.off(
          'idle',
          handleIdle,
        );

        map.off(
          'error',
          handleMapError,
        );
      } catch {
        // O mapa pode já ter sido removido.
      }

      LayerManager.clearMap(map);

      try {
        map.remove();
      } catch (error) {
        console.warn(
          '[MapView] Falha ao remover o mapa:',
          error,
        );
      }

      mapRef.current = null;
    };
  }, [
    clearRetry,
    installOperationalLayers,
    onReady,
  ]);

  /**
   * Troca do mapa-base.
   */
  useEffect(() => {
    const map =
      mapRef.current;

    if (
      !map ||
      !baseMapId ||
      baseMapId ===
        baseMapRef.current
    ) {
      return;
    }

    baseMapRef.current =
      baseMapId;

    styleReadyRef.current = false;
    fittedRef.current = false;
    AppCore._fitted = false;

    const changed =
      applyBaseMap(
        map,
        baseMapId,
        {
          onStyleReady: () => {
            styleReadyRef.current = true;

            LayerManager.setMap(map);

            installOperationalLayers({
              reason:
                'base-map-changed',
            });
          },
        },
      );

    if (!changed) {
      styleReadyRef.current =
        mapHasStyle(map);
    }
  }, [
    baseMapId,
    installOperationalLayers,
  ]);

  /**
   * Atualiza as camadas quando os dados do núcleo
   * forem modificados.
   *
   * Não escuta LAYER_DATA_UPDATED para evitar recursão.
   */
  useEffect(() => {
    const handleDataUpdated = () => {
      installOperationalLayers({
        reason: 'data-updated',
      });
    };

    const handleSyncCompleted = () => {
      installOperationalLayers({
        reason: 'sync-completed',
      });
    };

    const handleMapReady = () => {
      installOperationalLayers({
        reason: 'map-ready',
      });
    };

    const unsubscribeData =
      EventBus.on(
        EVENTS.DATA_UPDATED,
        handleDataUpdated,
      );

    const unsubscribeSync =
      EventBus.on(
        EVENTS.SYNC_COMPLETED,
        handleSyncCompleted,
      );

    const unsubscribeMap =
      EventBus.on(
        EVENTS.MAP_READY,
        handleMapReady,
      );

    return () => {
      unsubscribeData?.();
      unsubscribeSync?.();
      unsubscribeMap?.();
    };
  }, [installOperationalLayers]);

  /**
   * Centraliza o mapa em um evento selecionado
   * no painel de alertas.
   */
  useEffect(() => {
    if (
      !EVENTS.MAP_FOCUS_FIRE_EVENT
    ) {
      console.warn(
        '[MapView] MAP_FOCUS_FIRE_EVENT não está registrado no EventBus.',
      );

      return undefined;
    }

    const handleFocusFireEvent =
      ({
        eventId,
        alertId,
        feature,
      } = {}) => {
        const map =
          mapRef.current;

        if (!map) {
          console.warn(
            '[MapView] O mapa ainda não está disponível para centralização.',
          );

          return;
        }

        /*
         * O painel pode enviar diretamente a feição.
         * Caso não envie, procuramos pelo eventId.
         */
        const fireEvent =
          feature ||
          findFireEventById(
            eventId,
          );

        if (!fireEvent) {
          console.warn(
            '[MapView] Evento relacionado ao alerta não encontrado.',
            {
              eventId,
              alertId,

              availableEvents:
                AppCore.fireEvents
                  ?.features
                  ?.length || 0,
            },
          );

          return;
        }

        /*
         * Garante que o evento esteja instalado no mapa
         * antes de realizar a animação.
         */
        installOperationalLayers({
          reason:
            'focus-fire-event',
        });

        try {
          LayerManager.setVisibility?.(
            'fire-events',
            true,
          );

          LayerManager.setVisibility?.(
            'fire-events-markers',
            true,
          );
        } catch (error) {
          console.warn(
            '[MapView] Não foi possível ativar as camadas de eventos:',
            error,
          );
        }

        const focused =
          focusMapOnFeature(
            map,
            fireEvent,
          );

        if (!focused) {
          console.warn(
            '[MapView] Não foi possível centralizar no evento.',
            {
              eventId,
              alertId,

              geometryType:
                fireEvent?.geometry?.type ||
                null,
            },
          );
        }
      };

    const unsubscribe =
      EventBus.on(
        EVENTS.MAP_FOCUS_FIRE_EVENT,
        handleFocusFireEvent,
      );

    return () => {
      unsubscribe?.();
    };
  }, [installOperationalLayers]);

  /**
   * Atualização das camadas do Modo Campo.
   */
  useEffect(() => {
    const updateFieldLayers = () => {
      const map =
        mapRef.current;

      if (
        !FieldController.active ||
        !map ||
        !styleReadyRef.current
      ) {
        return;
      }

      LayerManager.setMap(map);

      updateLayer(
        'field-position',

        FieldController
          .getPositionGeoJSON?.() ||
          EMPTY_FEATURE_COLLECTION,
      );

      updateLayer(
        'field-trail',

        FieldController
          .getTrailGeoJSON?.() ||
          EMPTY_FEATURE_COLLECTION,
      );

      updateLayer(
        'field-points',

        FieldController
          .getPointsGeoJSON?.() ||
          EMPTY_FEATURE_COLLECTION,
      );

      const position =
        FieldController.currentPosition;

      const coordinates =
        position?.geometry?.coordinates;

      if (
        Array.isArray(coordinates) &&
        coordinates.length >= 2
      ) {
        const longitude =
          Number(coordinates[0]);

        const latitude =
          Number(coordinates[1]);

        if (
          Number.isFinite(longitude) &&
          Number.isFinite(latitude)
        ) {
          map.easeTo({
            center: [
              longitude,
              latitude,
            ],

            zoom: Math.max(
              map.getZoom(),
              14,
            ),
          });
        }
      }
    };

    const intervalId =
      window.setInterval(
        updateFieldLayers,
        3000,
      );

    const unsubscribeStopped =
      EventBus.on(
        EVENTS.FIELD_MODE_STOPPED,
        () => {
          updateLayer(
            'field-position',
            EMPTY_FEATURE_COLLECTION,
          );

          updateLayer(
            'field-trail',
            EMPTY_FEATURE_COLLECTION,
          );

          updateLayer(
            'field-points',
            EMPTY_FEATURE_COLLECTION,
          );
        },
      );

    return () => {
      window.clearInterval(
        intervalId,
      );

      unsubscribeStopped?.();
    };
  }, [updateLayer]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      data-testid="geofogo-map"
    />
  );
}