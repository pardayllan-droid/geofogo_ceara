/**
 * WebGeolocationProvider
 *
 * Implementação baseada na Geolocation API do navegador.
 *
 * É adequada para:
 * - navegador;
 * - PWA em primeiro plano;
 * - testes durante o desenvolvimento.
 *
 * Não garante rastreamento contínuo quando:
 * - a tela está apagada;
 * - o navegador está suspenso;
 * - a aplicação está em segundo plano.
 */

import {
  LocationProvider,
} from './LocationProvider';

const DEFAULT_OPTIONS = {
  enableHighAccuracy:
    true,

  maximumAge:
    5000,

  timeout:
    15000,
};

function normalizeGeolocationError(
  error,
) {
  if (!error) {
    return new Error(
      'Falha desconhecida ao obter a localização.',
    );
  }

  switch (
    error.code
  ) {
    case 1:
      return new Error(
        'Permissão de localização negada.',
      );

    case 2:
      return new Error(
        'A posição do dispositivo não está disponível.',
      );

    case 3:
      return new Error(
        'O tempo limite para obter a localização foi excedido.',
      );

    default:
      return new Error(
        error.message ||
        'Falha ao obter a localização.',
      );
  }
}

export class WebGeolocationProvider extends LocationProvider {
  constructor(
    options =
      {},
  ) {
    super();

    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    this.watchId =
      null;
  }

  getProviderName() {
    return 'web-geolocation';
  }

  supportsBackgroundTracking() {
    return false;
  }

  async getPermissionStatus() {
    if (
      typeof navigator ===
        'undefined' ||
      !navigator.geolocation
    ) {
      return 'unavailable';
    }

    if (
      !navigator.permissions
        ?.query
    ) {
      return 'prompt';
    }

    try {
      const permission =
        await navigator.permissions.query({
          name:
            'geolocation',
        });

      return (
        permission?.state ||
        'prompt'
      );
    } catch {
      return 'prompt';
    }
  }

  async getCurrentPosition() {
    if (
      typeof navigator ===
        'undefined' ||
      !navigator.geolocation
    ) {
      throw new Error(
        'Geolocalização indisponível neste dispositivo.',
      );
    }

    return new Promise(
      (
        resolve,
        reject,
      ) => {
        navigator.geolocation
          .getCurrentPosition(
            resolve,

            (error) => {
              reject(
                normalizeGeolocationError(
                  error,
                ),
              );
            },

            this.options,
          );
      },
    );
  }

  async start({
    onPosition,
    onError,
  }) {
    if (
      typeof navigator ===
        'undefined' ||
      !navigator.geolocation
    ) {
      throw new Error(
        'Geolocalização indisponível neste dispositivo.',
      );
    }

    if (this.running) {
      return;
    }

    const permissionStatus =
      await this.getPermissionStatus();

    if (
      permissionStatus ===
      'denied'
    ) {
      throw new Error(
        'Permissão de localização negada.',
      );
    }

    this.running =
      true;

    this.watchId =
      navigator.geolocation
        .watchPosition(
          (position) => {
            onPosition?.(
              position,
            );
          },

          (error) => {
            onError?.(
              normalizeGeolocationError(
                error,
              ),
            );
          },

          this.options,
        );
  }

  async stop() {
    if (
      this.watchId !==
        null &&
      typeof navigator !==
        'undefined' &&
      navigator.geolocation
    ) {
      navigator.geolocation
        .clearWatch(
          this.watchId,
        );
    }

    this.watchId =
      null;

    this.running =
      false;
  }
}