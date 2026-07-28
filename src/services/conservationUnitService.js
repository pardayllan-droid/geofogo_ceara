/**
 * Conservation Unit Service — carrega Unidades de Conservação.
 *
 * Tenta carregar de fontes públicas (ICMBio / MMA / INDE).
 * Se nenhuma fonte estiver disponível, a camada fica opcional e não impede o app.
 * Política: cache-first.
 */
import { db } from '../storage/indexedDb';
import { ErrorManager } from '../core/ErrorManager';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const UC_SOURCES = [
  'https://geoserver.icmbio.gov.br/geoserver/uc/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=uc:uc&outputFormat=application/json&maxFeatures=1000',
];

export async function loadConservationUnits() {
  const cached = await db.get(db.stores.conservationUnits, 'latest');
  if (cached?.data) {
    return cached.data;
  }

  for (const url of UC_SOURCES) {
    try {
      const res = await fetchWithTimeout(url, {}, 30000);
      if (!res.ok) continue;
      const geojson = await res.json();
      if (geojson.features?.length) {
        await db.put(db.stores.conservationUnits, {
          id: 'latest',
          data: geojson,
          updated_date: Date.now(),
          source: url,
        });
        return geojson;
      }
    } catch (err) {
      console.error('[conservationUnitService] fonte falhou:', url, err);
      ErrorManager.report('conservation', err, { url });
    }
  }

  console.error('[conservationUnitService] Nenhuma fonte de UC disponível');
  ErrorManager.report('conservation', new Error('Nenhuma fonte de UC disponível'));
  return { type: 'FeatureCollection', features: [] };
}

export async function getCachedUCs() {
  const rec = await db.get(db.stores.conservationUnits, 'latest');
  return rec?.data || { type: 'FeatureCollection', features: [] };
}