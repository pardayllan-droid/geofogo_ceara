/**
 * Regras de criticidade dos alertas.
 *
 * Os valores ficam centralizados neste arquivo para evitar
 * limites fixos espalhados pelos componentes.
 */

export const CRITICALITY = {
  INFO:
    'Informativo',

  ATENCAO:
    'Atenção',

  ALTO:
    'Alto',

  CRITICO:
    'Crítico',
};

export const CRITICALITY_COLORS = {
  [CRITICALITY.INFO]:
    '#3b82f6',

  [CRITICALITY.ATENCAO]:
    '#f59e0b',

  [CRITICALITY.ALTO]:
    '#f97316',

  [CRITICALITY.CRITICO]:
    '#dc2626',
};

/**
 * Classificação usando o limite operacional padrão
 * de três quilômetros.
 */
export function classifyAlert(
  distanceMeters,
  intersectsSensitiveArea,
) {
  if (
    intersectsSensitiveArea
  ) {
    return CRITICALITY.CRITICO;
  }

  if (
    distanceMeters <= 500
  ) {
    return CRITICALITY.CRITICO;
  }

  if (
    distanceMeters <= 1000
  ) {
    return CRITICALITY.ALTO;
  }

  if (
    distanceMeters <= 3000
  ) {
    return CRITICALITY.ATENCAO;
  }

  return null;
}

/**
 * Classificação usando distância máxima configurável.
 */
export function classifyWithLimit(
  distanceMeters,
  intersectsSensitiveArea,
  limitKm,
) {
  if (
    intersectsSensitiveArea
  ) {
    return CRITICALITY.CRITICO;
  }

  if (
    distanceMeters <= 500
  ) {
    return CRITICALITY.CRITICO;
  }

  if (
    distanceMeters <= 1000
  ) {
    return CRITICALITY.ALTO;
  }

  const numericLimitKm =
    Number(
      limitKm,
    );

  if (
    Number.isFinite(
      numericLimitKm,
    ) &&
    numericLimitKm >= 0 &&
    distanceMeters <=
      numericLimitKm *
      1000
  ) {
    return CRITICALITY.ATENCAO;
  }

  return null;
}