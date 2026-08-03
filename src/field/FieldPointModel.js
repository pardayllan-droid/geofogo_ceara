/**
 * FieldPointModel
 *
 * Estrutura persistente de um ponto de campo.
 *
 * Um ponto pode:
 * - existir de forma independente;
 * - estar opcionalmente vinculado a um trilho;
 * - ter sido criado pela posição atual;
 * - ter sido criado por coordenada informada manualmente.
 */

export const FIELD_POINT_ORIGIN = {
  CURRENT_POSITION:
    'current-position',

  MANUAL_COORDINATE:
    'manual-coordinate',
};

export const FIELD_POINT_STATUS = {
  NEW:
    'new',

  IN_PROGRESS:
    'in-progress',

  VERIFIED:
    'verified',

  COMPLETED:
    'completed',
};

export const FIELD_POINT_CATEGORY = {
  ACTIVE_FIRE:
    'active-fire',

  VEHICLE:
    'vehicle',

  WATER_SOURCE:
    'water-source',

  BLOCKAGE:
    'blockage',

  RISK:
    'risk',

  SERVICE:
    'service',

  OBSERVATION:
    'observation',
};

function createId(
  prefix,
) {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return (
    `${prefix}-` +
    `${Date.now()}-` +
    `${Math.random()
      .toString(16)
      .slice(2)}`
  );
}

function normalizeCoordinate(
  value,
) {
  const numeric =
    Number(
      value,
    );

  return Number.isFinite(
    numeric,
  )
    ? numeric
    : null;
}

export function createFieldPoint({
  longitude,
  latitude,
  altitude =
    null,

  accuracy =
    null,

  altitudeAccuracy =
    null,

  heading =
    null,

  label =
    '',

  observation =
    '',

  category =
    FIELD_POINT_CATEGORY.OBSERVATION,

  status =
    FIELD_POINT_STATUS.NEW,

  origin =
    FIELD_POINT_ORIGIN.CURRENT_POSITION,

  originalCoordinateFormat =
    null,

  trailId =
    null,

  timestamp =
    Date.now(),
} = {}) {
  const normalizedLongitude =
    normalizeCoordinate(
      longitude,
    );

  const normalizedLatitude =
    normalizeCoordinate(
      latitude,
    );

  if (
    normalizedLongitude ===
      null ||
    normalizedLatitude ===
      null
  ) {
    throw new Error(
      'O ponto precisa possuir longitude e latitude válidas.',
    );
  }

  if (
    normalizedLongitude <
      -180 ||
    normalizedLongitude >
      180
  ) {
    throw new Error(
      'A longitude deve estar entre -180 e 180 graus.',
    );
  }

  if (
    normalizedLatitude <
      -90 ||
    normalizedLatitude >
      90
  ) {
    throw new Error(
      'A latitude deve estar entre -90 e 90 graus.',
    );
  }

  const createdAt =
    Number.isFinite(
      Number(
        timestamp,
      ),
    )
      ? Number(
          timestamp,
        )
      : Date.now();

  return {
    id:
      createId(
        'field-point',
      ),

    type:
      'Feature',

    geometry: {
      type:
        'Point',

      coordinates: [
        normalizedLongitude,
        normalizedLatitude,
      ],
    },

    properties: {
      label:
        String(
          label ||
          '',
        ).trim(),

      observation:
        String(
          observation ||
          '',
        ).trim(),

      category,

      status,

      origin,

      originalCoordinateFormat:
        originalCoordinateFormat ||
        null,

      trailId:
        trailId ||
        null,

      altitude:
        normalizeCoordinate(
          altitude,
        ),

      accuracy:
        normalizeCoordinate(
          accuracy,
        ),

      altitudeAccuracy:
        normalizeCoordinate(
          altitudeAccuracy,
        ),

      heading:
        normalizeCoordinate(
          heading,
        ),

      timestamp:
        createdAt,

      created_date:
        createdAt,

      updated_date:
        createdAt,
    },

    /**
     * Também mantemos trailId no nível principal para
     * facilitar futuras consultas no IndexedDB ou SQLite.
     */
    trailId:
      trailId ||
      null,

    created_date:
      createdAt,

    updated_date:
      createdAt,
  };
}

export function normalizeFieldPoint(
  point,
) {
  if (
    !point ||
    point.type !==
      'Feature' ||
    point.geometry?.type !==
      'Point'
  ) {
    return null;
  }

  const coordinates =
    point.geometry
      ?.coordinates;

  if (
    !Array.isArray(
      coordinates,
    ) ||
    coordinates.length <
      2
  ) {
    return null;
  }

  const longitude =
    normalizeCoordinate(
      coordinates[0],
    );

  const latitude =
    normalizeCoordinate(
      coordinates[1],
    );

  if (
    longitude ===
      null ||
    latitude ===
      null
  ) {
    return null;
  }

  const properties =
    point.properties ||
    {};

  const trailId =
    point.trailId ??
    properties.trailId ??
    null;

  return {
    ...point,

    id:
      point.id ||
      createId(
        'field-point',
      ),

    type:
      'Feature',

    geometry: {
      type:
        'Point',

      coordinates: [
        longitude,
        latitude,
      ],
    },

    trailId,

    properties: {
      ...properties,

      label:
        properties.label ||
        '',

      observation:
        properties.observation ||
        '',

      category:
        properties.category ||
        FIELD_POINT_CATEGORY.OBSERVATION,

      status:
        properties.status ||
        FIELD_POINT_STATUS.NEW,

      origin:
        properties.origin ||
        FIELD_POINT_ORIGIN.CURRENT_POSITION,

      trailId,

      timestamp:
        Number(
          properties.timestamp ||
          point.created_date ||
          Date.now(),
        ),
    },
  };
}