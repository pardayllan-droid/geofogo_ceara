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
import {
  FieldMissionController,
} from '../field/FieldMissionController';
import { ErrorManager } from '../core/ErrorManager';

import {
  config,
  saveUserOverrides,
} from '../core/config';

import { db } from '../storage/indexedDb';
import { computeAlerts } from '../alerts/AlertEngine';

import { Perf } from '../utils/PerformanceMonitor';

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

  const [
    selectedFeature,
    setSelectedFeature,
  ] = useState(null);

  const [fieldState, setFieldState] = useState(
    FieldController.getState(),
  );

  const [missionState, setMissionState] = useState(
    FieldMissionController.getState(),
  );

  const [baseMapId, setBaseMapId] = useState(
    config.defaultBaseMap,
  );

  const initializedRef = useRef(false);
  const mountedRef = useRef(false);
  const syncPromiseRef = useRef(null);

  /**
   * Horário em que a tentativa de sincronização mais
   * recente terminou.
   *
   * Usado para evitar consultas automáticas
   * desnecessárias.
   */
  const lastSyncFinishedAtRef =
    useRef(0);

  /**
   * Impede que a rotina automática seja executada antes
   * da inicialização e da primeira tentativa de
   * sincronização.
   */
  const initialSyncCompletedRef =
    useRef(false);

  /**
   * Atualiza no React o estado mantido pelos
   * controladores.
   */
  const refreshApplicationState =
    useCallback(() => {
      if (!mountedRef.current) {
        return;
      }

      setLayers([
        ...LayerManager.getAllLayers(),
      ]);

      setStats(
        AppCore.getStats(),
      );

      setAlerts(
        AppCore.alerts || [],
      );

      setErrors(
        ErrorManager.all(),
      );

      setSyncState(
        SyncEngine.state,
      );
    }, []);

  /**
   * Executa uma sincronização.
   *
   * Evita sincronizações simultâneas e garante que o
   * estado syncing seja encerrado mesmo quando ocorrer
   * uma exceção.
   */
  const handleSync =
    useCallback(async () => {
      if (syncPromiseRef.current) {
        return syncPromiseRef.current;
      }

      const syncPromise =
        (async () => {
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
                SyncEngine.state ||
                  'success',
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
              setSyncState(
                'error',
              );

              setSyncMessage(
                error?.message ||
                  'Não foi possível concluir a sincronização.',
              );
            }

            return null;
          } finally {
            /**
             * Registra o término da tentativa, inclusive
             * quando alguma fonte falha.
             *
             * Isso evita repetição contínua em conexão
             * instável.
             */
            lastSyncFinishedAtRef.current =
              Date.now();

            if (mountedRef.current) {
              setSyncing(false);

              refreshApplicationState();
            }

            syncPromiseRef.current =
              null;
          }
        })();

      syncPromiseRef.current =
        syncPromise;

      return syncPromise;
    }, [
      refreshApplicationState,
    ]);

  /**
   * Subscriptions.
   *
   * Os listeners são registrados antes de
   * AppCore.initialize() para que nenhum evento inicial
   * seja perdido.
   */
  useEffect(() => {
    mountedRef.current =
      true;

    const subscriptions = [
      EventBus.on(
        EVENTS.SYNC_STARTED,
        () => {
          if (!mountedRef.current) {
            return;
          }

          setSyncing(true);

          setSyncState(
            'syncing',
          );
        },
      ),

      EventBus.on(
        EVENTS.SYNC_PROGRESS,
        (payload = {}) => {
          if (!mountedRef.current) {
            return;
          }

          const {
            state,
            message,
          } = payload;

          if (state) {
            setSyncState(
              state,
            );
          }

          if (message) {
            setSyncMessage(
              message,
            );
          }
        },
      ),

      EventBus.on(
        EVENTS.SYNC_TASK_COMPLETED,
        ({
          label,
        } = {}) => {
          if (!mountedRef.current) {
            return;
          }

          if (label) {
            setSyncMessage(
              `${label} atualizado.`,
            );
          }

          /**
           * Atualiza estatísticas e estado React assim
           * que uma tarefa individual termina.
           */
          refreshApplicationState();
        },
      ),

      EventBus.on(
        EVENTS.SYNC_COMPLETED,
        () => {
          if (!mountedRef.current) {
            return;
          }

          setSyncing(false);

          setSyncState(
            'success',
          );

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
            SyncEngine.state ||
              'error',
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
        ({
          online: isOnline,
        } = {}) => {
          if (!mountedRef.current) {
            return;
          }

          setOnline(
            Boolean(
              isOnline,
            ),
          );
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

      /**
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

          setStats(
            AppCore.getStats(),
          );
        },
      ),

      EventBus.on(
        EVENTS.ALERTS_UPDATED,
        (updatedAlerts) => {
          if (!mountedRef.current) {
            return;
          }

          const normalizedAlerts =
            Array.isArray(
              updatedAlerts,
            )
              ? updatedAlerts
              : AppCore.alerts ||
                [];

          /**
           * computeAlerts emite ALERTS_UPDATED antes de retornar
           * ao chamador. Portanto, sincronizamos explicitamente
           * a coleção do AppCore antes de recalcular os números
           * mostrados na aba Resumo.
           */
          AppCore.alerts =
            normalizedAlerts;

          const updatedStats =
            AppCore.refreshStats();

          setAlerts(
            normalizedAlerts,
          );

          setStats(
            updatedStats,
          );
        },
      ),

      EventBus.on(
        EVENTS.ERROR,
        () => {
          if (!mountedRef.current) {
            return;
          }

          setErrors(
            ErrorManager.all(),
          );
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
                    (
                      candidate,
                    ) => {
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
                        String(
                          candidateId,
                        ) ===
                          String(
                            originalId,
                          )
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
                          String(
                            eventId,
                          )
                      ) {
                        return true;
                      }

                      return false;
                    },
                  ) ||
                null
              );
            };

          /**
           * O marcador é somente uma representação
           * visual.
           *
           * O popup deve sempre receber o polígono
           * original.
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

          /**
           * A frente de fogo também é somente uma
           * representação associada a um evento.
           *
           * Ao clicar nela, utilizamos id_evento para
           * localizar o polígono original.
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

          /**
           * Demais camadas continuam abrindo suas
           * próprias feições normalmente.
           */
          setSelectedFeature({
            feature,
            layerId,
          });
        },
      ),
    ];

    const fieldUnsubscribe =
      FieldController.subscribe(
        (state) => {
          if (mountedRef.current) {
            setFieldState(
              state,
            );
          }
        },
      );

    const missionUnsubscribe =
      FieldMissionController.subscribe(
        (state) => {
          if (
            mountedRef.current
          ) {
            setMissionState(
              state,
            );
          }
        },
      );

    return () => {
      mountedRef.current =
        false;

      subscriptions.forEach(
        (
          unsubscribe,
        ) => {
          unsubscribe?.();
        },
      );

      fieldUnsubscribe?.();
      missionUnsubscribe?.();
    };
  }, [
    refreshApplicationState,
  ]);

  /**
   * Inicialização única da aplicação.
   */
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current =
      true;

    const initializeApplication =
      async () => {
        Perf.reset();

        try {
          setSyncMessage(
            'Inicializando o GeoFogo Ceará...',
          );

          Perf.start(
            'Inicialização do núcleo',
          );

          await AppCore.initialize();

          Perf.end(
            'Inicialização do núcleo',
          );

          /**
           * Carrega o catálogo de missões sem ativar o GPS.
           *
           * Isso permite mostrar e administrar missões antes
           * de o usuário iniciar o Modo Campo.
           */
          await FieldMissionController.initialize();

          if (
            mountedRef.current
          ) {
            setMissionState(
              FieldMissionController.getState(),
            );
          }

          if (
            !mountedRef.current
          ) {
            return;
          }

          setLayers([
            ...LayerManager.getAllLayers(),
          ]);

          setSyncMessage(
            'Carregando dados armazenados...',
          );

          Perf.start(
            'Carregamento do cache',
          );

          await AppCore.loadCachedData();

          Perf.end(
            'Carregamento do cache',
          );

          if (
            !mountedRef.current
          ) {
            return;
          }

          refreshApplicationState();

          /**
           * Neste ponto a aplicação já está utilizável
           * com os dados armazenados.
           */
          setReady(
            true,
          );

          Perf.start(
            'Sincronização remota completa',
          );

          await handleSync();

          Perf.end(
            'Sincronização remota completa',
          );

          initialSyncCompletedRef.current =
            true;

          Perf.report();
        } catch (error) {
          /**
           * Encerra medições que possam ter ficado abertas.
           */
          Perf.cancel(
            'Inicialização do núcleo',
          );

          Perf.cancel(
            'Carregamento do cache',
          );

          Perf.cancel(
            'Sincronização remota completa',
          );

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

          if (
            mountedRef.current
          ) {
            setReady(
              true,
            );

            setSyncing(
              false,
            );

            setSyncState(
              'error',
            );

            setSyncMessage(
              error?.message ||
                'A aplicação foi aberta, mas houve uma falha na inicialização.',
            );

            refreshApplicationState();
          }

          initialSyncCompletedRef.current =
            true;

          Perf.report();
        }
      };

    initializeApplication();
  }, [
    handleSync,
    refreshApplicationState,
  ]);

  /**
   * Sincronização automática dos dados dinâmicos.
   *
   * Regras:
   * - executa a cada config.fireRefreshMinutes;
   * - só executa quando a página está visível e online;
   * - não permite sincronizações simultâneas;
   * - ao voltar do segundo plano, só sincroniza quando
   *   o intervalo mínimo já tiver transcorrido.
   *
   * As camadas estáticas continuam protegidas pelo
   * CachePolicy dentro do AppCore.syncAll().
   */
  useEffect(() => {
    const configuredMinutes =
      Number(
        config.fireRefreshMinutes,
      );

    const refreshMinutes =
      Number.isFinite(
        configuredMinutes,
      ) &&
      configuredMinutes > 0
        ? configuredMinutes
        : 60;

    const refreshIntervalMs =
      refreshMinutes *
      60 *
      1000;

    const isRefreshDue =
      () => {
        const lastFinishedAt =
          Number(
            lastSyncFinishedAtRef.current,
          );

        if (
          !Number.isFinite(
            lastFinishedAt,
          ) ||
          lastFinishedAt <= 0
        ) {
          return true;
        }

        return (
          Date.now() -
            lastFinishedAt >=
          refreshIntervalMs
        );
      };

    const runAutomaticSync =
      async (
        reason,
      ) => {
        if (
          !mountedRef.current ||
          !initialSyncCompletedRef.current ||
          syncPromiseRef.current ||
          navigator.onLine ===
            false ||
          document.visibilityState ===
            'hidden' ||
          !isRefreshDue()
        ) {
          return;
        }

        console.info(
          '[useGeoFogo] Iniciando sincronização automática:',
          {
            reason,

            refreshMinutes,

            lastSyncFinishedAt:
              lastSyncFinishedAtRef.current
                ? new Date(
                    lastSyncFinishedAtRef.current,
                  ).toISOString()
                : null,
          },
        );

        await handleSync();
      };

    /**
     * O intervalo funciona enquanto a página permanece
     * aberta e ativa.
     */
    const intervalId =
      window.setInterval(
        () => {
          runAutomaticSync(
            'interval',
          );
        },
        refreshIntervalMs,
      );

    /**
     * Navegadores móveis podem suspender timers em
     * segundo plano.
     *
     * Ao retornar, verificamos se o intervalo venceu.
     */
    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          runAutomaticSync(
            'visibilitychange',
          );
        }
      };

    /**
     * Cobre restauração da página pelo cache de navegação
     * do navegador.
     */
    const handlePageShow =
      () => {
        runAutomaticSync(
          'pageshow',
        );
      };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    window.addEventListener(
      'pageshow',
      handlePageShow,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      window.removeEventListener(
        'pageshow',
        handlePageShow,
      );
    };
  }, [
    handleSync,
  ]);

  const toggleLayer =
    useCallback(
      (
        layerId,
        visible,
      ) => {
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

  const setLayerOpacity =
    useCallback(
      (
        layerId,
        opacity,
      ) => {
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
    useCallback(
      async (
        kilometers,
      ) => {
        const numericDistance =
          Number(
            kilometers,
          );

        if (
          !Number.isFinite(
            numericDistance,
          ) ||
          numericDistance < 0
        ) {
          throw new Error(
            'A distância do alerta deve ser um número maior ou igual a zero.',
          );
        }

        try {
          await saveUserOverrides(
            db,
            {
              alertDistanceKm:
                numericDistance,
            },
          );

          EventBus.emit(
            EVENTS.CONFIG_CHANGED,
            {
              alertDistanceKm:
                numericDistance,
            },
          );

          if (
            AppCore.fireEvents &&
            AppCore.sensitiveAreas
          ) {
            AppCore.alerts =
              await computeAlerts(
                AppCore.fireEvents,
                AppCore.sensitiveAreas,
                numericDistance,
              );

            /**
             * computeAlerts já emite ALERTS_UPDATED, mas nessa emissão
             * o retorno ainda não havia sido atribuído a AppCore.alerts.
             *
             * Recalculamos e emitimos novamente para garantir que todos
             * os consumidores recebam o estado final consolidado.
             */
            AppCore.refreshStats();

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
      },
      [
        refreshApplicationState,
      ],
    );

  const changeBaseMap =
    useCallback(
      (
        id,
      ) => {
        if (!id) {
          return;
        }

        setBaseMapId(
          id,
        );
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
    useCallback(
      async () => {
        try {
          await FieldController.stop();

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

          throw error;
        }
      },
      [],
    );

  const toggleRecording =
    useCallback(
      (
        options =
          {},
      ) => {
        try {
          if (
            FieldController.recording
          ) {
            FieldController.pauseRecording();
          } else {
            FieldController.startRecording(
              options,
            );
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

          throw error;
        }
      },
      [],
    );

  /**
   * Finaliza somente o trilho atual.
   *
   * O Modo Campo e o GPS permanecem ativos para:
   * - iniciar outro trilho;
   * - registrar pontos independentes;
   * - consultar a posição atual.
   */
  const finishFieldTrail =
    useCallback(
      async () => {
        try {
          await FieldController.stopRecording();

          setFieldState(
            FieldController.getState(),
          );
        } catch (error) {
          ErrorManager.report(
            'field',
            error,
            {
              operation:
                'finishFieldTrail',
            },
          );

          throw error;
        }
      },
      [],
    );

  const addFieldPoint =
    useCallback(
      (
        label,
        observation,
        options =
          {},
      ) => {
        try {
          const point =
            FieldController.addPoint(
              label,
              observation,
              options,
            );

          setFieldState(
            FieldController.getState(),
          );

          return point;
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

  const addFieldPointAtCoordinates =
    useCallback(
      (
        coordinates,
      ) => {
        try {
          const point =
            FieldController.addPointAtCoordinates(
              coordinates,
            );

          setFieldState(
            FieldController.getState(),
          );

          return point;
        } catch (error) {
          ErrorManager.report(
            'field',
            error,
            {
              operation:
                'addFieldPointAtCoordinates',
            },
          );

          throw error;
        }
      },
      [],
    );

  const getFieldMissionRecords =
    useCallback(
      (
        missionId,
      ) => {
        return FieldController
          .getMissionRecords(
            missionId,
          );
      },
      [],
    );

  const getUnassignedFieldRecords =
    useCallback(
      () => {
        return FieldController
          .getUnassignedRecords();
      },
      [],
    );

  const toggleFieldTrailVisibility =
    useCallback(
      async (
        trailId,
      ) => {
        try {
          const trail =
            await FieldController
              .toggleTrailVisibility(
                trailId,
              );

          setFieldState(
            FieldController.getState(),
          );

          return trail;
        } catch (error) {
          ErrorManager.report(
            'field',
            error,
            {
              operation:
                'toggleFieldTrailVisibility',

              trailId,
            },
          );

          throw error;
        }
      },
      [],
    );

  const toggleFieldPointVisibility =
    useCallback(
      async (
        pointId,
      ) => {
        try {
          const point =
            await FieldController
              .togglePointVisibility(
                pointId,
              );

          setFieldState(
            FieldController.getState(),
          );

          return point;
        } catch (error) {
          ErrorManager.report(
            'field',
            error,
            {
              operation:
                'toggleFieldPointVisibility',

              pointId,
            },
          );

          throw error;
        }
      },
      [],
    );

  const deleteFieldTrail =
    useCallback(
      async (
        trailId,
      ) => {
        try {
          await FieldController.deleteTrail(
            trailId,
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
                'deleteFieldTrail',

              trailId,
            },
          );

          throw error;
        }
      },
      [],
    );

  const deleteFieldPoint =
    useCallback(
      async (
        pointId,
      ) => {
        try {
          await FieldController.deletePoint(
            pointId,
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
                'deleteFieldPoint',

              pointId,
            },
          );

          throw error;
        }
      },
      [],
    );

  const createFieldMission =
    useCallback(
      async (
        missionData,
      ) => {
        try {
          const mission =
            await FieldMissionController.createMission(
              missionData,
            );

          setMissionState(
            FieldMissionController.getState(),
          );

          return mission;
        } catch (error) {
          ErrorManager.report(
            'field',
            error,
            {
              operation:
                'createFieldMission',
            },
          );

          throw error;
        }
      },
      [],
    );

  const setActiveFieldMission =
    useCallback(
      async (
        missionId,
      ) => {
        try {
          await FieldMissionController.setActiveMission(
            missionId,
          );

          setMissionState(
            FieldMissionController.getState(),
          );
        } catch (error) {
          ErrorManager.report(
            'field',
            error,
            {
              operation:
                'setActiveFieldMission',

              missionId,
            },
          );

          throw error;
        }
      },
      [],
    );

  const clearActiveFieldMission =
    useCallback(
      () => {
        try {
          const state =
            FieldMissionController
              .clearActiveMission();

          setMissionState(
            state,
          );

          return state;
        } catch (error) {
          ErrorManager.report(
            'field',
            error,
            {
              operation:
                'clearActiveFieldMission',
            },
          );

          throw error;
        }
      },
      [],
    );

  const toggleFieldMissionVisibility =
    useCallback(
      async (
        missionId,
      ) => {
        try {
          await FieldMissionController.toggleVisibility(
            missionId,
          );

          setMissionState(
            FieldMissionController.getState(),
          );
        } catch (error) {
          ErrorManager.report(
            'field',
            error,
            {
              operation:
                'toggleFieldMissionVisibility',

              missionId,
            },
          );

          throw error;
        }
      },
      [],
    );

  const deleteFieldMission =
    useCallback(
      async (
        missionId,
      ) => {
        try {
          await FieldMissionController.deleteMission(
            missionId,
          );

          setMissionState(
            FieldMissionController.getState(),
          );
        } catch (error) {
          ErrorManager.report(
            'field',
            error,
            {
              operation:
                'deleteFieldMission',

              missionId,
            },
          );

          throw error;
        }
      },
      [],
    );

  const closePopup =
    useCallback(() => {
      setSelectedFeature(
        null,
      );
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
    missionState,
    baseMapId,

    layerGroups:
      LayerManager.getLayersByGroup(),

    baseMaps:
      LayerRegistry.getBaseMaps(),

    sync:
      handleSync,

    toggleLayer,
    setLayerOpacity,
    setAlertDistance,
    changeBaseMap,
    startFieldMode,
    stopFieldMode,
    toggleRecording,
    finishFieldTrail,
    addFieldPoint,
    addFieldPointAtCoordinates,
    getFieldMissionRecords,
    getUnassignedFieldRecords,
    toggleFieldTrailVisibility,
    toggleFieldPointVisibility,
    deleteFieldTrail,
    deleteFieldPoint,
    createFieldMission,
    setActiveFieldMission,
    clearActiveFieldMission,
    toggleFieldMissionVisibility,
    deleteFieldMission,
    closePopup,
    
    config,
  };
}