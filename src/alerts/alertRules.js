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
  return classifyWithLimit(
    distanceMeters,
    intersectsSensitiveArea,
    3,
  );
}

/**
 * Classificação usando distância máxima configurável.
 *
 * Ordem obrigatória:
 *
 * 1. interseção real sempre é crítica;
 * 2. acima do limite configurado não gera alerta;
 * 3. até 500 m é crítico;
 * 4. acima de 500 m até 1 km é alto;
 * 5. acima de 1 km até o limite é atenção.
 *
 * O limite máximo sempre prevalece sobre as faixas
 * internas de criticidade.
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

  const numericDistanceMeters =
    Number(
      distanceMeters,
    );

  const numericLimitKm =
    Number(
      limitKm,
    );

  if (
    !Number.isFinite(
      numericDistanceMeters,
    ) ||
    numericDistanceMeters < 0 ||
    !Number.isFinite(
      numericLimitKm,
    ) ||
    numericLimitKm < 0
  ) {
    return null;
  }

  const limitMeters =
    numericLimitKm *
    1000;

  /*
   * A distância máxima configurada é uma barreira absoluta.
   *
   * Exemplo:
   * limite = 300 m
   * distância = 400 m
   *
   * Mesmo estando abaixo da faixa genérica de 500 m,
   * não deve existir alerta.
   */
  if (
    numericDistanceMeters >
    limitMeters
  ) {
    return null;
  }

  if (
    numericDistanceMeters <=
    500
  ) {
    return CRITICALITY.CRITICO;
  }

  if (
    numericDistanceMeters <=
    1000
  ) {
    return CRITICALITY.ALTO;
  }

  return CRITICALITY.ATENCAO;
}