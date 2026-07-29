/**
 * MapView
 *
 * Cria o mapa MapLibre e coordena a instalação das
 * camadas operacionais do GeoFogo Ceará.
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

import { LayerManager } from '../layers/LayerManager';

import {
  EventBus,
  EVENTS,
} from '../core/EventBus';

import { ErrorManager } from '../core/ErrorManager';
import { AppCore } from '../core/AppCore';
import { FieldController } from '../field/FieldController';

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

function mapHasStyle(map) {
  if (!map) {
    return false;
  }

  try {
    const style = map.getStyle?.();

    return Boolean(
      style &&
        Number(style.version) === 8 &&
        Array.isArray(style.layers),
    );
  } catch {
    return false;
  }
}

export default function MapView({
  baseMapId,
  onReady,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const mountedRef = useRef(false);
  const styleReadyRef = useRef(false);
  const fittedRef = useRef(false);

  const baseMapRef = useRef(baseMapId);

  const installingRef = useRef(false);
  const pendingInstallRef = useRef(false);
  const retryTimerRef = useRef(null);

  const clearRetry = useCallback(() => {
    if (!retryTimerRef.current) {
      return;
    }

    window.clearTimeout(
      retryTimerRef.current,
    );

    retryTimerRef.current = null;
  }, []);

  const updateLayer = useCallback(
    (layerId, data) => {
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
   * Envia todos os dados atualmente existentes no
   * AppCore para o LayerManager.
   *
   * Coleções vazias também são enviadas para limpar
   * dados antigos.
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
   * Tenta criar as camadas sem depender de
   * map.isStyleLoaded().
   *
   * A autorização principal é:
   * - evento load ou style.load já ocorreu;
   * - map.getStyle() devolve um estilo válido.
   */
  const installOperationalLayers =
    useCallback(
      ({
        reason = 'manual',
        attempt = 0,
      } = {}) => {
        const map = mapRef.current;

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
              window.setTimeout(() => {
                installOperationalLayers({
                  reason: `${reason}:retry`,
                  attempt: attempt + 1,
                });
              }, 250);
          }

          return false;
        }

        installingRef.current = true;
        pendingInstallRef.current = false;

        try {
          /*
           * Reconecta o mapa. O LayerManager continuará
           * preservando todas as sources em memória.
           */
          LayerManager.setMap(map);

          /*
           * Primeira passagem:
           * tenta criar sources e layers usando os dados
           * atuais do AppCore.
           */
          updateAllLayerData();

          /*
           * Segunda passagem:
           * restaura qualquer source que tenha sido
           * armazenada antes de o mapa ficar disponível.
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
           * Só registra erro após algumas tentativas.
           * Isso evita registrar falhas transitórias
           * durante o primeiro carregamento.
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

          if (
            !fittedRef.current &&
            boundaryLayerCreated &&
            featureCount(
              AppCore.cearaBoundary,
            ) > 0
          ) {
            const fitted = fitToCeara(
              map,
              AppCore.cearaBoundary,
            );

            if (fitted) {
              fittedRef.current = true;
              AppCore._fitted = true;
            }
          }

          /*
           * Se ainda não criou as layers territoriais,
           * tenta novamente. Não esperamos o
           * isStyleLoaded tornar-se true.
           */
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
              window.setTimeout(() => {
                installOperationalLayers({
                  reason: `${reason}:layer-retry`,
                  attempt: attempt + 1,
                });
              }, 300);
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

            window.setTimeout(() => {
              installOperationalLayers({
                reason:
                  'pending-installation',
              });
            }, 0);
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

    const map = createMap(
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

    const handleMapError = (event) => {
      const error =
        event?.error ||
        event ||
        new Error(
          'Erro desconhecido no MapLibre.',
        );

      /*
       * Erro de tile raster não deve impedir a criação
       * das camadas GeoJSON operacionais.
       */
      console.warn(
        '[MapView] Erro reportado pelo MapLibre:',
        error,
      );
    };

    map.on('load', handleLoad);

    map.on(
      'style.load',
      handleStyleLoad,
    );

    map.on(
      'styledata',
      handleStyleData,
    );

    map.on('idle', handleIdle);
    map.on('error', handleMapError);

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
        map.off('load', handleLoad);

        map.off(
          'style.load',
          handleStyleLoad,
        );

        map.off(
          'styledata',
          handleStyleData,
        );

        map.off('idle', handleIdle);
        map.off('error', handleMapError);
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
    const map = mapRef.current;

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

    const changed = applyBaseMap(
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
        reason:
          'sync-completed',
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
   * Camadas do Modo Campo.
   */
  useEffect(() => {
    const updateFieldLayers = () => {
      const map = mapRef.current;

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
        map.easeTo({
          center: [
            coordinates[0],
            coordinates[1],
          ],

          zoom: Math.max(
            map.getZoom(),
            14,
          ),
        });
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