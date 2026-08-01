/**
 * useGeoFogo
 *
 * Hook principal de integração entre:
 * - AppCore;
 * - SyncEngine;
 * - LayerManager;
 * - LayerRegistry;
 * - FieldController;
 * - interface React.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { AppCore } from '../core/AppCore';
import { LayerManager } from '../layers/LayerManager';
import { LayerRegistry } from '../layers/LayerRegistry';
import { EventBus, EVENTS } from '../core/EventBus';
import { SyncEngine } from '../sync/SyncEngine';
import { FieldController } from '../field/FieldController';
import { ErrorManager } from '../core/ErrorManager';
import {
  config,
  saveUserOverrides,
} from '../core/config';
import { db } from '../storage/indexedDb';
import { computeAlerts } from '../alerts/AlertEngine';

export function useGeoFogo() {
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [syncState, setSyncState] = useState(
    SyncEngine.state,
  );

  const [syncMessage, setSyncMessage] =
    useState('');

  const [online, setOnline] = useState(
    typeof navigator !== 'undefined'
      ? navigator.onLine
      : true,
  );

  const [layers, setLayers] = useState([]);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [errors, setErrors] = useState([]);
  const [selectedFeature, setSelectedFeature] =
    useState(null);

  const [fieldState, setFieldState] = useState(
    FieldController.getState(),
  );

  const [baseMapId, setBaseMapId] = useState(
    config.defaultBaseMap,
  );

  const initializedRef = useRef(false);
  const mountedRef = useRef(false);
  const syncPromiseRef = useRef(null);

  /**
   * Atualiza no React o estado mantido pelos controladores.
   */
  const refreshApplicationState =
    useCallback(() => {
      if (!mountedRef.current) {
        return;
      }

      setLayers([
        ...LayerManager.getAllLayers(),
      ]);

      setStats(AppCore.getStats());
      setAlerts(AppCore.alerts || []);
      setErrors(ErrorManager.all());
      setSyncState(SyncEngine.state);
    }, []);

  /**
   * Executa uma sincronização.
   *
   * Evita sincronizações simultâneas e garante que o estado syncing
   * seja encerrado mesmo quando ocorrer uma exceção.
   */
  const handleSync = useCallback(async () => {
    if (syncPromiseRef.current) {
      return syncPromiseRef.current;
    }

    const syncPromise = (async () => {
      if (mountedRef.current) {
        setSyncing(true);
        setSyncMessage(
          'Preparando sincronização...',
        );
      }

      try {
        const result =
          await AppCore.syncAll();

        if (mountedRef.current) {
          setSyncState(
            SyncEngine.state || 'success',
          );
        }

        return result;
      } catch (error) {
        console.error(
          '[useGeoFogo] Falha na sincronização:',
          error,
        );

        ErrorManager.report(
          'sync',
          error,
          {
            origin:
              'useGeoFogo.handleSync',
          },
        );

        if (mountedRef.current) {
          setSyncState('error');

          setSyncMessage(
            error?.message ||
              'Não foi possível concluir a sincronização.',
          );
        }

        return null;
      } finally {
        if (mountedRef.current) {
          setSyncing(false);
          refreshApplicationState();
        }

        syncPromiseRef.current = null;
      }
    })();

    syncPromiseRef.current = syncPromise;

    return syncPromise;
  }, [refreshApplicationState]);

  /**
   * Subscriptions.
   *
   * Os listeners são registrados antes de AppCore.initialize() para
   * que nenhum evento inicial seja perdido.
   */
  useEffect(() => {
    mountedRef.current = true;

    const subscriptions = [
      EventBus.on(
        EVENTS.SYNC_STARTED,
        () => {
          if (!mountedRef.current) {
            return;
          }

          setSyncing(true);
          setSyncState('syncing');
        },
      ),

      EventBus.on(
        EVENTS.SYNC_PROGRESS,
        (payload = {}) => {
          if (!mountedRef.current) {
            return;
          }

          const { state, message } =
            payload;

          if (state) {
            setSyncState(state);
          }

          if (message) {
            setSyncMessage(message);
          }
        },
      ),

      EventBus.on(
        EVENTS.SYNC_COMPLETED,
        () => {
          if (!mountedRef.current) {
            return;
          }

          setSyncing(false);
          setSyncState('success');
          setSyncMessage(
            'Sincronização concluída.',
          );

          refreshApplicationState();
        },
      ),

      EventBus.on(
        EVENTS.SYNC_FAILED,
        (payload = {}) => {
          if (!mountedRef.current) {
            return;
          }

          setSyncing(false);

          setSyncState(
            SyncEngine.state || 'error',
          );

          setSyncMessage(
            payload.message ||
              'A sincronização não foi concluída.',
          );

          refreshApplicationState();
        },
      ),

      EventBus.on(
        EVENTS.DATA_UPDATED,
        () => {
          refreshApplicationState();
        },
      ),

      EventBus.on(
        EVENTS.CONNECTION_CHANGED,
        ({ online: isOnline } = {}) => {
          if (!mountedRef.current) {
            return;
          }

          setOnline(Boolean(isOnline));
        },
      ),

      EventBus.on(
        EVENTS.LAYER_VISIBILITY_CHANGED,
        () => {
          if (!mountedRef.current) {
            return;
          }

          setLayers([
            ...LayerManager.getAllLayers(),
          ]);
        },
      ),

      /*
       * Este listener atualiza apenas a interface.
       * Ele não chama novamente updateLayerData().
       */
      EventBus.on(
        EVENTS.LAYER_DATA_UPDATED,
        () => {
          if (!mountedRef.current) {
            return;
          }

          setLayers([
            ...LayerManager.getAllLayers(),
          ]);

          setStats(AppCore.getStats());
        },
      ),

      EventBus.on(
        EVENTS.ALERTS_UPDATED,
        (updatedAlerts) => {
          if (!mountedRef.current) {
            return;
          }

          setAlerts(
            Array.isArray(updatedAlerts)
              ? updatedAlerts
              : AppCore.alerts || [],
          );

          setStats(AppCore.getStats());
        },
      ),

      EventBus.on(
        EVENTS.ERROR,
        () => {
          if (!mountedRef.current) {
            return;
          }

          setErrors(ErrorManager.all());
        },
      ),

      EventBus.on(
        'layer:click',

        ({
          feature,
          layerId,
        } = {}) => {
          if (
            !mountedRef.current ||
            !feature
          ) {
            return;
          }

          const findOriginalFireEvent =
            ({
              originalId,
              eventId,
            }) => {
              return (
                AppCore.fireEvents
                  ?.features
                  ?.find(
                    (candidate) => {
                      const candidateId =
                        candidate?.id;

                      const candidateEventId =
                        candidate
                          ?.properties
                          ?.id_evento ??
                        candidate
                          ?.properties
                          ?.id;

                      if (
                        originalId !==
                          undefined &&
                        originalId !==
                          null &&
                        String(candidateId) ===
                          String(originalId)
                      ) {
                        return true;
                      }

                      if (
                        eventId !==
                          undefined &&
                        eventId !==
                          null &&
                        String(
                          candidateEventId,
                        ) ===
                          String(eventId)
                      ) {
                        return true;
                      }

                      return false;
                    },
                  ) ||
                null
              );
            };

          /*
          * O marcador é somente uma representação visual.
          * O popup deve sempre receber o polígono original.
          */
          if (
            layerId ===
            'fire-events-markers'
          ) {
            const properties =
              feature.properties ||
              {};

            const originalEvent =
              findOriginalFireEvent({
                originalId:
                  properties
                    ._originalId,

                eventId:
                  properties
                    ._eventId ??
                  properties
                    .id_evento ??
                  properties.id,
              });

            if (originalEvent) {
              setSelectedFeature({
                feature:
                  originalEvent,

                layerId:
                  'fire-events',
              });

              return;
            }

            console.warn(
              '[useGeoFogo] Evento original do marcador não encontrado:',
              {
                originalId:
                  properties
                    ._originalId,

                eventId:
                  properties
                    ._eventId ??
                  properties
                    .id_evento ??
                  properties.id,
              },
            );

            return;
          }

          /*
          * A frente de fogo também é somente uma representação
          * associada a um evento.
          *
          * Ao clicar nela, utilizamos id_evento para localizar
          * o polígono original do evento.
          */
          if (
            layerId ===
            'fire-fronts'
          ) {
            const properties =
              feature.properties ||
              {};

            const eventId =
              properties.id_evento;

            const originalEvent =
              findOriginalFireEvent({
                eventId,
              });

            if (originalEvent) {
              setSelectedFeature({
                feature:
                  originalEvent,

                layerId:
                  'fire-events',
              });

              return;
            }

            console.warn(
              '[useGeoFogo] Evento relacionado à frente de fogo não encontrado:',
              {
                frontId:
                  feature.id ??
                  properties
                    .id_agrupamento,

                eventId,

                classe:
                  properties.classe,

                intervalo:
                  properties.intervalo,
              },
            );

            return;
          }

          /*
          * Demais camadas continuam abrindo suas próprias
          * feições normalmente.
          */
          setSelectedFeature({
            feature,
            layerId,
          });
        },
      ),
    ];

    const fieldUnsubscribe =
      FieldController.subscribe((state) => {
        if (mountedRef.current) {
          setFieldState(state);
        }
      });

    return () => {
      mountedRef.current = false;

      subscriptions.forEach(
        (unsubscribe) => {
          unsubscribe?.();
        },
      );

      fieldUnsubscribe?.();
    };
  }, [refreshApplicationState]);

  /**
   * Inicialização única da aplicação.
   */
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const initializeApplication =
      async () => {
        try {
          setSyncMessage(
            'Inicializando o GeoFogo Ceará...',
          );

          await AppCore.initialize();

          if (!mountedRef.current) {
            return;
          }

          setLayers([
            ...LayerManager.getAllLayers(),
          ]);

          setSyncMessage(
            'Carregando dados armazenados...',
          );

          await AppCore.loadCachedData();

          if (!mountedRef.current) {
            return;
          }

          refreshApplicationState();
          setReady(true);

          /*
           * A interface fica pronta com o cache antes da tentativa de
           * sincronização remota.
           */
          await handleSync();
        } catch (error) {
          console.error(
            '[useGeoFogo] Falha durante a inicialização:',
            error,
          );

          ErrorManager.report(
            'sync',
            error,
            {
              origin:
                'useGeoFogo.initializeApplication',
            },
          );

          if (mountedRef.current) {
            /*
             * Mesmo com falha de rede ou armazenamento, liberamos a
             * interface para que o mapa-base continue utilizável e o
             * usuário possa tentar sincronizar novamente.
             */
            setReady(true);
            setSyncing(false);
            setSyncState('error');

            setSyncMessage(
              error?.message ||
                'A aplicação foi aberta, mas houve uma falha na inicialização.',
            );

            refreshApplicationState();
          }
        }
      };

    initializeApplication();
  }, [
    handleSync,
    refreshApplicationState,
  ]);

  const toggleLayer = useCallback(
    (layerId, visible) => {
      LayerManager.setVisibility(
        layerId,
        visible,
      );

      setLayers([
        ...LayerManager.getAllLayers(),
      ]);
    },
    [],
  );

  const setLayerOpacity = useCallback(
    (layerId, opacity) => {
      LayerManager.setOpacity(
        layerId,
        opacity,
      );

      setLayers([
        ...LayerManager.getAllLayers(),
      ]);
    },
    [],
  );

  const setAlertDistance =
    useCallback(async (kilometers) => {
      const numericDistance =
        Number(kilometers);

      if (
        !Number.isFinite(numericDistance) ||
        numericDistance < 0
      ) {
        throw new Error(
          'A distância do alerta deve ser um número maior ou igual a zero.',
        );
      }

      try {
        await saveUserOverrides(db, {
          alertDistanceKm:
            numericDistance,
        });

        EventBus.emit(
          EVENTS.CONFIG_CHANGED,
          {
            alertDistanceKm:
              numericDistance,
          },
        );

        if (
          AppCore.fireEvents &&
          AppCore.conservationUnits
        ) {

          AppCore.alerts =
            await computeAlerts(
              AppCore.fireEvents,
              AppCore.conservationUnits,
              numericDistance,
            );

          EventBus.emit(
            EVENTS.ALERTS_UPDATED,
            AppCore.alerts,
          );
        }

        refreshApplicationState();
      } catch (error) {
        ErrorManager.report(
          'spatial',
          error,
          {
            operation:
              'setAlertDistance',
            kilometers:
              numericDistance,
          },
        );

        throw error;
      }
    }, [refreshApplicationState]);

  const changeBaseMap = useCallback(
    (id) => {
      if (!id) {
        return;
      }

      setBaseMapId(id);
    },
    [],
  );

  const startFieldMode =
    useCallback(async () => {
      try {
        await FieldController.start();

        setFieldState(
          FieldController.getState(),
        );
      } catch (error) {
        ErrorManager.report(
          'field',
          error,
          {
            operation:
              'startFieldMode',
          },
        );

        throw error;
      }
    }, []);

  const stopFieldMode =
    useCallback(() => {
      try {
        FieldController.stop();

        setFieldState(
          FieldController.getState(),
        );
      } catch (error) {
        ErrorManager.report(
          'field',
          error,
          {
            operation:
              'stopFieldMode',
          },
        );
      }
    }, []);

  const toggleRecording =
    useCallback(() => {
      try {
        if (FieldController.recording) {
          FieldController.pauseRecording();
        } else {
          FieldController.startRecording();
        }

        setFieldState(
          FieldController.getState(),
        );
      } catch (error) {
        ErrorManager.report(
          'field',
          error,
          {
            operation:
              'toggleRecording',
          },
        );
      }
    }, []);

  const addFieldPoint = useCallback(
    (label, observation) => {
      try {
        FieldController.addPoint(
          label,
          observation,
        );

        setFieldState(
          FieldController.getState(),
        );
      } catch (error) {
        ErrorManager.report(
          'field',
          error,
          {
            operation:
              'addFieldPoint',
          },
        );

        throw error;
      }
    },
    [],
  );

  const closePopup = useCallback(() => {
    setSelectedFeature(null);
  }, []);

  return {
    ready,
    online,
    syncing,
    syncState,
    syncMessage,
    layers,
    stats,
    alerts,
    errors,
    selectedFeature,
    fieldState,
    baseMapId,

    layerGroups:
      LayerManager.getLayersByGroup(),

    baseMaps:
      LayerRegistry.getBaseMaps(),

    sync: handleSync,
    toggleLayer,
    setLayerOpacity,
    setAlertDistance,
    changeBaseMap,
    startFieldMode,
    stopFieldMode,
    toggleRecording,
    addFieldPoint,
    closePopup,
    config,
  };
}