/**
 * AppCore — núcleo central da aplicação.
 * Coordena: ConfigManager, IndexedDB, LayerManager, SyncEngine, AlertEngine, etc.
 *
 * O Core NÃO:
 * - Renderiza JSX
 * - Faz cálculos espaciais diretamente
 * - Adiciona camadas diretamente
 * - Executa consultas externas dentro de componentes
 */
import { config, loadUserOverrides } from './config';
import { EventBus, EVENTS } from './EventBus';
import { ErrorManager } from './ErrorManager';
import { initDB, db } from '../storage/indexedDb';
import { LayerRegistry } from '../layers/LayerRegistry';
import { LayerManager } from '../layers/LayerManager';
import { SyncEngine } from '../sync/SyncEngine';
import { loadCearaBoundary, loadMunicipalities, computeBbox, getBoundaryPolygon } from '../services/municipalityService';
import { loadConservationUnits } from '../services/conservationUnitService';
import { loadFireEvents, loadFireFronts, getCachedFireEvents, getCachedFireFronts } from '../services/sipamService';
import { computeAlerts, getCachedAlerts } from '../alerts/AlertEngine';
import { filterByBoundary, computeArea, representativePoint, findNearby } from '../spatial/SpatialEngine';

class AppCoreImpl {
  constructor() {
    this.initialized = false;
    this.cearaBoundary = null;
    this.cearaBbox = null;
    this.municipalities = null;
    this.conservationUnits = null;
    this.fireEvents = null;
    this.fireFronts = null;
    this.alerts = [];
    this.stats = null;
  }

  async initialize() {
    if (this.initialized) return;

    await initDB();
    await loadUserOverrides(db);
    LayerRegistry.initialize();
    LayerManager.registerAll(LayerRegistry.getDefinitions());

    // Listeners de conexão
    window.addEventListener('online', () => EventBus.emit(EVENTS.CONNECTION_CHANGED, { online: true }));
    window.addEventListener('offline', () => EventBus.emit(EVENTS.CONNECTION_CHANGED, { online: false }));

    this.initialized = true;
    EventBus.emit(EVENTS.APP_READY, {});
  }

  async loadCachedData() {
    const cachedBoundary = await db.get(db.stores.boundary, 'latest');
    if (cachedBoundary?.data) {
      this.cearaBoundary = cachedBoundary.data;
      this.cearaBbox = computeBbox(cachedBoundary.data);
    }

    const cachedMunis = await db.get(db.stores.municipalities, 'latest');
    if (cachedMunis?.data) {
      this.municipalities = cachedMunis.data;
    }

    const cachedUCs = await db.get(db.stores.conservationUnits, 'latest');
    if (cachedUCs?.data) {
      this.conservationUnits = cachedUCs.data;
    }

    this.fireEvents = await getCachedFireEvents();
    this.fireFronts = await getCachedFireFronts();
    this.alerts = await getCachedAlerts();

    this._updateStats();
    EventBus.emit(EVENTS.DATA_UPDATED, {});
  }

  async syncAll() {
    // Fase 1: carregar limite + municípios (pré-requisitos para eventos de fogo)
    const phase1 = {};

    if (!this.cearaBoundary?.features?.length) {
      phase1.boundary = {
      label: 'Limite do Ceará',
      module: 'layer',

      fn: async ({ signal } = {}) => {
        const boundary =
          await loadCearaBoundary({
            signal,
          });

        if (!boundary?.features?.length) {
          throw new Error(
            'O limite do Ceará não contém feições.',
          );
        }

        this.cearaBoundary = boundary;
        this.cearaBbox =
          computeBbox(boundary);

        return boundary;
      },
    };
    }

    if (!this.municipalities?.features?.length) {
      phase1.municipalities = {
      label: 'Municípios',
      module: 'layer',

      fn: async ({ signal } = {}) => {
        const municipalities =
          await loadMunicipalities({
            signal,
          });

        if (
          !municipalities?.features?.length
        ) {
          throw new Error(
            'A malha municipal não contém feições.',
          );
        }

        this.municipalities =
          municipalities;

        return municipalities;
      },
    };
    }

    if (Object.keys(phase1).length > 0) {
      await SyncEngine.sync(phase1);
    }

    // Fase 2: UCs + eventos de fogo + frentes (dependem do bbox da fase 1)
    const phase2 = {};

    phase2.conservationUnits = {
      label: 'Unidades de Conservação',
      module: 'conservation',
      fn: async () => {
        const ucs = await loadConservationUnits();
        this.conservationUnits = ucs;
        return ucs;
      },
    };

    if (this.cearaBbox) {
      phase2.fireEvents = {
        label: 'Eventos de fogo',
        module: 'sipam',
        fn: async () => {
          const raw = await loadFireEvents(this.cearaBbox);
          const boundaryPoly = getBoundaryPolygon(this.cearaBoundary);
          const filtered = boundaryPoly ? filterByBoundary(raw, boundaryPoly) : raw;
          this.fireEvents = filtered;
          return filtered;
        },
      };

      phase2.fireFronts = {
        label: 'Frentes de fogo',
        module: 'sipam',
        fn: async () => {
          const raw = await loadFireFronts(this.cearaBbox);
          const boundaryPoly = getBoundaryPolygon(this.cearaBoundary);
          const filtered = boundaryPoly ? filterByBoundary(raw, boundaryPoly) : raw;
          this.fireFronts = filtered;
          return filtered;
        },
      };
    } else {
      console.warn('[AppCore] Sem bbox do Ceará — eventos de fogo não serão carregados');
    }

    const result = await SyncEngine.sync(phase2);

    // Após sincronizar, recalcular alertas
    if (this.fireEvents && this.conservationUnits) {
      this.alerts = await computeAlerts(this.fireEvents, this.conservationUnits, config.alertDistanceKm);
    }

    this._updateStats();
    EventBus.emit(EVENTS.DATA_UPDATED, {});
    return result;
  }

  _updateStats() {
    const events = this.fireEvents?.features || [];
    const ucs = this.conservationUnits?.features || [];
    const alerts = this.alerts || [];

    const totalArea = events.reduce((sum, f) => sum + computeArea(f), 0);
    const municipios = new Set();
    for (const f of events) {
      const m = f.properties?.municipio || f.properties?.municipality;
      if (m) municipios.add(m);
    }

    const threatenedUCs = new Set(alerts.map((a) => a.ucId));
    const eventsInUCs = alerts.filter((a) => a.intersects).length;

    const largestEvent = events.length
      ? events.reduce((max, f) => {
          const area = computeArea(f);
          return area > (max?.area || 0) ? { feature: f, area } : max;
        }, null)
      : null;

    this.stats = {
      eventsCount: events.length,
      totalArea,
      municipiosCount: municipios.size,
      municipiosAffected: Array.from(municipios),
      ucsCount: ucs.length,
      threatenedUCs: threatenedUCs.size,
      eventsInUCs,
      alertsCount: alerts.length,
      largestEvent,
      lastUpdated: Date.now(),
      fromCache: !navigator.onLine,
    };

    return this.stats;
  }

  getStats() {
    return this.stats || this._updateStats();
  }

  getFireEventMarkers() {
    if (!this.fireEvents?.features?.length) return { type: 'FeatureCollection', features: [] };
    const markers = this.fireEvents.features.map((f) => {
      const pt = representativePoint(f);
      pt.properties = { ...f.properties, _originalId: f.id };
      return pt;
    });
    return { type: 'FeatureCollection', features: markers };
  }

  findNearestUC(eventFeature) {
    if (!this.conservationUnits?.features?.length) return null;
    const nearby = findNearby(eventFeature, this.conservationUnits, config.alertDistanceKm);
    return nearby[0] || null;
  }
}

export const AppCore = new AppCoreImpl();