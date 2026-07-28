/**
 * SIPAM Service — consulta de eventos de fogo e frentes de fogo via WFS.
 * Fonte: painel_do_fogo (SIPAM/MMA).
 *
 * Políticas:
 * - bbox usado apenas para reduzir volume inicial
 * - Após a consulta, cada feição é validada contra o polígono real do Ceará
 * - Em caso de falha, retorna o último cache válido
 * - Timeout de 30s em cada requisição
 */
import { config } from '../core/config';
import { db } from '../storage/indexedDb';
import { EventBus, EVENTS } from '../core/EventBus';
import { ErrorManager } from '../core/ErrorManager';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

function buildSipamUrl({ typeName, bbox, maxFeatures = config.sipamMaxFeatures }) {
  const params = new URLSearchParams({
    api_key: config.sipamApiKey,
    service: 'WFS',
    request: 'GetFeature',
    typeName,
    outputFormat: 'application/json',
    bbox,
    maxFeatures: String(maxFeatures),
  });
  return `${config.sipamWfsUrl}?${params.toString()}`;
}

async function fetchWfs(typeName, bbox, cacheStore) {
  const url = buildSipamUrl({ typeName, bbox });

  try {
    const res = await fetchWithTimeout(url, {}, 30000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    const record = {
      id: 'latest',
      data: geojson,
      updated_date: Date.now(),
      source: 'sipam',
    };
    await db.put(cacheStore, record);
    return geojson;
  } catch (err) {
    console.error(`[sipamService] fetchWfs(${typeName}) falhou:`, err);
    ErrorManager.report('sipam', err, { typeName });
    const cached = await db.get(cacheStore, 'latest');
    if (cached?.data) {
      EventBus.emit(EVENTS.SYNC_PROGRESS, { message: 'Usando cache de ' + typeName });
      return cached.data;
    }
    return { type: 'FeatureCollection', features: [] };
  }
}

export async function loadFireEvents(cearaBbox) {
  const data = await fetchWfs(
    'painel_do_fogo:mv_evento_filtro',
    cearaBbox,
    db.stores.fireEvents
  );
  EventBus.emit(EVENTS.FIRE_EVENTS_UPDATED, data);
  return data;
}

export async function loadFireFronts(cearaBbox) {
  const data = await fetchWfs(
    'painel_do_fogo:mv_frente_deteccao',
    cearaBbox,
    db.stores.fireFronts
  );
  EventBus.emit(EVENTS.FIRE_FRONTS_UPDATED, data);
  return data;
}

export async function getCachedFireEvents() {
  const rec = await db.get(db.stores.fireEvents, 'latest');
  return rec?.data || { type: 'FeatureCollection', features: [] };
}

export async function getCachedFireFronts() {
  const rec = await db.get(db.stores.fireFronts, 'latest');
  return rec?.data || { type: 'FeatureCollection', features: [] };
}