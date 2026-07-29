/**
 * EventBus — barramento de eventos para desacoplar módulos.
 * Evita dependências circulares entre Core, LayerManager, SyncEngine, AlertEngine, etc.
 */
class EventBusImpl {
  constructor() {
    this._listeners = new Map();
  }

  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const handlers = this._listeners.get(event);
    if (!handlers) return;
    for (const h of handlers) {
      try {
        h(payload);
      } catch (err) {
        console.error(`[EventBus] handler error for "${event}"`, err);
      }
    }
  }
}

export const EventBus = new EventBusImpl();

export const EVENTS = {
  APP_READY: 'APP_READY',
  MAP_READY: 'MAP_READY',
  MAP_FOCUS_FIRE_EVENT: 'MAP_FOCUS_FIRE_EVENT',
  CONNECTION_CHANGED: 'CONNECTION_CHANGED',
  SYNC_STARTED: 'SYNC_STARTED',
  SYNC_COMPLETED: 'SYNC_COMPLETED',
  SYNC_FAILED: 'SYNC_FAILED',
  SYNC_PROGRESS: 'SYNC_PROGRESS',
  LAYER_REGISTERED: 'LAYER_REGISTERED',
  LAYER_VISIBILITY_CHANGED: 'LAYER_VISIBILITY_CHANGED',
  LAYER_DATA_UPDATED: 'LAYER_DATA_UPDATED',
  FIRE_EVENTS_UPDATED: 'FIRE_EVENTS_UPDATED',
  FIRE_FRONTS_UPDATED: 'FIRE_FRONTS_UPDATED',
  ALERT_CREATED: 'ALERT_CREATED',
  ALERT_UPDATED: 'ALERT_UPDATED',
  ALERTS_UPDATED: 'ALERTS_UPDATED',
  FIELD_MODE_STARTED: 'FIELD_MODE_STARTED',
  FIELD_MODE_STOPPED: 'FIELD_MODE_STOPPED',
  ERROR: 'ERROR',
  CONFIG_CHANGED: 'CONFIG_CHANGED',
  DATA_UPDATED: 'DATA_UPDATED',
};