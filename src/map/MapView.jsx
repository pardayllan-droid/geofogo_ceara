/**
 * MapView
 *
 * Componente React responsável por:
 * - criar e destruir o mapa MapLibre;
 * - conectar o mapa ao LayerManager;
 * - instalar e restaurar as camadas operacionais;
 * - atualizar as camadas quando o AppCore mudar;
 * - acompanhar o Modo Campo;
 * - trocar o mapa-base;
 * - enquadrar o limite do Ceará.
 *
 * Regra arquitetural:
 * este componente não chama map.addSource() ou map.addLayer()
 * diretamente. Essas operações pertencem ao LayerManager.
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

function hasFeatureCollection(value) {
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

export default function MapView({
  baseMapId,
  onReady,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const baseMapRef = useRef(baseMapId);
  const mountedRef = useRef(false);

  const installingRef = useRef(false);
  const installPendingRef = useRef(false);
  const retryTimerRef = useRef(null);
  const fittedRef = useRef(false);

  /**
   * Cancela uma tentativa agendada anteriormente.
   */
  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      window.clearTimeout(
        retryTimerRef.current,
      );

      retryTimerRef.current = null;
    }
  }, []);

  /**
   * Envia uma coleção ao LayerManager.
   *
   * Coleções vazias também são válidas para camadas
   * dinâmicas, pois permitem limpar dados antigos.
   */
  const updateLayer = useCallback(
    (layerId, collection) => {
      if (
        !hasFeatureCollection(collection)
      ) {
        return false;
      }

      try {
        return LayerManager.updateLayerData(
          layerId,
          collection,
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
              featureCount(collection),
          },
        );

        return false;
      }
    },
    [],
  );

  /**
   * Transfere todos os dados atuais do AppCore
   * para o LayerManager.
   */
  const updateAllLayerData =
    useCallback(() => {
      const results = [];

      if (
        hasFeatureCollection(
          AppCore.cearaBoundary,
        )
      ) {
        results.push(
          updateLayer(
            'ceara-boundary',
            AppCore.cearaBoundary,
          ),
        );
      }

      if (
        hasFeatureCollection(
          AppCore.municipalities,
        )
      ) {
        results.push(
          updateLayer(
            'municipalities',
            AppCore.municipalities,
          ),
        );
      }

      if (
        hasFeatureCollection(
          AppCore.conservationUnits,
        )
      ) {
        results.push(
          updateLayer(
            'conservation-units',
            AppCore.conservationUnits,
          ),
        );
      }

      if (
        hasFeatureCollection(
          AppCore.fireEvents,
        )
      ) {
        results.push(
          updateLayer(
            'fire-events',
            AppCore.fireEvents,
          ),
        );

        const markers =
          AppCore.getFireEventMarkers?.() ||
          EMPTY_FEATURE_COLLECTION;

        results.push(
          updateLayer(
            'fire-events-markers',
            markers,
          ),
        );
      }

      if (
        hasFeatureCollection(
          AppCore.fireFronts,
        )
      ) {
        results.push(
          updateLayer(
            'fire-fronts',
            AppCore.fireFronts,
          ),
        );
      }

      /*
       * Alert buffers são derivados dos alertas.
       * Enquanto não houver um método específico,
       * a camada recebe uma coleção vazia para evitar
       * manter dados antigos no mapa.
       */
      if (
        LayerManager.getLayer(
          'alert-buffers',
        )
      ) {
        const alertBuffers =
          AppCore.getAlertBuffers?.() ||
          EMPTY_FEATURE_COLLECTION;

        results.push(
          updateLayer(
            'alert-buffers',
            alertBuffers,
          ),
        );
      }

      return results;
    }, [updateLayer]);

  /**
   * Instala ou restaura todas as camadas operacionais.
   *
   * A função é idempotente:
   * pode ser chamada após load, style.load, idle,
   * sincronização e troca de mapa-base.
   */
  const installOperationalLayers =
    useCallback(
      async ({
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
          installPendingRef.current = true;
          return false;
        }

        let styleLoaded = false;

        try {
          styleLoaded =
            map.isStyleLoaded?.() === true;
        } catch {
          styleLoaded = false;
        }

        if (!styleLoaded) {
          if (attempt < 10) {
            clearRetryTimer();

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
        installPendingRef.current = false;

        try {
          /*
           * A conexão é renovada sempre que instalamos.
           * Isso protege contra:
           * - remontagem do componente;
           * - troca de estilo;
           * - troca de mapa-base;
           * - referências antigas no LayerManager.
           */
          LayerManager.setMap(map);

          /*
           * Primeiro, enviamos os dados atuais.
           * updateLayerData cria as sources/layers quando
           * o estilo está pronto.
           */
          updateAllLayerData();

          /*
           * Depois, pedimos restauração explícita.
           * Isso cobre sources preservadas em memória
           * antes de o mapa estar disponível.
           */
          LayerManager.restoreAllLayers?.();

          /*
           * Segunda passagem:
           * algumas versões do MapLibre podem concluir
           * a criação da source antes da layer.
           */
          updateAllLayerData();

          try {
            map.resize();
          } catch {
            // Redimensionamento não é essencial.
          }

          const boundaryLayerCreated =
            Boolean(
              map.getLayer?.(
                'ceara-boundary',
              ),
            );

          const municipalitiesCreated =
            Boolean(
              map.getLayer?.(
                'municipalities',
              ),
            );

          const result = {
            reason,
            attempt,

            boundaryFeatures:
              featureCount(
                AppCore.cearaBoundary,
              ),

            municipalityFeatures:
              featureCount(
                AppCore.municipalities,
              ),

            boundarySourceCreated:
              Boolean(
                map.getSource?.(
                  'src-ceara-boundary',
                ),
              ),

            boundaryLayerCreated,

            municipalitiesSourceCreated:
              Boolean(
                map.getSource?.(
                  'src-municipalities',
                ),
              ),

            municipalitiesLayerCreated:
              municipalitiesCreated,
          };

          console.info(
            '[MapView] Instalação das camadas:',
            result,
          );

          /*
           * Caso existam dados territoriais e as layers
           * ainda não tenham sido criadas, registramos um
           * erro que aparecerá no painel de diagnóstico.
           */
          if (
            featureCount(
              AppCore.cearaBoundary,
            ) > 0 &&
            !boundaryLayerCreated
          ) {
            ErrorManager.report(
              'layer',
              new Error(
                'O limite do Ceará possui dados, mas a layer não foi criada no mapa.',
              ),
              {
                operation:
                  'installOperationalLayers',

                reason,
                attempt,

                sourceCreated:
                  Boolean(
                    map.getSource?.(
                      'src-ceara-boundary',
                    ),
                  ),

                styleLoaded:
                  map.isStyleLoaded?.(),
              },
            );
          }

          if (
            featureCount(
              AppCore.municipalities,
            ) > 0 &&
            !municipalitiesCreated
          ) {
            ErrorManager.report(
              'layer',
              new Error(
                'Os municípios possuem dados, mas a layer não foi criada no mapa.',
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

                sourceCreated:
                  Boolean(
                    map.getSource?.(
                      'src-municipalities',
                    ),
                  ),

                styleLoaded:
                  map.isStyleLoaded?.(),
              },
            );
          }

          /*
           * Faz o enquadramento apenas quando a layer
           * territorial estiver efetivamente instalada.
           */
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

          return (
            boundaryLayerCreated ||
            municipalitiesCreated
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
            },
          );

          return false;
        } finally {
          installingRef.current = false;

          /*
           * Se algum evento pediu instalação enquanto
           * esta execução estava ativa, executamos mais
           * uma passagem.
           */
          if (
            installPendingRef.current &&
            mountedRef.current
          ) {
            installPendingRef.current = false;

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
        clearRetryTimer,
        updateAllLayerData,
      ],
    );

  /**
   * Criação e destruição do mapa.
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

      LayerManager.setMap(map);

      fittedRef.current = false;
      AppCore._fitted = false;

      installOperationalLayers({
        reason: 'style-load',
      });
    };

    const handleIdle = () => {
      if (!mountedRef.current) {
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

      /*
       * idle pode ocorrer muitas vezes.
       * Só reinstalamos quando uma camada esperada
       * estiver realmente ausente.
       */
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

      ErrorManager.report(
        'map',
        error,
        {
          operation:
            'MapView.map-error',
        },
      );
    };

    /*
     * createMap já possui um listener interno de load.
     * Estes listeners complementares tornam o fluxo
     * resiliente a mudanças de estilo.
     */
    map.on('load', handleLoad);
    map.on(
      'style.load',
      handleStyleLoad,
    );
    map.on('idle', handleIdle);
    map.on('error', handleMapError);

    /*
     * Caso o mapa esteja pronto antes de os handlers
     * acima serem registrados.
     */
    if (map.loaded?.()) {
      handleLoad();
    }

    return () => {
      mountedRef.current = false;

      clearRetryTimer();

      installPendingRef.current = false;
      installingRef.current = false;

      try {
        map.off('load', handleLoad);
        map.off(
          'style.load',
          handleStyleLoad,
        );
        map.off('idle', handleIdle);
        map.off(
          'error',
          handleMapError,
        );
      } catch {
        // O mapa pode já ter sido destruído.
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
    clearRetryTimer,
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

    fittedRef.current = false;
    AppCore._fitted = false;

    applyBaseMap(
      map,
      baseMapId,
      {
        onStyleReady: () => {
          installOperationalLayers({
            reason:
              'base-map-changed',
          });
        },
      },
    );
  }, [
    baseMapId,
    installOperationalLayers,
  ]);

  /**
   * Atualiza as camadas quando o núcleo muda.
   *
   * Importante:
   * não escutamos LAYER_DATA_UPDATED, pois esse evento
   * é emitido pelo próprio updateLayerData().
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
   * Atualização periódica do Modo Campo.
   */
  useEffect(() => {
    const updateFieldLayers = () => {
      const map = mapRef.current;

      if (
        !FieldController.active ||
        !map ||
        map.isStyleLoaded?.() !== true
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

      const currentPosition =
        FieldController.currentPosition;

      if (
        currentPosition?.geometry
          ?.coordinates
      ) {
        const [
          longitude,
          latitude,
        ] =
          currentPosition.geometry
            .coordinates;

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