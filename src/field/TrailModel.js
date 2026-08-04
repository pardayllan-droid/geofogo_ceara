/**
 * TrailModel
 *
 * Estrutura persistente de um trilho do Modo Campo.
 */

import { DEFAULT_TRAIL_STYLE, normalizeTrailStyle } from './FieldStyles';

export const TRAIL_STATUS = {
  ACTIVE:
    'active',

  PAUSED:
    'paused',

  COMPLETED:
    'completed',

  INTERRUPTED:
    'interrupted',
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

export function createTrail({
  name =
    null,

  navigationTargetId =
    null,

  style =
    DEFAULT_TRAIL_STYLE,
} = {}) {
  const now =
    Date.now();

  const normalizedStyle =
    normalizeTrailStyle(
      style,
    );

  return {
    id:
      createId(
        'trail',
      ),

    name:
      name ||
      `Trilho ${new Date(
        now,
      ).toLocaleString(
        'pt-BR',
      )}`,

    status:
      TRAIL_STATUS.ACTIVE,

    navigationTargetId:
      navigationTargetId ||
      null,

    style:
      normalizedStyle,

    startedAt:
      now,

    endedAt:
      null,

    pausedAt:
      null,

    totalPausedMs:
      0,

    samples:
      [],

    distanceMeters:
      0,

    movingTimeMs:
      0,

    stoppedTimeMs:
      0,

    currentSpeedMps:
      0,

    averageSpeedMps:
      0,

    maximumSpeedMps:
      0,

    minimumAltitudeMeters:
      null,

    averageAltitudeMeters:
      null,

    maximumAltitudeMeters:
      null,

    averageAccuracyMeters:
      null,

    sampleCount:
      0,

    pointCount:
      0,

    created_date:
      now,

    updated_date:
      now,
  };
}

export function normalizeTrail(
  trail,
) {
  if (!trail) {
    return null;
  }

  return {
    ...createTrail({
      name:
        trail.name,

      navigationTargetId:
        trail.navigationTargetId,

      style:
        trail.style,
    }),

    ...trail,

    style:
      normalizeTrailStyle(
        trail.style,
      ),

    samples:
      Array.isArray(
        trail.samples,
      )
        ? trail.samples
        : [],
  };
}

export function isTrailOpen(
  trail,
) {
  return (
    trail?.status ===
      TRAIL_STATUS.ACTIVE ||
    trail?.status ===
      TRAIL_STATUS.PAUSED
  );
}

export function pauseTrail(
  trail,
) {
  if (
    !trail ||
    trail.status !==
      TRAIL_STATUS.ACTIVE
  ) {
    return trail;
  }

  const now =
    Date.now();

  return {
    ...trail,

    status:
      TRAIL_STATUS.PAUSED,

    pausedAt:
      now,

    updated_date:
      now,
  };
}

export function resumeTrail(
  trail,
) {
  if (
    !trail ||
    trail.status !==
      TRAIL_STATUS.PAUSED
  ) {
    return trail;
  }

  const now =
    Date.now();

  const additionalPausedMs =
    trail.pausedAt
      ? Math.max(
          0,
          now -
            trail.pausedAt,
        )
      : 0;

  return {
    ...trail,

    status:
      TRAIL_STATUS.ACTIVE,

    pausedAt:
      null,

    totalPausedMs:
      (
        trail.totalPausedMs ||
        0
      ) +
      additionalPausedMs,

    updated_date:
      now,
  };
}

export function completeTrail(
  trail,
) {
  if (!trail) {
    return trail;
  }

  const now =
    Date.now();

  let totalPausedMs =
    trail.totalPausedMs ||
    0;

  if (
    trail.status ===
      TRAIL_STATUS.PAUSED &&
    trail.pausedAt
  ) {
    totalPausedMs +=
      Math.max(
        0,
        now -
          trail.pausedAt,
      );
  }

  return {
    ...trail,

    status:
      TRAIL_STATUS.COMPLETED,

    endedAt:
      now,

    pausedAt:
      null,

    totalPausedMs,

    updated_date:
      now,
  };
}