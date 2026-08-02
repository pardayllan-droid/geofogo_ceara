/**
 * AppCore — núcleo central da aplicação.
 *
 * Coordena:
 * - ConfigManager;
 * - IndexedDB;
 * - LayerManager;
 * - SyncEngine;
 * - AlertEngine;
 * - Áreas Sensíveis;
 * - estatísticas e dados operacionais.
 *
 * O Core NÃO:
 * - renderiza JSX;
 * - adiciona camadas diretamente ao mapa;
 * - executa consultas externas dentro de componentes.
 */

import {
  config,
  loadUserOverrides,
} from './config';

import {
  EventBus,
  EVENTS,
} from './EventBus';

import {
  initDB,
  db,
} from '../storage/indexedDb';

import {
  LayerRegistry,
} from '../layers/LayerRegistry';

import {
  LayerManager,
} from '../layers/LayerManager';

import {
  SyncEngine,
} from '../sync/SyncEngine';

import {
  loadCearaBoundary,
  loadMunicipalities,
  computeBbox,
  getBoundaryPolygon,
} from '../services/municipalityService';

import {
  loadConservationUnits,
} from '../services/conservationUnitService';

import {
  loadIndigenousLands,
} from '../services/indigenousLandService';

import {
  loadFireEvents,
  loadFireFronts,
  getCachedFireEvents,
  getCachedFireFronts,
} from '../services/sipamService';

import {
  computeAlerts,
  getCachedAlerts,
} from '../alerts/AlertEngine';

import {
  filterByBoundary,
  computeArea,
  representativePoint,
  findNearby,
} from '../spatial/SpatialEngine';

import {
  enrichFireEventsWithMunicipalities,
} from '../services/fireEventEnrichmentService';

import {
  enrichFireEventsAge,
} from '../utils/fireEventAge';

import {
  sortFireEventsForRendering,
  sortFireFrontsForRendering,
} from '../utils/temporalFeatureOrder';

import {
  shouldRefreshCache,
  getCacheStatus,
} from './CachePolicy';

import {
  buildSensitiveAreasCollection,
  summarizeSensitiveAreas,
} from '../sensitive/SensitiveAreaRegistry';

const EMPTY_FEATURE_COLLECTION = {
  type:
    'FeatureCollection',

  features:
    [],
};

function isFeatureCollection(
  data,
) {
  return (
    data?.type ===
      'FeatureCollection' &&
    Array.isArray(
      data.features,
    )
  );
}

function createEmptyFeatureCollection() {
  return {
    type:
      'FeatureCollection',

    features:
      [],
  };
}

class AppCoreImpl {
  constructor() {
    this.initialized =
      false;

    this.cearaBoundary =
      null;

    this.cearaBbox =
      null;

    this.municipalities =
      null;

    this.conservationUnits =
      null;

    this.indigenousLands =
      null;

    /**
     * Coleção derivada que combina todas as fontes
     * reconhecidas como Áreas Sensíveis.
     *
     * Atualmente:
     * - Unidades de Conservação;
     * - Terras Indígenas.
     */
    this.sensitiveAreas =
      createEmptyFeatureCollection();

    this.fireEvents =
      null;

    this.fireFronts =
      null;

    this.alerts =
      [];

    this.stats =
      null;

    /**
     * Mantém os registros completos do IndexedDB.
     *
     * Os registros incluem:
     * - data;
     * - updated_date;
     * - metadados da fonte.
     *
     * O CachePolicy usa essas informações para decidir
     * se cada camada estática precisa ser atualizada.
     */
    this.cacheRecords = {
      boundary:
        null,

      municipalities:
        null,

      conservationUnits:
        null,

      indigenousLands:
        null,
    };
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    await initDB();

    await loadUserOverrides(
      db,
    );

    LayerRegistry.initialize();

    LayerManager.registerAll(
      LayerRegistry.getDefinitions(),
    );

    /**
     * Listeners de conexão.
     */
    window.addEventListener(
      'online',
      () =>
        EventBus.emit(
          EVENTS.CONNECTION_CHANGED,
          {
            online:
              true,
          },
        ),
    );

    window.addEventListener(
      'offline',
      () =>
        EventBus.emit(
          EVENTS.CONNECTION_CHANGED,
          {
            online:
              false,
          },
        ),
    );

    this.initialized =
      true;

    EventBus.emit(
      EVENTS.APP_READY,
      {},
    );
  }

  /**
   * Carrega os dados existentes no IndexedDB.
   *
   * A ordem é importante:
   * 1. limite do Ceará;
   * 2. municípios;
   * 3. UCs e Terras Indígenas;
   * 4. construção das Áreas Sensíveis;
   * 5. eventos e frentes filtrados pelo Ceará.
   */
  async loadCachedData() {
    const cachedBoundary =
      await db.get(
        db.stores.boundary,
        'latest',
      );

    this.cacheRecords.boundary =
      cachedBoundary ||
      null;

    if (
      cachedBoundary?.data
    ) {
      this.cearaBoundary =
        cachedBoundary.data;

      this.cearaBbox =
        computeBbox(
          cachedBoundary.data,
        );
    }

    const cachedMunicipalities =
      await db.get(
        db.stores.municipalities,
        'latest',
      );

    this.cacheRecords.municipalities =
      cachedMunicipalities ||
      null;

    if (
      cachedMunicipalities?.data
    ) {
      this.municipalities =
        cachedMunicipalities.data;
    }

    const cachedConservationUnits =
      await db.get(
        db.stores.conservationUnits,
        'latest',
      );

    this.cacheRecords.conservationUnits =
      cachedConservationUnits ||
      null;

    if (
      cachedConservationUnits?.data
    ) {
      this.conservationUnits =
        cachedConservationUnits.data;
    }

    const cachedIndigenousLands =
      await db.get(
        db.stores.indigenousLands,
        'latest',
      );

    this.cacheRecords.indigenousLands =
      cachedIndigenousLands ||
      null;

    if (
      cachedIndigenousLands?.data
    ) {
      this.indigenousLands =
        cachedIndigenousLands.data;
    }

    /**
     * Constrói a coleção derivada depois que as duas
     * fontes atuais estiverem disponíveis.
     */
    this._rebuildSensitiveAreas();

    /**
     * O cache do SIPAM preserva a resposta original
     * recebida pelo BBOX.
     *
     * Essa resposta pode conter feições externas ao
     * limite real do Ceará.
     */
    const boundaryPoly =
      getBoundaryPolygon(
        this.cearaBoundary,
      );

    const cachedFireEvents =
      await getCachedFireEvents();

    /**
     * Sem o limite do Ceará, não exibimos o cache bruto.
     */
    const cachedEventsInsideCeara =
      boundaryPoly
        ? filterByBoundary(
            cachedFireEvents,
            boundaryPoly,
          )
        : createEmptyFeatureCollection();

    const cachedEventsWithMunicipality =
      enrichFireEventsWithMunicipalities(
        cachedEventsInsideCeara,
        this.municipalities,
      );

    const cachedEventsWithAge =
      enrichFireEventsAge(
        cachedEventsWithMunicipality,
      );

    this.fireEvents =
      sortFireEventsForRendering(
        cachedEventsWithAge,
      );

    const cachedFireFronts =
      await getCachedFireFronts();

    const cachedFrontsInsideCeara =
      boundaryPoly
        ? filterByBoundary(
            cachedFireFronts,
            boundaryPoly,
          )
        : createEmptyFeatureCollection();

    this.fireFronts =
      sortFireFrontsForRendering(
        cachedFrontsInsideCeara,
      );

    this.alerts =
      await getCachedAlerts();

    this._updateStats();

    EventBus.emit(
      EVENTS.DATA_UPDATED,
      {
        source:
          'cache',
      },
    );
  }

  /**
   * Sincroniza os dados.
   *
   * forceStaticRefresh:
   * - false: respeita o prazo definido no CachePolicy;
   * - true: força a atualização das camadas estáticas.
   */
  async syncAll(
    {
      forceStaticRefresh =
        false,
    } = {},
  ) {
    /**
     * Fase 1:
     * limite do Ceará e municípios.
     *
     * São pré-requisitos para:
     * - filtro territorial;
     * - enriquecimento municipal;
     * - consultas SIPAM por BBOX.
     */
    const phase1 =
      {};

    if (
      this._shouldRefreshStaticLayer(
        'boundary',
        this.cearaBoundary,
        forceStaticRefresh,
      )
    ) {
      phase1.boundary = {
        label:
          'Limite do Ceará',

        module:
          'layer',

        affectedLayers: [
          'ceara-boundary',
        ],

        fn: async ({
          signal,
        } = {}) => {
          const boundary =
            await loadCearaBoundary({
              signal,
            });

          if (
            !boundary
              ?.features
              ?.length
          ) {
            throw new Error(
              'O limite do Ceará não contém feições.',
            );
          }

          this.cearaBoundary =
            boundary;

          this.cearaBbox =
            computeBbox(
              boundary,
            );

          await this._reloadCacheRecord(
            'boundary',
            db.stores.boundary,
          );

          return boundary;
        },
      };
    }

    if (
      this._shouldRefreshStaticLayer(
        'municipalities',
        this.municipalities,
        forceStaticRefresh,
      )
    ) {
      phase1.municipalities = {
        label:
          'Municípios',

        module:
          'layer',

        affectedLayers: [
          'municipalities',
        ],

        fn: async ({
          signal,
        } = {}) => {
          const municipalities =
            await loadMunicipalities({
              signal,
            });

          if (
            !municipalities
              ?.features
              ?.length
          ) {
            throw new Error(
              'A malha municipal não contém feições.',
            );
          }

          this.municipalities =
            municipalities;

          await this._reloadCacheRecord(
            'municipalities',
            db.stores.municipalities,
          );

          return municipalities;
        },
      };
    }

    if (
      Object.keys(
        phase1,
      ).length > 0
    ) {
      await SyncEngine.sync(
        phase1,
      );
    }

    /**
     * Fase 2:
     * - UCs e Terras Indígenas respeitam CachePolicy;
     * - eventos e frentes atualizam normalmente.
     */
    const phase2 =
      {};

    if (
      this._shouldRefreshStaticLayer(
        'conservationUnits',
        this.conservationUnits,
        forceStaticRefresh,
      )
    ) {
      phase2.conservationUnits = {
        label:
          'Unidades de Conservação',

        module:
          'conservation',

        affectedLayers: [
          'conservation-units',
        ],

        fn: async ({
          signal,
        } = {}) => {
          const raw =
            await loadConservationUnits({
              signal,

              /**
               * A tarefa só existe quando o cache está:
               * - ausente;
               * - vencido;
               * - ou foi forçada uma atualização.
               */
              forceRefresh:
                true,
            });

          const boundaryPoly =
            getBoundaryPolygon(
              this.cearaBoundary,
            );

          const filtered =
            boundaryPoly &&
            raw?.features?.length
              ? filterByBoundary(
                  raw,
                  boundaryPoly,
                )
              : raw;

          this.conservationUnits =
            filtered;

          /**
           * Atualiza a coleção derivada imediatamente.
           */
          this._rebuildSensitiveAreas();

          await this._reloadCacheRecord(
            'conservationUnits',
            db.stores.conservationUnits,
          );

          return filtered;
        },

        validate: (
          data,
        ) => {
          if (
            data?.type !==
              'FeatureCollection' ||
            !Array.isArray(
              data.features,
            )
          ) {
            return (
              'As Unidades de Conservação retornaram um GeoJSON inválido.'
            );
          }

          if (
            data.features.length ===
              0
          ) {
            return (
              'Nenhuma Unidade de Conservação do Ceará foi encontrada.'
            );
          }

          return true;
        },
      };
    }

    if (
      this.cearaBbox &&
      this._shouldRefreshStaticLayer(
        'indigenousLands',
        this.indigenousLands,
        forceStaticRefresh,
      )
    ) {
      phase2.indigenousLands = {
        label:
          'Terras Indígenas',

        module:
          'sipam',

        affectedLayers: [
          'indigenous-lands',
        ],

        allowEmpty:
          true,

        fn: async ({
          signal,
        } = {}) => {
          const raw =
            await loadIndigenousLands(
              this.cearaBbox,
              {
                signal,
              },
            );

          const boundaryPoly =
            getBoundaryPolygon(
              this.cearaBoundary,
            );

          const filtered =
            boundaryPoly &&
            raw?.features?.length
              ? filterByBoundary(
                  raw,
                  boundaryPoly,
                )
              : raw;

          this.indigenousLands =
            filtered;

          /**
           * Atualiza a coleção derivada imediatamente.
           */
          this._rebuildSensitiveAreas();

          await this._reloadCacheRecord(
            'indigenousLands',
            db.stores.indigenousLands,
          );

          return filtered;
        },

        validate: (
          data,
        ) => {
          if (
            data?.type !==
              'FeatureCollection' ||
            !Array.isArray(
              data.features,
            )
          ) {
            return (
              'As Terras Indígenas retornaram um GeoJSON inválido.'
            );
          }

          return true;
        },
      };
    }

    if (this.cearaBbox) {
      phase2.fireEvents = {
        label:
          'Eventos de fogo',

        module:
          'sipam',

        affectedLayers: [
          'fire-events',
          'fire-events-markers',
        ],

        /**
         * Zero eventos é um resultado possível e válido.
         */
        allowEmpty:
          true,

        fn: async ({
          signal,
        } = {}) => {
          const raw =
            await loadFireEvents(
              this.cearaBbox,
              {
                signal,
              },
            );

          const boundaryPoly =
            getBoundaryPolygon(
              this.cearaBoundary,
            );

          const filtered =
            boundaryPoly
              ? filterByBoundary(
                  raw,
                  boundaryPoly,
                )
              : raw;

          /**
           * Identifica espacialmente o município de
           * cada evento antes de recalcular:
           * - marcadores;
           * - estatísticas;
           * - alertas.
           */
          const enrichedWithMunicipality =
            enrichFireEventsWithMunicipalities(
              filtered,
              this.municipalities,
            );

          const enriched =
            enrichFireEventsAge(
              enrichedWithMunicipality,
            );

          const orderedEvents =
            sortFireEventsForRendering(
              enriched,
            );

          this.fireEvents =
            orderedEvents;

          return orderedEvents;
        },

        validate: (
          data,
        ) => {
          if (
            data?.type !==
              'FeatureCollection' ||
            !Array.isArray(
              data.features,
            )
          ) {
            return (
              'Os eventos de fogo retornaram um GeoJSON inválido.'
            );
          }

          return true;
        },
      };

      phase2.fireFronts = {
        label:
          'Frentes de fogo',

        module:
          'sipam',

        affectedLayers: [
          'fire-fronts',
        ],

        /**
         * Zero frentes é um resultado possível e válido.
         */
        allowEmpty:
          true,

        fn: async ({
          signal,
        } = {}) => {
          const raw =
            await loadFireFronts(
              this.cearaBbox,
              {
                signal,
              },
            );

          const boundaryPoly =
            getBoundaryPolygon(
              this.cearaBoundary,
            );

          const filtered =
            boundaryPoly &&
            raw?.features?.length
              ? filterByBoundary(
                  raw,
                  boundaryPoly,
                )
              : raw;

          const orderedFronts =
            sortFireFrontsForRendering(
              filtered,
            );

          this.fireFronts =
            orderedFronts;

          return orderedFronts;
        },

        validate: (
          data,
        ) => {
          if (
            data?.type !==
              'FeatureCollection' ||
            !Array.isArray(
              data.features,
            )
          ) {
            return (
              'As frentes de fogo retornaram um GeoJSON inválido.'
            );
          }

          return true;
        },
      };
    } else {
      console.warn(
        '[AppCore] Sem BBOX do Ceará — dados SIPAM não serão carregados.',
      );
    }

    let result =
      null;

    if (
      Object.keys(
        phase2,
      ).length > 0
    ) {
      result =
        await SyncEngine.sync(
          phase2,
        );
    }

    /**
     * Garante a reconstrução mesmo quando nenhuma camada
     * sensível precisou ser atualizada remotamente.
     */
    this._rebuildSensitiveAreas();

    /**
     * Nesta etapa, mantemos o AlertEngine usando UCs.
     *
     * A migração para todas as Áreas Sensíveis será feita
     * somente depois de validarmos esta coleção derivada.
     */
    if (
      this.fireEvents &&
      this.sensitiveAreas
    ) {
      this.alerts =
        await computeAlerts(
          this.fireEvents,
          this.sensitiveAreas,
          config.alertDistanceKm,
        );
    }

    this._updateStats();

    EventBus.emit(
      EVENTS.DATA_UPDATED,
      {
        source:
          'sync',
      },
    );

    return result;
  }

  /**
   * Reconstrói a coleção unificada de Áreas Sensíveis.
   *
   * Não realiza consultas e não modifica as coleções
   * originais.
   */
  _rebuildSensitiveAreas() {
    this.sensitiveAreas =
      buildSensitiveAreasCollection({
        conservationUnits:
          this.conservationUnits ||
          EMPTY_FEATURE_COLLECTION,

        indigenousLands:
          this.indigenousLands ||
          EMPTY_FEATURE_COLLECTION,
      });

    return this.sensitiveAreas;
  }

  /**
   * Decide se uma camada estática deve ser atualizada.
   */
  _shouldRefreshStaticLayer(
    policyKey,
    currentData,
    forceStaticRefresh,
  ) {
    if (
      forceStaticRefresh
    ) {
      return true;
    }

    if (
      !currentData ||
      !Array.isArray(
        currentData.features,
      ) ||
      currentData.features.length ===
        0
    ) {
      return true;
    }

    return shouldRefreshCache(
      this.cacheRecords[
        policyKey
      ],
      policyKey,
    );
  }

  /**
   * Recarrega o registro completo de uma store após
   * uma atualização concluída.
   */
  async _reloadCacheRecord(
    policyKey,
    storeName,
  ) {
    try {
      const record =
        await db.get(
          storeName,
          'latest',
        );

      this.cacheRecords[
        policyKey
      ] =
        record ||
        {
          id:
            'latest',

          data:
            this._getDataForPolicy(
              policyKey,
            ),

          updated_date:
            Date.now(),
        };
    } catch (error) {
      console.warn(
        `[AppCore] Não foi possível reler o cache de ${policyKey}:`,
        error,
      );

      this.cacheRecords[
        policyKey
      ] = {
        id:
          'latest',

        data:
          this._getDataForPolicy(
            policyKey,
          ),

        updated_date:
          Date.now(),
      };
    }
  }

  /**
   * Retorna os dados em memória associados a uma política.
   */
  _getDataForPolicy(
    policyKey,
  ) {
    switch (
      policyKey
    ) {
      case 'boundary':
        return this.cearaBoundary;

      case 'municipalities':
        return this.municipalities;

      case 'conservationUnits':
        return this.conservationUnits;

      case 'indigenousLands':
        return this.indigenousLands;

      default:
        return null;
    }
  }

  /**
   * Disponibiliza o estado dos caches estáticos para
   * o painel de diagnóstico.
   */
  getStaticCacheStatus() {
    return {
      boundary:
        getCacheStatus(
          this.cacheRecords
            .boundary,
          'boundary',
        ),

      municipalities:
        getCacheStatus(
          this.cacheRecords
            .municipalities,
          'municipalities',
        ),

      conservationUnits:
        getCacheStatus(
          this.cacheRecords
            .conservationUnits,
          'conservationUnits',
        ),

      indigenousLands:
        getCacheStatus(
          this.cacheRecords
            .indigenousLands,
          'indigenousLands',
        ),
    };
  }

  /**
   * Retorna a coleção unificada de Áreas Sensíveis.
   */
  getSensitiveAreas() {
    if (
      !isFeatureCollection(
        this.sensitiveAreas,
      )
    ) {
      return createEmptyFeatureCollection();
    }

    return this.sensitiveAreas;
  }

  /**
   * Retorna a quantidade total e por categoria.
   */
  getSensitiveAreaSummary() {
    return summarizeSensitiveAreas(
      this.getSensitiveAreas(),
    );
  }

  /**
   * Localiza a Área Sensível mais próxima.
   *
   * O resultado segue o formato retornado por findNearby:
   *
   * {
   *   feature,
   *   distance
   * }
   *
   * distance é retornada em metros.
   */
  findNearestSensitiveArea(
    eventFeature,
    maxDistanceKm =
      config.alertDistanceKm,
  ) {
    if (
      !eventFeature ||
      !this.sensitiveAreas
        ?.features
        ?.length
    ) {
      return null;
    }

    const numericDistance =
      Number(
        maxDistanceKm,
      );

    if (
      !Number.isFinite(
        numericDistance,
      ) ||
      numericDistance < 0
    ) {
      return null;
    }

    const nearby =
      findNearby(
        eventFeature,
        this.sensitiveAreas,
        numericDistance,
      );

    return (
      nearby[0] ||
      null
    );
  }

  _updateStats() {
    const events =
      this.fireEvents
        ?.features ||
      [];

    const conservationUnits =
      this.conservationUnits
        ?.features ||
      [];

    const indigenousLands =
      this.indigenousLands
        ?.features ||
      [];

    const alerts =
      this.alerts ||
      [];

    const sensitiveSummary =
      this.getSensitiveAreaSummary();

    const totalArea =
      events.reduce(
        (
          sum,
          feature,
        ) =>
          sum +
          computeArea(
            feature,
          ),
        0,
      );

    const municipalities =
      new Set();

    for (
      const feature
      of events
    ) {
      const municipality =
        feature.properties
          ?.municipio ||
        feature.properties
          ?.municipality;

      if (municipality) {
        municipalities.add(
          municipality,
        );
      }
    }

    const threatenedConservationUnits =
      new Set(
        alerts.map(
          (alert) =>
            alert.ucId,
        ),
      );

    const eventsInConservationUnits =
      alerts.filter(
        (alert) =>
          alert.intersects,
      ).length;

    const largestEvent =
      events.length
        ? events.reduce(
            (
              largest,
              feature,
            ) => {
              const area =
                computeArea(
                  feature,
                );

              return (
                area >
                (
                  largest?.area ||
                  0
                )
                  ? {
                      feature,
                      area,
                    }
                  : largest
              );
            },
            null,
          )
        : null;

    this.stats = {
      eventsCount:
        events.length,

      totalArea,

      municipiosCount:
        municipalities.size,

      municipiosAffected:
        Array.from(
          municipalities,
        ),

      ucsCount:
        conservationUnits.length,

      threatenedUCs:
        threatenedConservationUnits.size,

      eventsInUCs:
        eventsInConservationUnits,

      alertsCount:
        alerts.length,

      largestEvent,

      lastUpdated:
        Date.now(),

      fromCache:
        typeof navigator !==
          'undefined'
          ? !navigator.onLine
          : false,

      indigenousLandsCount:
        indigenousLands.length,

      /**
       * Novos campos genéricos.
       */
      sensitiveAreasCount:
        sensitiveSummary.total,

      sensitiveAreasByType:
        sensitiveSummary.byType,
    };

    return this.stats;
  }

  getStats() {
    return (
      this.stats ||
      this._updateStats()
    );
  }

  /**
   * Os marcadores são derivados exclusivamente dos
   * eventos já filtrados e preparados.
   */
  getFireEventMarkers() {
    if (
      !this.fireEvents
        ?.features
        ?.length
    ) {
      return createEmptyFeatureCollection();
    }

    const markers =
      this.fireEvents.features
        .map(
          (
            eventFeature,
          ) => {
            const point =
              representativePoint(
                eventFeature,
              );

            if (!point) {
              return null;
            }

            const eventId =
              eventFeature.id ??
              eventFeature
                .properties
                ?.id_evento ??
              eventFeature
                .properties
                ?.id ??
              null;

            return {
              ...point,

              id:
                eventId !==
                null
                  ? `marker-${eventId}`
                  : undefined,

              properties: {
                ...eventFeature
                  .properties,

                _originalId:
                  eventFeature.id ??
                  null,

                _eventId:
                  eventId,

                _sourceLayer:
                  'fire-events',

                _isEventMarker:
                  true,
              },
            };
          },
        )
        .filter(
          Boolean,
        );

    return {
      type:
        'FeatureCollection',

      features:
        markers,
    };
  }

  /**
   * Método legado mantido para compatibilidade.
   *
   * O popup e o AlertEngine ainda podem utilizá-lo
   * enquanto a migração para Áreas Sensíveis não for
   * concluída.
   */
  findNearestUC(
    eventFeature,
  ) {
    if (
      !this.conservationUnits
        ?.features
        ?.length
    ) {
      return null;
    }

    const nearby =
      findNearby(
        eventFeature,
        this.conservationUnits,
        config.alertDistanceKm,
      );

    return (
      nearby[0] ||
      null
    );
  }
}

export const AppCore =
  new AppCoreImpl();