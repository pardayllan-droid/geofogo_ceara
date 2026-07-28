/**
 * Regras de criticidade de alertas — valores centralizados.
 * Não espalhar valores fixos em componentes.
 */
export const CRITICALITY = {
  INFO: 'Informativo',
  ATENCAO: 'Atenção',
  ALTO: 'Alto',
  CRITICO: 'Crítico',
};

export const CRITICALITY_COLORS = {
  [CRITICALITY.INFO]: '#3b82f6',
  [CRITICALITY.ATENCAO]: '#f59e0b',
  [CRITICALITY.ALTO]: '#f97316',
  [CRITICALITY.CRITICO]: '#dc2626',
};

export function classifyAlert(distanceMeters, intersectsUC) {
  if (intersectsUC) return CRITICALITY.CRITICO;
  if (distanceMeters <= 500) return CRITICALITY.CRITICO;
  if (distanceMeters <= 1000) return CRITICALITY.ALTO;
  if (distanceMeters <= 3000) return CRITICALITY.ATENCAO;
  return null; // fora do limite → sem alerta
}

export function classifyWithLimit(distanceMeters, intersectsUC, limitKm) {
  if (intersectsUC) return CRITICALITY.CRITICO;
  if (distanceMeters <= 500) return CRITICALITY.CRITICO;
  if (distanceMeters <= 1000) return CRITICALITY.ALTO;
  if (distanceMeters <= limitKm * 1000) return CRITICALITY.ATENCAO;
  return null;
}