/**
 * ConfigManager — configurações centralizadas do
 * GeoFogo Ceará.
 *
 * Configurações externas de build podem ser fornecidas
 * por variáveis de ambiente do Vite.
 *
 * IMPORTANTE:
 * valores VITE_* utilizados no frontend são públicos para
 * o cliente e nunca devem ser tratados como segredos.
 */

const DEFAULT_CONFIG = {
  alertDistanceKm:
    3,

  fireRefreshMinutes:
    60,

  weatherCacheMinutes:
    45,

  sipamMaxFeatures:
    500,

  defaultBaseMap:
    'standard',

  units:
    'metric',
};

const ENV = {
  /**
   * Open-Meteo Forecast API.
   *
   * Não exige API key no endpoint público utilizado pelo
   * GeoFogo.
   */
  weatherBaseUrl:
    import.meta.env
      .VITE_WEATHER_BASE_URL ||
    'https://api.open-meteo.com/v1/forecast',

  sipamWfsUrl:
    import.meta.env
      .VITE_SIPAM_WFS_URL ||
    'https://panorama.sipam.gov.br/geoserver/painel_do_fogo/ows',

  sipamApiKey:
    import.meta.env
      .VITE_SIPAM_API_KEY ||
    '',
};

const CEARA_STATE_CODE =
  '23';

const ALERT_DISTANCES = [
  {
    value: 0.5,
    label: '500 m',
  },
  {
    value: 1,
    label: '1 km',
  },
  {
    value: 2,
    label: '2 km',
  },
  {
    value: 3,
    label: '3 km',
  },
  {
    value: 5,
    label: '5 km',
  },
  {
    value: 10,
    label: '10 km',
  },
];

/**
 * Apenas estas propriedades são preferências persistíveis
 * do usuário.
 *
 * Endpoints, credenciais e parâmetros técnicos pertencem
 * ao build da aplicação.
 */
const USER_OVERRIDE_KEYS =
  new Set([
    'alertDistanceKm',
    'defaultBaseMap',
    'units',
  ]);

function sanitizeUserOverrides(
  values,
) {
  if (
    !values ||
    typeof values !==
      'object'
  ) {
    return {};
  }

  const sanitized =
    {};

  for (
    const key
    of USER_OVERRIDE_KEYS
  ) {
    if (
      Object.prototype
        .hasOwnProperty.call(
          values,
          key,
        )
    ) {
      sanitized[key] =
        values[key];
    }
  }

  return sanitized;
}

export const config = {
  ...DEFAULT_CONFIG,
  ...ENV,

  cearaStateCode:
    CEARA_STATE_CODE,

  alertDistances:
    ALERT_DISTANCES,
};

export async function loadUserOverrides(
  db,
) {
  try {
    const stored =
      await db.get(
        'settings',
        'config',
      );

    const overrides =
      sanitizeUserOverrides(
        stored?.data,
      );

    Object.assign(
      config,
      overrides,
    );

    /**
     * Saneia instalações anteriores.
     *
     * Uma configuração antiga pode conter:
     * - chave OpenWeather;
     * - URL OpenWeather;
     * - chave SIPAM;
     * - endpoints;
     * - parâmetros técnicos.
     *
     * A partir desta versão, somente preferências legítimas
     * do usuário permanecem no IndexedDB.
     */
    if (stored?.data) {
      await db.put(
        'settings',
        overrides,
        'config',
      );
    }
  } catch (error) {
    console.error(
      '[config] loadUserOverrides falhou:',
      error,
    );
  }
}

export async function saveUserOverrides(
  db,
  overrides,
) {
  const sanitizedOverrides =
    sanitizeUserOverrides(
      overrides,
    );

  Object.assign(
    config,
    sanitizedOverrides,
  );

  const persistentConfig =
    sanitizeUserOverrides(
      config,
    );

  await db.put(
    'settings',
    persistentConfig,
    'config',
  );

  return {
    ...config,
  };
}