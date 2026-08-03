/**
 * LocationProvider
 *
 * Contrato comum para provedores de localização.
 *
 * Implementações previstas:
 * - WebGeolocationProvider;
 * - AndroidBackgroundLocationProvider.
 *
 * O FieldController não deve acessar diretamente:
 * - navigator.geolocation;
 * - plugins do Capacitor;
 * - APIs específicas do Android.
 */
export class LocationProvider {
  constructor() {
    this.running =
      false;
  }

  /**
   * Inicia o acompanhamento da localização.
   *
   * @param {Object} handlers
   * @param {(position: Object) => void} handlers.onPosition
   * @param {(error: Error) => void} handlers.onError
   */
  async start({
    onPosition,
    onError,
  }) {
    void onPosition;
    void onError;

    throw new Error(
      'LocationProvider.start() precisa ser implementado.',
    );
  }

  /**
   * Encerra o acompanhamento da localização.
   */
  async stop() {
    throw new Error(
      'LocationProvider.stop() precisa ser implementado.',
    );
  }

  /**
   * Retorna o estado atual de permissão.
   *
   * Valores possíveis:
   * - granted;
   * - prompt;
   * - denied;
   * - unavailable.
   */
  async getPermissionStatus() {
    return 'unavailable';
  }

  /**
   * Solicita a posição atual apenas uma vez.
   */
  async getCurrentPosition() {
    throw new Error(
      'LocationProvider.getCurrentPosition() precisa ser implementado.',
    );
  }

  isRunning() {
    return this.running;
  }

  /**
   * Identifica a implementação ativa.
   */
  getProviderName() {
    return 'unknown';
  }

  /**
   * Indica se a implementação oferece rastreamento
   * confiável em segundo plano.
   */
  supportsBackgroundTracking() {
    return false;
  }
}