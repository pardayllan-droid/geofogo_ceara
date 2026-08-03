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
 * - mantém campos legados ucId, ucName e ucCategory;
 * - usa pré-seleção espacial por bbox para evitar
 *   comparações geométricas desnecessárias.
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
 * Margem adicional usada apenas no fallback matemático
 * da expansão da bbox.
 *
 * O caminho principal utiliza turf.buffer().
 */
const BBOX_SAFETY_FACTOR =
  1.05;

function performanceNow() {
  if (
    typeof performance !==
      'undefined' &&
    typeof performance.now ===
      'function'
  ) {
    return performance.now();
  }

  return Date.now();
}

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
 * Calcula a bbox de uma feição sem interromper
 * o cálculo caso exista alguma geometria inválida.
 *
 * Retorno:
 * [minX, minY, maxX, maxY]
 */
function getFeatureBboxSafe(
  feature,
) {
  if (!feature?.geometry) {
    return null;
  }

  try {
    const bbox =
      turf.bbox(
        feature,
      );

    if (
      !Array.isArray(
        bbox,
      ) ||
      bbox.length !==
        4 ||
      bbox.some(
        (value) =>
          !Number.isFinite(
            Number(value),
          ),
      )
    ) {
      return null;
    }

    return bbox.map(
      Number,
    );
  } catch (error) {
    console.warn(
      '[AlertEngine] Não foi possível calcular bbox:',
      error,
    );

    return null;
  }
}

/**
 * Verifica se duas caixas geográficas se cruzam.
 *
 * Esta operação é muito mais barata que:
 * - booleanIntersects;
 * - distanceBetween.
 */
function bboxesIntersect(
  firstBbox,
  secondBbox,
) {
  if (
    !firstBbox ||
    !secondBbox
  ) {
    return true;
  }

  const [
    firstMinX,
    firstMinY,
    firstMaxX,
    firstMaxY,
  ] =
    firstBbox;

  const [
    secondMinX,
    secondMinY,
    secondMaxX,
    secondMaxY,
  ] =
    secondBbox;

  return !(
    firstMaxX <
      secondMinX ||
    firstMinX >
      secondMaxX ||
    firstMaxY <
      secondMinY ||
    firstMinY >
      secondMaxY
  );
}

/**
 * Expansão matemática de segurança.
 *
 * É utilizada somente se turf.buffer() não conseguir
 * produzir a região de pesquisa.
 */
function expandBboxFallback(
  bbox,
  limitKm,
) {
  if (!bbox) {
    return null;
  }

  const [
    minX,
    minY,
    maxX,
    maxY,
  ] =
    bbox;

  const numericLimitKm =
    Math.max(
      0,
      Number(limitKm) ||
        0,
    );

  if (
    numericLimitKm ===
    0
  ) {
    return bbox;
  }

  /**
   * Um grau de latitude possui aproximadamente
   * 110 km. Usamos o divisor menor para obter uma
   * expansão ligeiramente mais conservadora.
   */
  const latitudeDelta =
    (
      numericLimitKm /
      110
    ) *
    BBOX_SAFETY_FACTOR;

  /**
   * O comprimento de um grau de longitude varia
   * com a latitude.
   *
   * Usamos a latitude de maior módulo da bbox para
   * produzir uma expansão conservadora.
   */
  const maximumAbsoluteLatitude =
    Math.max(
      Math.abs(
        minY,
      ),
      Math.abs(
        maxY,
      ),
    );

  const latitudeRadians =
    maximumAbsoluteLatitude *
    (
      Math.PI /
      180
    );

  const kilometersPerLongitudeDegree =
    Math.max(
      1,
      111.32 *
        Math.cos(
          latitudeRadians,
        ),
    );

  const longitudeDelta =
    (
      numericLimitKm /
      kilometersPerLongitudeDegree
    ) *
    BBOX_SAFETY_FACTOR;

  return [
    minX -
      longitudeDelta,

    minY -
      latitudeDelta,

    maxX +
      longitudeDelta,

    maxY +
      latitudeDelta,
  ];
}

/**
 * Cria uma caixa de pesquisa ao redor da bbox do evento.
 *
 * A bbox do evento é transformada em polígono e ampliada
 * pela distância máxima do alerta.
 *
 * Isso é seguro porque a geometria do evento está contida
 * dentro de sua bbox. A área de pesquisa fica mais ampla,
 * nunca mais restrita que o evento real.
 */
function createEventSearchBbox(
  event,
  limitKm,
) {
  const eventBbox =
    getFeatureBboxSafe(
      event,
    );

  if (!eventBbox) {
    return null;
  }

  const numericLimitKm =
    Math.max(
      0,
      Number(limitKm) ||
        0,
    );

  if (
    numericLimitKm ===
    0
  ) {
    return eventBbox;
  }

  try {
    const bboxPolygon =
      turf.bboxPolygon(
        eventBbox,
      );

    const buffered =
      turf.buffer(
        bboxPolygon,
        numericLimitKm,
        {
          units:
            'kilometers',
        },
      );

    const bufferedBbox =
      getFeatureBboxSafe(
        buffered,
      );

    if (bufferedBbox) {
      return bufferedBbox;
    }
  } catch (error) {
    console.warn(
      '[AlertEngine] Buffer da bbox falhou; usando expansão matemática:',
      error,
    );
  }

  return expandBboxFallback(
    eventBbox,
    numericLimitKm,
  );
}

/**
 * Calcula a área do evento uma única vez.
 */
function computeEventAreaSafe(
  event,
) {
  try {
    const area =
      computeArea(
        event,
      );

    return Number.isFinite(
      Number(area),
    )
      ? Number(area)
      : 0;
  } catch (error) {
    console.warn(
      '[AlertEngine] Não foi possível calcular a área do evento:',
      error,
    );

    return 0;
  }
}

/**
 * Prepara o índice simples das Áreas Sensíveis.
 *
 * A bbox de cada área é calculada apenas uma vez por
 * execução do computeAlerts().
 */
function buildSensitiveAreaIndex(
  sensitiveFeatures,
) {
  return sensitiveFeatures
    .map(
      (
        feature,
        index,
      ) => ({
        feature,

        index,

        bbox:
          getFeatureBboxSafe(
            feature,
          ),

        enabled:
          isSensitiveAreaAlertEnabled(
            feature,
          ),
      }),
    )
    .filter(
      (entry) =>
        entry.enabled,
    );
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
  const calculationStartedAt =
    performanceNow();

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

  const numericLimitKm =
    Math.max(
      0,
      Number(limitKm) ||
        0,
    );

  const indexStartedAt =
    performanceNow();

  const sensitiveAreaIndex =
    buildSensitiveAreaIndex(
      sensitiveFeatures,
    );

  const indexElapsedMs =
    performanceNow() -
    indexStartedAt;

  const alerts =
    [];

  const alertsById =
    new Map();

  const batchTimestamp =
    Date.now();

  const possiblePairs =
    fireFeatures.length *
    sensitiveAreaIndex.length;

  let candidatePairs =
    0;

  let exactComparisons =
    0;

  let invalidBboxAreas =
    0;

  for (
    const entry
    of sensitiveAreaIndex
  ) {
    if (!entry.bbox) {
      invalidBboxAreas +=
        1;
    }
  }

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

    const eventArea =
      computeEventAreaSafe(
        event,
      );

    const searchBbox =
      createEventSearchBbox(
        event,
        numericLimitKm,
      );

    /**
     * Se uma bbox não puder ser calculada, a área permanece
     * candidata. Isso evita falsos negativos.
     */
    const candidates =
      searchBbox
        ? sensitiveAreaIndex.filter(
            (entry) =>
              !entry.bbox ||
              bboxesIntersect(
                searchBbox,
                entry.bbox,
              ),
          )
        : sensitiveAreaIndex;

    candidatePairs +=
      candidates.length;

    for (
      const entry
      of candidates
    ) {
      const sensitiveArea =
        entry.feature;

      const sensitiveIndex =
        entry.index;

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

      exactComparisons +=
        1;

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
          numericLimitKm,
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
          batchTimestamp;

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

        eventArea,

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
          batchTimestamp,

        updated_date:
          batchTimestamp,
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
        distanceDifference !==
        0
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

  const storageStartedAt =
    performanceNow();

  await db.clear(
    db.stores.alerts,
  );

  /**
   * Mantemos a gravação sequencial por compatibilidade
   * com o wrapper atual do IndexedDB.
   *
   * Como normalmente existem poucos alertas, esta etapa
   * não é o gargalo principal.
   */
  for (
    const alert
    of alerts
  ) {
    await db.put(
      db.stores.alerts,
      alert,
    );
  }

  const storageElapsedMs =
    performanceNow() -
    storageStartedAt;

  const calculationElapsedMs =
    performanceNow() -
    calculationStartedAt;

  const reductionPercent =
    possiblePairs >
      0
      ? (
          1 -
          exactComparisons /
            possiblePairs
        ) *
        100
      : 0;

  console.group(
    '[AlertEngine] Otimização espacial',
  );

  console.table([
    {
      Métrica:
        'Eventos',

      Valor:
        fireFeatures.length,
    },
    {
      Métrica:
        'Áreas Sensíveis habilitadas',

      Valor:
        sensitiveAreaIndex.length,
    },
    {
      Métrica:
        'Pares possíveis',

      Valor:
        possiblePairs,
    },
    {
      Métrica:
        'Candidatos após bbox',

      Valor:
        candidatePairs,
    },
    {
      Métrica:
        'Comparações geométricas exatas',

      Valor:
        exactComparisons,
    },
    {
      Métrica:
        'Comparações evitadas',

      Valor:
        Math.max(
          0,
          possiblePairs -
            exactComparisons,
        ),
    },
    {
      Métrica:
        'Redução das comparações',

      Valor:
        `${reductionPercent.toFixed(
          2,
        )}%`,
    },
    {
      Métrica:
        'Áreas sem bbox válida',

      Valor:
        invalidBboxAreas,
    },
    {
      Métrica:
        'Alertas gerados',

      Valor:
        alerts.length,
    },
    {
      Métrica:
        'Tempo do índice',

      Valor:
        `${indexElapsedMs.toFixed(
          2,
        )} ms`,
    },
    {
      Métrica:
        'Tempo de gravação',

      Valor:
        `${storageElapsedMs.toFixed(
          2,
        )} ms`,
    },
    {
      Métrica:
        'Tempo total',

      Valor:
        `${calculationElapsedMs.toFixed(
          2,
        )} ms`,
    },
  ]);

  console.groupEnd();

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