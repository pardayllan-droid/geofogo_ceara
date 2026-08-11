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
/**
 * Classificação usando distância máxima configurável.
 *
 * O limite configurado é realmente a distância máxima
 * operacional para geração de alertas.
 *
 * Regras:
 * - interseção: Crítico;
 * - até 500 m: Crítico;
 * - acima de 500 m e até 1 km: Alto;
 * - acima de 1 km e até o limite configurado: Atenção;
 * - acima do limite configurado: sem alerta.
 */
export function classifyWithLimit(
  distanceMeters,
  intersectsSensitiveArea,
  limitKm,
) {
  const numericDistance =
    Number(
      distanceMeters,
    );

  const numericLimitKm =
    Number(
      limitKm,
    );

  if (
    !Number.isFinite(
      numericDistance,
    ) ||
    numericDistance < 0
  ) {
    return null;
  }

  /**
   * Caso o limite recebido seja inválido,
   * preserva o limite operacional padrão
   * de 3 km.
   */
  const maximumDistanceMeters =
    (
      Number.isFinite(
        numericLimitKm,
      ) &&
      numericLimitKm >= 0
    )
      ? numericLimitKm *
        1000
      : 3000;

  /**
   * Uma interseção representa distância zero
   * e é sempre crítica.
   */
  if (
    intersectsSensitiveArea
  ) {
    return CRITICALITY.CRITICO;
  }

  /**
   * Primeiro respeitamos o limite escolhido
   * pelo operador.
   *
   * Exemplo:
   * limite = 500 m
   * evento = 800 m
   *
   * Resultado: nenhum alerta.
   */
  if (
    numericDistance >
    maximumDistanceMeters
  ) {
    return null;
  }

  if (
    numericDistance <=
    500
  ) {
    return CRITICALITY.CRITICO;
  }

  if (
    numericDistance <=
    1000
  ) {
    return CRITICALITY.ALTO;
  }

  return CRITICALITY.ATENCAO;
}