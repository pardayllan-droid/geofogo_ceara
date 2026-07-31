/**
 * fireEventAge
 *
 * Classifica eventos de fogo conforme o tempo transcorrido
 * desde a última detecção registrada em dt_maxima.
 */

export const FIRE_EVENT_AGE_CLASSES =
  Object.freeze({
    UP_TO_24_HOURS:
      'up-to-24h',

    FROM_24_TO_48_HOURS:
      '24-to-48h',

    FROM_48_TO_96_HOURS:
      '48-to-96h',

    OVER_96_HOURS:
      'over-96h',

    UNKNOWN:
      'unknown',
  });

export const FIRE_EVENT_AGE_COLORS =
  Object.freeze({
    'up-to-24h':
      '#ff2323',

    '24-to-48h':
      '#ff9e17',

    '48-to-96h':
      '#ffb1b0',

    'over-96h':
      '#c8c8c8',

    unknown:
      '#c8c8c8',
  });

const HOUR_IN_MILLISECONDS =
  60 * 60 * 1000;

/**
 * Converte uma data para timestamp.
 */
function parseDateTime(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const timestamp =
    new Date(value).getTime();

  return Number.isFinite(
    timestamp,
  )
    ? timestamp
    : null;
}

/**
 * Calcula quantas horas se passaram desde a data.
 */
export function getFireEventAgeHours(
  dateValue,
  referenceTime = Date.now(),
) {
  const timestamp =
    parseDateTime(
      dateValue,
    );

  const referenceTimestamp =
    Number(referenceTime);

  if (
    timestamp === null ||
    !Number.isFinite(
      referenceTimestamp,
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    (
      referenceTimestamp -
      timestamp
    ) /
      HOUR_IN_MILLISECONDS,
  );
}

/**
 * Classifica o evento conforme a idade de dt_maxima.
 */
export function classifyFireEventAge(
  dateValue,
  referenceTime = Date.now(),
) {
  const ageHours =
    getFireEventAgeHours(
      dateValue,
      referenceTime,
    );

  if (ageHours === null) {
    return {
      ageHours: null,

      ageClass:
        FIRE_EVENT_AGE_CLASSES
          .UNKNOWN,

      ageLabel:
        'Última detecção desconhecida',

      color:
        FIRE_EVENT_AGE_COLORS
          .unknown,
    };
  }

  if (ageHours <= 24) {
    return {
      ageHours,

      ageClass:
        FIRE_EVENT_AGE_CLASSES
          .UP_TO_24_HOURS,

      ageLabel:
        'Última detecção há até 24 horas',

      color:
        FIRE_EVENT_AGE_COLORS[
          FIRE_EVENT_AGE_CLASSES
            .UP_TO_24_HOURS
        ],
    };
  }

  if (ageHours <= 48) {
    return {
      ageHours,

      ageClass:
        FIRE_EVENT_AGE_CLASSES
          .FROM_24_TO_48_HOURS,

      ageLabel:
        'Última detecção entre 24 e 48 horas',

      color:
        FIRE_EVENT_AGE_COLORS[
          FIRE_EVENT_AGE_CLASSES
            .FROM_24_TO_48_HOURS
        ],
    };
  }

  if (ageHours <= 96) {
    return {
      ageHours,

      ageClass:
        FIRE_EVENT_AGE_CLASSES
          .FROM_48_TO_96_HOURS,

      ageLabel:
        'Última detecção entre 48 e 96 horas',

      color:
        FIRE_EVENT_AGE_COLORS[
          FIRE_EVENT_AGE_CLASSES
            .FROM_48_TO_96_HOURS
        ],
    };
  }

  return {
    ageHours,

    ageClass:
      FIRE_EVENT_AGE_CLASSES
        .OVER_96_HOURS,

    ageLabel:
      'Última detecção há mais de 96 horas',

    color:
      FIRE_EVENT_AGE_COLORS[
        FIRE_EVENT_AGE_CLASSES
          .OVER_96_HOURS
      ],
  };
}

/**
 * Acrescenta a classificação temporal a uma feição.
 */
export function enrichFireEventAge(
  feature,
  referenceTime = Date.now(),
) {
  if (!feature) {
    return feature;
  }

  const properties =
    feature.properties || {};

  const classification =
    classifyFireEventAge(
      properties.dt_maxima,
      referenceTime,
    );

  return {
    ...feature,

    properties: {
      ...properties,

      fire_age_hours:
        classification
          .ageHours,

      fire_age_class:
        classification
          .ageClass,

      fire_age_label:
        classification
          .ageLabel,

      fire_age_color:
        classification
          .color,
    },
  };
}

/**
 * Enriquece uma coleção inteira de eventos.
 *
 * Esta é a função importada pelo AppCore.
 */
export function enrichFireEventsAge(
  featureCollection,
  referenceTime = Date.now(),
) {
  if (
    featureCollection?.type !==
      'FeatureCollection' ||
    !Array.isArray(
      featureCollection.features,
    )
  ) {
    return {
      type:
        'FeatureCollection',

      features: [],
    };
  }

  return {
    ...featureCollection,

    features:
      featureCollection.features.map(
        (feature) =>
          enrichFireEventAge(
            feature,
            referenceTime,
          ),
      ),
  };
}