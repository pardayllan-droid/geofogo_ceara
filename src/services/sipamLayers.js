/**
 * Camadas publicadas pelo SIPAM utilizadas pelo GeoFogo Ceará.
 *
 * Centralizar os nomes neste arquivo evita que identificadores
 * WFS fiquem espalhados pelos serviços da aplicação.
 *
 * Quando o SIPAM alterar o nome de uma camada, basta atualizar
 * este arquivo.
 */

export const SIPAM_LAYERS = Object.freeze({
  /**
   * Polígonos que representam eventos de fogo.
   */
  FIRE_EVENTS:
    'painel_do_fogo:mv_evento_filtro',

  /**
   * Detecções classificadas relacionadas aos eventos de fogo.
   *
   * Esta camada substituiu a antiga:
   * painel_do_fogo:mv_frente_deteccao
   */
  FIRE_DETECTIONS:
    'painel_do_fogo:mv_deteccoes_classificadas',
});

/**
 * Retorna uma descrição amigável para uma camada SIPAM.
 * Pode ser usada em logs, diagnóstico e mensagens da interface.
 */
export function getSipamLayerLabel(
  typeName,
) {
  switch (typeName) {
    case SIPAM_LAYERS.FIRE_EVENTS:
      return 'Eventos de fogo';

    case SIPAM_LAYERS.FIRE_DETECTIONS:
      return 'Detecções classificadas';

    default:
      return typeName || 'Camada SIPAM desconhecida';
  }
}