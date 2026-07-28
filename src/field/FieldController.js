/**
 * FieldController — Modo Campo com GPS.
 *
 * - Solicitar permissão de localização
 * - Mostrar posição atual
 * - Centralizar e acompanhar deslocamento
 * - Registrar trilha (iniciar/pausar/encerrar)
 * - Distância, duração, velocidade
 * - Adicionar pontos e observações
 * - Exportar GeoJSON e GPX
 *
 * Fora do Modo Campo: GPS desativado, sem rastreamento.
 */
import * as turf from '@turf/turf';
import { db } from '../storage/indexedDb';
import { EventBus, EVENTS } from '../core/EventBus';
import { ErrorManager } from '../core/ErrorManager';

class FieldControllerImpl {
  constructor() {
    this.active = false;
    this.recording = false;
    this.watchId = null;
    this.currentPosition = null;
    this.trail = [];
    this.startTime = null;
    this.totalDistance = 0;
    this.points = [];
    this._listeners = [];
  }

  async start() {
    if (this.active) return;
    this.active = true;
    this.trail = [];
    this.points = [];
    this.totalDistance = 0;
    this.startTime = Date.now();

    try {
      const perm = await navigator.permissions?.query({ name: 'geolocation' });
      if (perm && perm.state === 'denied') {
        throw new Error('Permissão de localização negada.');
      }
    } catch {
      /* permissions API pode não existir */
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPosition(pos),
      (err) => {
        ErrorManager.report('field', err, { op: 'geolocation' });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    EventBus.emit(EVENTS.FIELD_MODE_STARTED, {});
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.recording = false;

    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this._saveTrail();
    this.currentPosition = null;
    EventBus.emit(EVENTS.FIELD_MODE_STOPPED, {});
  }

  startRecording() {
    if (!this.active) return;
    this.recording = true;
  }

  pauseRecording() {
    this.recording = false;
  }

  stopRecording() {
    this.recording = false;
    this._saveTrail();
  }

  _onPosition(pos) {
    const { latitude, longitude, accuracy, speed } = pos.coords;
    const point = turf.point([longitude, latitude], {
      accuracy,
      speed: speed || 0,
      timestamp: pos.timestamp,
    });

    this.currentPosition = point;

    if (this.recording) {
      this.trail.push(point);

      if (this.trail.length >= 2) {
        const prev = this.trail[this.trail.length - 2];
        try {
          this.totalDistance += turf.distance(prev, point, { units: 'meters' });
        } catch {
          /* skip */
        }
      }
    }

    this._notify();
  }

  addPoint(label = '', observation = '') {
    if (!this.currentPosition) return null;
    const point = {
      id: `pt-${Date.now()}`,
      geometry: this.currentPosition.geometry,
      properties: {
        label,
        observation,
        timestamp: Date.now(),
      },
    };
    this.points.push(point);
    this._notify();
    return point;
  }

  getDuration() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  getSpeed() {
    return this.currentPosition?.properties?.speed || 0;
  }

  getTrailGeoJSON() {
    if (this.trail.length < 2) return { type: 'FeatureCollection', features: [] };
    const line = turf.lineString(this.trail.map((p) => p.geometry.coordinates));
    return { type: 'FeatureCollection', features: [line] };
  }

  getPointsGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: this.points.map((p) => ({ type: 'Feature', ...p })),
    };
  }

  getPositionGeoJSON() {
    if (!this.currentPosition) return { type: 'FeatureCollection', features: [] };
    return { type: 'FeatureCollection', features: [this.currentPosition] };
  }

  exportGeoJSON() {
    const data = {
      type: 'FeatureCollection',
      features: [
        ...this.getTrailGeoJSON().features,
        ...this.getPointsGeoJSON().features,
      ],
    };
    return JSON.stringify(data, null, 2);
  }

  exportGPX() {
    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gpx += '<gpx version="1.1" creator="GeoFogo Ceará" xmlns="http://www.topografix.com/GPX/1/1">\n';
    gpx += '<trk><name>Trilha GeoFogo</name><trkseg>\n';
    for (const p of this.trail) {
      const [lng, lat] = p.geometry.coordinates;
      gpx += `<trkpt lat="${lat}" lon="${lng}"><time>${new Date(p.properties.timestamp).toISOString()}</time></trkpt>\n`;
    }
    gpx += '</trkseg></trk>\n';
    for (const pt of this.points) {
      const [lng, lat] = pt.geometry.coordinates;
      gpx += `<wpt lat="${lat}" lon="${lng}"><name>${pt.properties.label || 'Ponto'}</name></wpt>\n`;
    }
    gpx += '</gpx>';
    return gpx;
  }

  async _saveTrail() {
    if (this.trail.length < 2 && this.points.length === 0) return;
    const record = {
      id: `trail-${Date.now()}`,
      trail: this.getTrailGeoJSON(),
      points: this.getPointsGeoJSON(),
      distance: this.totalDistance,
      duration: this.getDuration(),
      date: Date.now(),
    };
    try {
      await db.put(db.stores.fieldTrails, record);
    } catch (err) {
      ErrorManager.report('storage', err, { op: 'save-trail' });
    }
  }

  _notify() {
    this._listeners.forEach((fn) => {
      try { fn(this.getState()); } catch { /* skip */ }
    });
  }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((f) => f !== fn);
    };
  }

  getState() {
    return {
      active: this.active,
      recording: this.recording,
      currentPosition: this.currentPosition,
      trailLength: this.trail.length,
      pointsCount: this.points.length,
      distance: this.totalDistance,
      duration: this.getDuration(),
      speed: this.getSpeed(),
    };
  }
}

export const FieldController = new FieldControllerImpl();