/**
 * AlertEngine — calcula alertas entre eventos de fogo e Unidades de Conservação.
 *
 * Distância configurável (padrão 3 km).
 * Usa distância real entre geometrias, não entre centroides.
 * Interseção → distância = 0.
 * Evita duplicados: mesmo evento + mesma UC → atualiza alerta existente.
 */
import { config } from '../core/config';
import { db } from '../storage/indexedDb';
import { EventBus, EVENTS } from '../core/EventBus';
import * as turf from '@turf/turf';
import { distanceBetween, computeArea } from '../spatial/SpatialEngine';
import { classifyWithLimit, CRITICALITY } from './alertRules';

function alertId(eventId, ucId) {
  return `${eventId || 'evt'}__${ucId || 'uc'}`;
}

export async function computeAlerts(fireEvents, conservationUnits, limitKm = config.alertDistanceKm) {
  if (!fireEvents?.features?.length || !conservationUnits?.features?.length) {
    await db.clear(db.stores.alerts);
    EventBus.emit(EVENTS.ALERTS_UPDATED, []);
    return [];
  }

  const alerts = [];
  const seen = new Set();

  for (const event of fireEvents.features) {
    const eventId = event.id || event.properties?.id || event.properties?.identificador || `evt-${alerts.length}`;

    for (const uc of conservationUnits.features) {
      const ucId =
        uc.id ||
        uc.properties
          ?.sensitive_id ||
        uc.properties
          ?.cd_cnuc ||
        uc.properties
          ?.id ||
        uc.properties
          ?.nome_uc ||
        uc.properties
          ?.nome ||
        `uc-${alerts.length}`;
      const key = alertId(eventId, ucId);

      let distance;
      let intersects = false;
      try {
        intersects = booleanIntersectsSafe(event, uc);
        distance = intersects ? 0 : distanceBetween(event, uc);
      } catch (err) {
        console.error('[AlertEngine] distância entre evento/UC falhou:', err);
        distance = Infinity;
      }

      const criticality = classifyWithLimit(distance, intersects, limitKm);
      if (!criticality) continue;

      if (seen.has(key)) {
        const existing = alerts.find((a) => a.id === key);
        if (existing) {
          existing.distance = distance;
          existing.criticality = criticality;
          existing.updated_date = Date.now();
        }
        continue;
      }

      seen.add(key);

      const alert = {
        id: key,
        eventId,
        ucId,
        eventName: event.properties?.municipio || event.properties?.municipality || event.properties?.nome || 'Evento sem município identificado',
        ucName:
          uc.properties
            ?.sensitive_name ||
          uc.properties
            ?.nome_uc ||
          uc.properties
            ?.nome_unidade_conservacao ||
          uc.properties
            ?.nome ||
          uc.properties
            ?.name ||
          'Unidade de Conservação sem nome',
        ucCategory:
          uc.properties
            ?.sensitive_category ||
          uc.properties
            ?.categoria ||
          uc.properties
            ?.category ||
          '—',
        ucGroup: uc.properties?.grupo || '—',
        municipio: event.properties?.municipio || event.properties?.municipality || '—',
        distance,
        intersects,
        criticality,
        eventArea: computeArea(event),
        eventStartDate: event.properties?.data_inicio || event.properties?.data_ini || event.properties?.created_at || null,
        weather: null,
        created_date: Date.now(),
        updated_date: Date.now(),
      };

      alerts.push(alert);
    }
  }

  alerts.sort((a, b) => a.distance - b.distance);

  await db.clear(db.stores.alerts);
  for (const alert of alerts) {
    await db.put(db.stores.alerts, alert);
  }

  EventBus.emit(EVENTS.ALERTS_UPDATED, alerts);
  return alerts;
}

function booleanIntersectsSafe(a, b) {
  try {
    return turf.booleanIntersects(a, b);
  } catch (err) {
    console.error('[AlertEngine] booleanIntersects falhou:', err);
    return false;
  }
}

export async function getCachedAlerts() {
  const all = await db.getAll(db.stores.alerts);
  return all.sort((a, b) => (a.distance || 0) - (b.distance || 0));
}

export function countByCriticality(alerts) {
  const counts = {
    [CRITICALITY.CRITICO]: 0,
    [CRITICALITY.ALTO]: 0,
    [CRITICALITY.ATENCAO]: 0,
    [CRITICALITY.INFO]: 0,
  };
  for (const a of alerts) {
    if (counts[a.criticality] != null) counts[a.criticality]++;
  }
  return counts;
}