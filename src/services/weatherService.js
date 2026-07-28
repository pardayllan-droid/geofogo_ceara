/**
 * Weather Service — previsão meteorológica via OpenWeatherMap /forecast.
 *
 * Estratégia:
 * - Cache de 30-60 min por coordenada agrupada (grade ~0.1°)
 * - Não consulta por evento individual; agrupa por proximidade
 * - Em offline, usa último cache e informa data
 */
import { config } from '../core/config';
import { db } from '../storage/indexedDb';
import { ErrorManager } from '../core/ErrorManager';
import { isStale } from '../utils/dates';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

function gridKey(lat, lon) {
  const r = (v) => Math.round(v * 10) / 10;
  return `${r(lat)},${r(lon)}`;
}

async function fetchForecast(lat, lon) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: config.openWeatherApiKey,
    units: 'metric',
    lang: 'pt_br',
  });
  const url = `${config.openWeatherBaseUrl}?${params.toString()}`;

  try {
    const res = await fetchWithTimeout(url, {}, 15000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const record = { id: gridKey(lat, lon), data, updated_date: Date.now() };
    await db.put(db.stores.weather, record);
    return data;
  } catch (err) {
    console.error('[weatherService] fetchForecast falhou:', err);
    ErrorManager.report('weather', err, { lat, lon });
    return null;
  }
}

export async function loadWeatherForecast(lat, lon) {
  const key = gridKey(lat, lon);
  const cached = await db.get(db.stores.weather, key);
  const maxAge = config.weatherCacheMinutes * 60 * 1000;

  if (cached && !isStale(cached.updated_date, maxAge)) {
    return { data: cached.data, fromCache: false, updated: cached.updated_date };
  }

  const fresh = await fetchForecast(lat, lon);
  if (fresh) {
    return { data: fresh, fromCache: false, updated: Date.now() };
  }

  if (cached) {
    return { data: cached.data, fromCache: true, updated: cached.updated_date };
  }

  return null;
}

export function parseForecastEntry(entry) {
  if (!entry) return null;
  return {
    temp: entry.main?.temp,
    feelsLike: entry.main?.feels_like,
    humidity: entry.main?.humidity,
    windSpeed: entry.wind?.speed,
    windDir: entry.wind?.deg,
    windGust: entry.wind?.gust,
    rainProb: entry.pop != null ? entry.pop * 100 : null,
    rainVolume: entry.rain?.['3h'] ?? null,
    condition: entry.weather?.[0]?.description,
    conditionIcon: entry.weather?.[0]?.icon,
    time: entry.dt_txt,
  };
}

export function getCurrentEntry(forecastData) {
  if (!forecastData?.list?.length) return null;
  const now = Date.now() / 1000;
  let closest = forecastData.list[0];
  let minDiff = Math.abs(new Date(closest.dt_txt).getTime() / 1000 - now);
  for (const entry of forecastData.list) {
    const diff = Math.abs(new Date(entry.dt_txt).getTime() / 1000 - now);
    if (diff < minDiff) {
      minDiff = diff;
      closest = entry;
    }
  }
  return closest;
}