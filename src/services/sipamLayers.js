/**
 * Camadas publicadas pelo SIPAM utilizadas pelo GeoFogo Ceará.
 *
 * Quando o SIPAM alterar o nome de uma camada,
 * basta atualizar este arquivo.
 */

export const SIPAM_LAYERS =
  Object.freeze({
    /**
     * Polígonos dos eventos de fogo.
     */
    FIRE_EVENTS:
      'painel_do_fogo:mv_evento_filtro',

    /**
     * Detecções classificadas relacionadas aos eventos.
     */
    FIRE_DETECTIONS:
      'painel_do_fogo:mv_deteccoes_classificadas',

    /**
     * Terras Indígenas disponibilizadas pela FUNAI/SIPAM.
     */
    INDIGENOUS_LANDS:
      'painel_do_fogo:funai_terra_indigena',
  });

/**
 * Retorna uma descrição amigável para logs,
 * diagnóstico e mensagens da interface.
 */
export function getSipamLayerLabel(
  typeName,
) {
  switch (typeName) {
    case SIPAM_LAYERS.FIRE_EVENTS:
      return 'Eventos de fogo';

    case SIPAM_LAYERS.FIRE_DETECTIONS:
      return 'Detecções classificadas';

    case SIPAM_LAYERS.INDIGENOUS_LANDS:
      return 'Terras Indígenas';

    default:
      return (
        typeName ||
        'Camada SIPAM desconhecida'
      );
  }
}