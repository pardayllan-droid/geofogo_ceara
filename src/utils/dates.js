/**
 * Utilidades de data/hora.
 */
import moment from 'moment';

moment.locale('pt-br');

export function formatDate(date, fmt = 'DD/MM/YYYY HH:mm') {
  if (!date) return '—';
  return moment(date).format(fmt);
}

export function fromNow(date) {
  if (!date) return '—';
  return moment(date).fromNow();
}

export function isStale(timestamp, maxAgeMs) {
  if (!timestamp) return true;
  return Date.now() - timestamp > maxAgeMs;
}

export function timeAgoShort(date) {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}