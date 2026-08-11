/**
 * Weather Service — previsão meteorológica via Open-Meteo.
 *
 * Estratégia:
 * - sem API key;
 * - cache por coordenada agrupada em grade ~0.1°;
 * - não consulta por evento individual;
 * - em offline, utiliza o último cache disponível;
 * - normaliza a resposta para o formato interno já usado
 *   pelo GeoFogo.
 */

import {
  config,
} from '../core/config';

import {
  db,
} from '../storage/indexedDb';

import {
  ErrorManager,
} from '../core/ErrorManager';

import {
  isStale,
} from '../utils/dates';

import {
  fetchWithTimeout,
} from '../utils/fetchWithTimeout';

/**
 * Mantém a estratégia atual de cache espacial.
 */
function gridKey(
  lat,
  lon,
) {
  const round =
    (value) =>
      Math.round(
        value * 10,
      ) / 10;

  return `${round(lat)},${round(lon)}`;
}

/**
 * Tradução simplificada dos códigos WMO utilizados pelo
 * Open-Meteo.
 *
 * Referência:
 * https://open-meteo.com/en/docs
 */
function describeWeatherCode(
  code,
) {
  const numericCode =
    Number(code);

  switch (numericCode) {
    case 0:
      return 'céu limpo';

    case 1:
      return 'predominantemente limpo';

    case 2:
      return 'parcialmente nublado';

    case 3:
      return 'nublado';

    case 45:
    case 48:
      return 'neblina';

    case 51:
    case 53:
    case 55:
      return 'garoa';

    case 56:
    case 57:
      return 'garoa congelante';

    case 61:
      return 'chuva fraca';

    case 63:
      return 'chuva moderada';

    case 65:
      return 'chuva forte';

    case 66:
    case 67:
      return 'chuva congelante';

    case 71:
    case 73:
    case 75:
      return 'neve';

    case 77:
      return 'grãos de neve';

    case 80:
      return 'pancadas de chuva fracas';

    case 81:
      return 'pancadas de chuva moderadas';

    case 82:
      return 'pancadas de chuva fortes';

    case 85:
    case 86:
      return 'pancadas de neve';

    case 95:
      return 'trovoadas';

    case 96:
    case 99:
      return 'trovoadas com granizo';

    default:
      return 'condição meteorológica';
  }
}

/**
 * Converte o código WMO em um identificador visual
 * compatível com a convenção que o GeoFogo já utilizava.
 *
 * O serviço não depende de imagens do OpenWeather.
 * O valor é mantido apenas para compatibilidade com
 * consumidores existentes.
 */
function weatherCodeToIcon(
  code,
  isDay = 1,
) {
  const suffix =
    Number(isDay) === 0
      ? 'n'
      : 'd';

  const numericCode =
    Number(code);

  if (numericCode === 0) {
    return `01${suffix}`;
  }

  if (numericCode === 1) {
    return `02${suffix}`;
  }

  if (numericCode === 2) {
    return `03${suffix}`;
  }

  if (numericCode === 3) {
    return `04${suffix}`;
  }

  if (
    numericCode === 45 ||
    numericCode === 48
  ) {
    return `50${suffix}`;
  }

  if (
    numericCode >= 51 &&
    numericCode <= 57
  ) {
    return `09${suffix}`;
  }

  if (
    numericCode >= 61 &&
    numericCode <= 67
  ) {
    return `10${suffix}`;
  }

  if (
    numericCode >= 71 &&
    numericCode <= 77
  ) {
    return `13${suffix}`;
  }

  if (
    numericCode >= 80 &&
    numericCode <= 86
  ) {
    return `09${suffix}`;
  }

  if (
    numericCode >= 95
  ) {
    return `11${suffix}`;
  }

  return `03${suffix}`;
}

/**
 * Converte a estrutura horária do Open-Meteo para a
 * estrutura interna historicamente consumida pelo
 * GeoFogo.
 *
 * Isso permite trocar o provedor sem exigir alterações
 * imediatas nos componentes da interface.
 */
function normalizeOpenMeteoResponse(
  data,
) {
  const hourly =
    data?.hourly;

  if (
    !hourly ||
    !Array.isArray(
      hourly.time,
    )
  ) {
    return {
      list: [],
      source:
        'open-meteo',
    };
  }

  const list =
    hourly.time.map(
      (
        time,
        index,
      ) => {
        const precipitation =
          Number(
            hourly.rain?.[
              index
            ],
          );

        const rainVolume =
          Number.isFinite(
            precipitation,
          )
            ? precipitation
            : null;

        const probability =
          Number(
            hourly
              .precipitation_probability
              ?.[index],
          );

        const weatherCode =
          hourly.weather_code?.[
            index
          ];

        const isDay =
          hourly.is_day?.[
            index
          ];

        return {
          main: {
            temp:
              hourly
                .temperature_2m
                ?.[index] ??
              null,

            feels_like:
              hourly
                .apparent_temperature
                ?.[index] ??
              null,

            humidity:
              hourly
                .relative_humidity_2m
                ?.[index] ??
              null,
          },

          wind: {
            speed:
              hourly
                .wind_speed_10m
                ?.[index] ??
              null,

            deg:
              hourly
                .wind_direction_10m
                ?.[index] ??
              null,

            gust:
              hourly
                .wind_gusts_10m
                ?.[index] ??
              null,
          },

          /*
           * OpenWeather usava 0–1.
           * Open-Meteo retorna 0–100.
           *
           * Mantemos o contrato antigo.
           */
          pop:
            Number.isFinite(
              probability,
            )
              ? probability /
                100
              : null,

          rain:
            rainVolume !==
            null
              ? {
                  /*
                   * O Open-Meteo retorna chuva horária.
                   * O nome "3h" é mantido apenas por
                   * compatibilidade interna.
                   */
                  '3h':
                    rainVolume,
                }
              : undefined,

          weather: [
            {
              description:
                describeWeatherCode(
                  weatherCode,
                ),

              icon:
                weatherCodeToIcon(
                  weatherCode,
                  isDay,
                ),
            },
          ],

          dt_txt:
            time,

          /*
           * Campos adicionais úteis para evolução futura.
           */
          _openMeteo: {
            weatherCode,
            isDay,
          },
        };
      },
    );

  return {
    list,

    source:
      'open-meteo',

    latitude:
      data.latitude,

    longitude:
      data.longitude,

    elevation:
      data.elevation,

    timezone:
      data.timezone,

    timezone_abbreviation:
      data.timezone_abbreviation,

    utc_offset_seconds:
      data.utc_offset_seconds,
  };
}

async function fetchForecast(
  lat,
  lon,
) {
  const params =
    new URLSearchParams({
      latitude:
        String(lat),

      longitude:
        String(lon),

      hourly: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'precipitation_probability',
        'rain',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'is_day',
      ].join(','),

      /*
       * OpenWeather fornecia vento em m/s.
       * Mantemos a mesma unidade para não alterar a UI.
       */
      wind_speed_unit:
        'ms',

      precipitation_unit:
        'mm',

      temperature_unit:
        'celsius',

      timezone:
        'auto',

      /*
       * O endpoint antigo do OpenWeather fornecia
       * aproximadamente cinco dias de previsão.
       */
      forecast_days:
        '5',
    });

  const url =
    `${config.weatherBaseUrl}?${params.toString()}`;

  try {
    const response =
      await fetchWithTimeout(
        url,
        {},
        15000,
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`,
      );
    }

    const rawData =
      await response.json();

    if (
      rawData?.error ===
      true
    ) {
      throw new Error(
        rawData.reason ||
          'Open-Meteo retornou erro na previsão.',
      );
    }

    const data =
      normalizeOpenMeteoResponse(
        rawData,
      );

    if (
      !data.list.length
    ) {
      throw new Error(
        'Open-Meteo retornou previsão sem dados horários.',
      );
    }

    const record = {
      id:
        gridKey(
          lat,
          lon,
        ),

      data,

      updated_date:
        Date.now(),
    };

    await db.put(
      db.stores.weather,
      record,
    );

    return data;
  } catch (error) {
    console.error(
      '[weatherService] fetchForecast falhou:',
      error,
    );

    ErrorManager.report(
      'weather',
      error,
      {
        lat,
        lon,
        provider:
          'open-meteo',
      },
    );

    return null;
  }
}

export async function loadWeatherForecast(
  lat,
  lon,
) {
  const key =
    gridKey(
      lat,
      lon,
    );

  const cached =
    await db.get(
      db.stores.weather,
      key,
    );

  const maxAge =
    config.weatherCacheMinutes *
    60 *
    1000;

  if (
    cached &&
    !isStale(
      cached.updated_date,
      maxAge,
    )
  ) {
    return {
      data:
        cached.data,

      fromCache:
        false,

      updated:
        cached.updated_date,
    };
  }

  const fresh =
    await fetchForecast(
      lat,
      lon,
    );

  if (fresh) {
    return {
      data:
        fresh,

      fromCache:
        false,

      updated:
        Date.now(),
    };
  }

  if (cached) {
    return {
      data:
        cached.data,

      fromCache:
        true,

      updated:
        cached.updated_date,
    };
  }

  return null;
}

/**
 * Mantém a API pública utilizada pelos componentes atuais.
 */
export function parseForecastEntry(
  entry,
) {
  if (!entry) {
    return null;
  }

  return {
    temp:
      entry.main?.temp,

    feelsLike:
      entry.main
        ?.feels_like,

    humidity:
      entry.main
        ?.humidity,

    windSpeed:
      entry.wind?.speed,

    windDir:
      entry.wind?.deg,

    windGust:
      entry.wind?.gust,

    rainProb:
      entry.pop != null
        ? entry.pop * 100
        : null,

    rainVolume:
      entry.rain?.['3h'] ??
      null,

    condition:
      entry.weather?.[0]
        ?.description,

    conditionIcon:
      entry.weather?.[0]
        ?.icon,

    time:
      entry.dt_txt,
  };
}

/**
 * Retorna a previsão horária mais próxima do horário atual.
 */
export function getCurrentEntry(
  forecastData,
) {
  if (
    !forecastData?.list
      ?.length
  ) {
    return null;
  }

  const now =
    Date.now();

  let closest =
    forecastData.list[0];

  let minDiff =
    Math.abs(
      new Date(
        closest.dt_txt,
      ).getTime() -
        now,
    );

  for (
    const entry
    of forecastData.list
  ) {
    const diff =
      Math.abs(
        new Date(
          entry.dt_txt,
        ).getTime() -
          now,
      );

    if (
      diff < minDiff
    ) {
      minDiff =
        diff;

      closest =
        entry;
    }
  }

  return closest;
}