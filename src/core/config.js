/**
 * ConfigManager — configurações centralizadas do GeoFogo Ceará.
 *
 * As configurações externas são fornecidas por variáveis de ambiente
 * durante o build do Vite.
 */

const DEFAULT_CONFIG = {
  alertDistanceKm: 3,
  fireRefreshMinutes: 15,
  weatherCacheMinutes: 45,
  sipamMaxFeatures: 500,
  defaultBaseMap: 'standard',
  units: 'metric',
};

const ENV = {
  openWeatherApiKey:
    import.meta.env.VITE_OPENWEATHER_API_KEY || '',

  openWeatherBaseUrl:
    import.meta.env.VITE_OPENWEATHER_BASE_URL ||
    'https://api.openweathermap.org/data/2.5/forecast',

  sipamWfsUrl:
    import.meta.env.VITE_SIPAM_WFS_URL ||
    'https://panorama.sipam.gov.br/geoserver/painel_do_fogo/ows',

  sipamApiKey:
    import.meta.env.VITE_SIPAM_API_KEY || '',
};

const CEARA_STATE_CODE = '23';

const ALERT_DISTANCES = [
  { value: 0.5, label: '500 m' },
  { value: 1, label: '1 km' },
  { value: 2, label: '2 km' },
  { value: 3, label: '3 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
];

export const config = {
  ...DEFAULT_CONFIG,
  ...ENV,
  cearaStateCode: CEARA_STATE_CODE,
  alertDistances: ALERT_DISTANCES,
};

export async function loadUserOverrides(db) {
  try {
    const stored = await db.get('settings', 'config');

    if (stored?.data) {
      Object.assign(config, stored.data);
    }
  } catch (err) {
    console.error(
      '[config] loadUserOverrides falhou:',
      err,
    );
  }
}

export async function saveUserOverrides(
  db,
  overrides,
) {
  const merged = {
    ...config,
    ...overrides,
  };

  Object.assign(config, overrides);

  await db.put(
    'settings',
    merged,
    'config',
  );

  return merged;
}