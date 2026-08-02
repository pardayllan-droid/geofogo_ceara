/**
 * AlertEngine
 *
 * Calcula alertas entre eventos de fogo e Áreas Sensíveis.
 *
 * Atualmente, Áreas Sensíveis podem incluir:
 * - Unidades de Conservação;
 * - Terras Indígenas;
 * - futuramente hospitais, escolas, áreas urbanizadas etc.
 *
 * Regras:
 * - distância configurável;
 * - usa distância real entre geometrias;
 * - interseção resulta em distância zero;
 * - evita duplicados por evento + Área Sensível;
 * - mantém campos legados ucId, ucName e ucCategory
 *   enquanto os componentes são migrados.
 */

import {
  config,
} from '../core/config';

import {
  db,
} from '../storage/indexedDb';

import {
  EventBus,
  EVENTS,
} from '../core/EventBus';

import * as turf from '@turf/turf';

import {
  distanceBetween,
  computeArea,
} from '../spatial/SpatialEngine';

import {
  classifyWithLimit,
  CRITICALITY,
} from './alertRules';

const DEFAULT_SENSITIVE_TYPE =
  'conservation-unit';

const DEFAULT_SENSITIVE_LABEL =
  'Área Sensível';

/**
 * Retorna o primeiro valor válido.
 */
function firstValue(
  ...values
) {
  for (
    const value
    of values
  ) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return value;
    }
  }

  return null;
}

/**
 * Identificador estável do evento.
 */
function getEventId(
  event,
  index,
) {
  return (
    firstValue(
      event?.id,
      event?.properties
        ?.id_evento,
      event?.properties
        ?.id,
      event?.properties
        ?.identificador,
      event?.properties
        ?.codigo_evento,
    ) ||
    `event-${index + 1}`
  );
}

/**
 * Identificador estável da Área Sensível.
 */
function getSensitiveAreaId(
  feature,
  index,
) {
  const properties =
    feature?.properties ||
    {};

  return (
    firstValue(
      properties.sensitive_id,
      feature?.id,
      properties.cd_cnuc,
      properties.codigo_cnuc,
      properties.uc_id,
      properties.terrai_cod,
      properties.gid,
      properties.id,
    ) ||
    `sensitive-area-${index + 1}`
  );
}

function getSensitiveAreaType(
  feature,
) {
  return (
    firstValue(
      feature?.properties
        ?.sensitive_type,
    ) ||
    DEFAULT_SENSITIVE_TYPE
  );
}

function getSensitiveAreaLabel(
  feature,
) {
  const type =
    getSensitiveAreaType(
      feature,
    );

  return (
    firstValue(
      feature?.properties
        ?.sensitive_label,
      type ===
        'indigenous-land'
        ? 'Terra Indígena'
        : null,
      type ===
        'conservation-unit'
        ? 'Unidade de Conservação'
        : null,
    ) ||
    DEFAULT_SENSITIVE_LABEL
  );
}

function getSensitiveAreaName(
  feature,
) {
  const properties =
    feature?.properties ||
    {};

  return (
    firstValue(
      properties.sensitive_name,
      properties.nome_uc,
      properties.nome_unidade_conservacao,
      properties.terrai_nom,
      properties.indigenous_land_name,
      properties.nome,
      properties.name,
    ) ||
    `${getSensitiveAreaLabel(
      feature,
    )} sem nome`
  );
}

function getSensitiveAreaCategory(
  feature,
) {
  const properties =
    feature?.properties ||
    {};

  return (
    firstValue(
      properties.sensitive_category,
      properties.categoria,
      properties.grupo,
      properties.fase_ti,
      properties.indigenous_legal_phase,
      properties.modalidade,
    ) ||
    '—'
  );
}

function getSensitiveAreaSource(
  feature,
) {
  return (
    firstValue(
      feature?.properties
        ?.sensitive_source,
      feature?.properties
        ?.fonte,
    ) ||
    '—'
  );
}

function getSensitiveAreaMunicipality(
  feature,
) {
  const properties =
    feature?.properties ||
    {};

  return (
    firstValue(
      properties.sensitive_municipality,
      properties.municipio,
      properties.municipios,
      properties.municipio_,
      properties.nome_municipio,
    ) ||
    '—'
  );
}

function createAlertId(
  eventId,
  sensitiveAreaId,
) {
  return (
    `${eventId || 'event'}` +
    '__' +
    `${sensitiveAreaId || 'sensitive-area'}`
  );
}

/**
 * Verifica se uma Área Sensível está habilitada
 * para geração de alertas.
 */
function isSensitiveAreaAlertEnabled(
  feature,
) {
  const properties =
    feature?.properties ||
    {};

  return (
    properties.sensitive_active !==
      false &&
    properties.sensitive_alert_enabled !==
      false
  );
}

/**
 * Interseção segura entre geometrias.
 */
function booleanIntersectsSafe(
  firstFeature,
  secondFeature,
) {
  try {
    return turf.booleanIntersects(
      firstFeature,
      secondFeature,
    );
  } catch (error) {
    console.error(
      '[AlertEngine] booleanIntersects falhou:',
      error,
    );

    return false;
  }
}

/**
 * Calcula alertas entre eventos e Áreas Sensíveis.
 */
export async function computeAlerts(
  fireEvents,
  sensitiveAreas,
  limitKm =
    config.alertDistanceKm,
) {
  const fireFeatures =
    Array.isArray(
      fireEvents?.features,
    )
      ? fireEvents.features
      : [];

  const sensitiveFeatures =
    Array.isArray(
      sensitiveAreas?.features,
    )
      ? sensitiveAreas.features
      : [];

  if (
    fireFeatures.length === 0 ||
    sensitiveFeatures.length === 0
  ) {
    await db.clear(
      db.stores.alerts,
    );

    EventBus.emit(
      EVENTS.ALERTS_UPDATED,
      [],
    );

    return [];
  }

  const alerts =
    [];

  const alertsById =
    new Map();

  for (
    let eventIndex = 0;
    eventIndex <
    fireFeatures.length;
    eventIndex += 1
  ) {
    const event =
      fireFeatures[eventIndex];

    const eventId =
      getEventId(
        event,
        eventIndex,
      );

    for (
      let sensitiveIndex = 0;
      sensitiveIndex <
      sensitiveFeatures.length;
      sensitiveIndex += 1
    ) {
      const sensitiveArea =
        sensitiveFeatures[
          sensitiveIndex
        ];

      if (
        !isSensitiveAreaAlertEnabled(
          sensitiveArea,
        )
      ) {
        continue;
      }

      const sensitiveAreaId =
        getSensitiveAreaId(
          sensitiveArea,
          sensitiveIndex,
        );

      const id =
        createAlertId(
          eventId,
          sensitiveAreaId,
        );

      let distance =
        Infinity;

      let intersects =
        false;

      try {
        intersects =
          booleanIntersectsSafe(
            event,
            sensitiveArea,
          );

        distance =
          intersects
            ? 0
            : distanceBetween(
                event,
                sensitiveArea,
              );
      } catch (error) {
        console.error(
          '[AlertEngine] Distância entre evento e Área Sensível falhou:',
          {
            error,
            eventId,
            sensitiveAreaId,
          },
        );

        distance =
          Infinity;
      }

      const criticality =
        classifyWithLimit(
          distance,
          intersects,
          limitKm,
        );

      if (!criticality) {
        continue;
      }

      const existing =
        alertsById.get(
          id,
        );

      if (existing) {
        existing.distance =
          distance;

        existing.intersects =
          intersects;

        existing.criticality =
          criticality;

        existing.updated_date =
          Date.now();

        continue;
      }

      const sensitiveAreaType =
        getSensitiveAreaType(
          sensitiveArea,
        );

      const sensitiveAreaLabel =
        getSensitiveAreaLabel(
          sensitiveArea,
        );

      const sensitiveAreaName =
        getSensitiveAreaName(
          sensitiveArea,
        );

      const sensitiveAreaCategory =
        getSensitiveAreaCategory(
          sensitiveArea,
        );

      const createdAt =
        Date.now();

      const alert = {
        id,

        eventId,

        /**
         * Campos genéricos de Área Sensível.
         */
        sensitiveAreaId,

        sensitiveAreaType,

        sensitiveAreaLabel,

        sensitiveAreaName,

        sensitiveAreaCategory,

        sensitiveAreaSource:
          getSensitiveAreaSource(
            sensitiveArea,
          ),

        sensitiveAreaMunicipality:
          getSensitiveAreaMunicipality(
            sensitiveArea,
          ),

        sensitiveAreaSourceLayer:
          sensitiveArea
            ?.properties
            ?.sensitive_source_layer ??
          null,

        sensitiveAreaOriginalId:
          sensitiveArea
            ?.properties
            ?.sensitive_original_id ??
          sensitiveArea?.id ??
          null,

        /**
         * Campos legados mantidos temporariamente.
         *
         * Isso impede que AlertPanel, estatísticas e
         * outros componentes atuais que usam ucId/ucName
         * deixem de funcionar.
         */
        ucId:
          sensitiveAreaId,

        ucName:
          sensitiveAreaName,

        ucCategory:
          sensitiveAreaCategory,

        ucGroup:
          sensitiveArea
            ?.properties
            ?.grupo ??
          sensitiveAreaLabel ??
          '—',

        eventName:
          firstValue(
            event?.properties
              ?.municipio,
            event?.properties
              ?.municipality,
            event?.properties
              ?.nome,
          ) ||
          'Evento sem município identificado',

        municipio:
          firstValue(
            event?.properties
              ?.municipio,
            event?.properties
              ?.municipality,
          ) ||
          '—',

        distance,

        intersects,

        criticality,

        eventArea:
          computeArea(
            event,
          ),

        eventStartDate:
          firstValue(
            event?.properties
              ?.dt_minima,
            event?.properties
              ?.data_inicio,
            event?.properties
              ?.data_ini,
            event?.properties
              ?.created_at,
          ),

        eventLastDetectionDate:
          firstValue(
            event?.properties
              ?.dt_maxima,
            event?.properties
              ?.data_fim,
            event?.properties
              ?.updated_at,
          ),

        weather:
          null,

        created_date:
          createdAt,

        updated_date:
          createdAt,
      };

      alertsById.set(
        id,
        alert,
      );

      alerts.push(
        alert,
      );
    }
  }

  alerts.sort(
    (
      firstAlert,
      secondAlert,
    ) => {
      const distanceDifference =
        firstAlert.distance -
        secondAlert.distance;

      if (
        distanceDifference !== 0
      ) {
        return distanceDifference;
      }

      return String(
        firstAlert
          .sensitiveAreaName,
      ).localeCompare(
        String(
          secondAlert
            .sensitiveAreaName,
        ),
        'pt-BR',
      );
    },
  );

  await db.clear(
    db.stores.alerts,
  );

  for (
    const alert
    of alerts
  ) {
    await db.put(
      db.stores.alerts,
      alert,
    );
  }

  EventBus.emit(
    EVENTS.ALERTS_UPDATED,
    alerts,
  );

  return alerts;
}

/**
 * Recupera os alertas armazenados.
 *
 * Alertas antigos permanecem compatíveis. Quando possível,
 * os campos genéricos são derivados dos campos uc*.
 */
export async function getCachedAlerts() {
  const all =
    await db.getAll(
      db.stores.alerts,
    );

  const normalized =
    all.map(
      (
        alert,
      ) => ({
        ...alert,

        sensitiveAreaId:
          alert.sensitiveAreaId ??
          alert.ucId ??
          null,

        sensitiveAreaType:
          alert.sensitiveAreaType ??
          DEFAULT_SENSITIVE_TYPE,

        sensitiveAreaLabel:
          alert.sensitiveAreaLabel ??
          (
            alert.sensitiveAreaType ===
              'indigenous-land'
              ? 'Terra Indígena'
              : 'Unidade de Conservação'
          ),

        sensitiveAreaName:
          alert.sensitiveAreaName ??
          alert.ucName ??
          'Área Sensível sem nome',

        sensitiveAreaCategory:
          alert.sensitiveAreaCategory ??
          alert.ucCategory ??
          '—',

        ucId:
          alert.ucId ??
          alert.sensitiveAreaId ??
          null,

        ucName:
          alert.ucName ??
          alert.sensitiveAreaName ??
          'Área Sensível sem nome',

        ucCategory:
          alert.ucCategory ??
          alert.sensitiveAreaCategory ??
          '—',
      }),
    );

  return normalized.sort(
    (
      firstAlert,
      secondAlert,
    ) =>
      (
        firstAlert.distance ||
        0
      ) -
      (
        secondAlert.distance ||
        0
      ),
  );
}

export function countByCriticality(
  alerts,
) {
  const counts = {
    [CRITICALITY.CRITICO]:
      0,

    [CRITICALITY.ALTO]:
      0,

    [CRITICALITY.ATENCAO]:
      0,

    [CRITICALITY.INFO]:
      0,
  };

  for (
    const alert
    of alerts || []
  ) {
    if (
      counts[
        alert.criticality
      ] !== undefined
    ) {
      counts[
        alert.criticality
      ] += 1;
    }
  }

  return counts;
}