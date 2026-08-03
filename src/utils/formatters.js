/**
 * Utilidades de formatação para o GeoFogo Ceará.
 */

export function formatArea(km2) {
  const numeric =
    Number(km2);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  if (numeric < 1) {
    return `${(
      numeric * 100
    ).toFixed(1)} ha`;
  }

  if (numeric < 100) {
    return `${numeric.toFixed(
      2,
    )} km²`;
  }

  return `${numeric.toFixed(
    0,
  )} km²`;
}

/**
 * Formata uma área em hectares.
 *
 * O valor recebido deve estar em quilômetros quadrados,
 * que é a unidade retornada por computeArea().
 *
 * 1 km² = 100 hectares.
 */
export function formatAreaHectares(
  squareKilometers,
) {
  const numeric =
    Number(
      squareKilometers,
    );

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—';
  }

  const hectares =
    numeric * 100;

  return `${hectares.toLocaleString(
    'pt-BR',
    {
      minimumFractionDigits:
        hectares > 0 &&
        hectares < 1
          ? 2
          : 0,

      maximumFractionDigits:
        hectares < 10
          ? 2
          : 1,
    },
  )} ha`;
}

export function formatDistance(
  meters,
) {
  const numeric =
    Number(meters);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  if (numeric < 1) {
    return '0 m';
  }

  if (numeric < 1000) {
    return `${Math.round(
      numeric,
    )} m`;
  }

  return `${(
    numeric / 1000
  ).toFixed(2)} km`;
}

export function formatTemperature(
  celsius,
) {
  const numeric =
    Number(celsius);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return `${Math.round(
    numeric,
  )}°C`;
}

export function formatWindSpeed(
  metersPerSecond,
) {
  const numeric =
    Number(metersPerSecond);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return `${Math.round(
    numeric * 3.6,
  )} km/h`;
}

export function formatWindDirection(
  degrees,
) {
  const numeric =
    Number(degrees);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'L',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSO',
    'SO',
    'OSO',
    'O',
    'ONO',
    'NO',
    'NNO',
  ];

  const normalized =
    ((numeric % 360) + 360) %
    360;

  return directions[
    Math.round(
      normalized / 22.5,
    ) % 16
  ];
}

export function formatHumidity(
  percentage,
) {
  const numeric =
    Number(percentage);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return `${Math.round(
    numeric,
  )}%`;
}

export function formatCoords(
  longitude,
  latitude,
) {
  const lng =
    Number(longitude);

  const lat =
    Number(latitude);

  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat)
  ) {
    return '—';
  }

  return `${lat.toFixed(
    4,
  )}, ${lng.toFixed(4)}`;
}

export function formatNumber(
  number,
) {
  const numeric =
    Number(number);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return numeric.toLocaleString(
    'pt-BR',
  );
}