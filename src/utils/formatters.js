/**
 * Utilidades de formatação para o GeoFogo Ceará.
 */

export function formatArea(km2) {
  if (km2 == null || isNaN(km2)) return '—';
  if (km2 < 1) return `${(km2 * 100).toFixed(1)} ha`;
  if (km2 < 100) return `${km2.toFixed(2)} km²`;
  return `${km2.toFixed(0)} km²`;
}

export function formatDistance(meters) {
  if (meters == null || isNaN(meters)) return '—';
  if (meters < 1) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatTemperature(c) {
  if (c == null || isNaN(c)) return '—';
  return `${Math.round(c)}°C`;
}

export function formatWindSpeed(ms) {
  if (ms == null || isNaN(ms)) return '—';
  return `${Math.round(ms * 3.6)} km/h`;
}

export function formatWindDirection(deg) {
  if (deg == null || isNaN(deg)) return '—';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function formatHumidity(pct) {
  if (pct == null || isNaN(pct)) return '—';
  return `${Math.round(pct)}%`;
}

export function formatCoords(lng, lat) {
  if (lng == null || lat == null) return '—';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function formatNumber(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('pt-BR');
}