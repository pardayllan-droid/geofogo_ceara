/**
 * Municipality Service — carrega limite e municípios do Ceará via API do IBGE.
 *
 * Fonte: https://servicodados.ibge.gov.br/api/v2/malhas/23
 * - formato=application/vnd.geo+json → retorna GeoJSON (NÃO TopoJSON)
 * - resolucao=5 → retorna municípios; sem resolucao → apenas limite estadual
 *
 * Política: cache-first (dados mudam raramente).
 */
import { db } from '../storage/indexedDb';
import { ErrorManager } from '../core/ErrorManager';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import * as turf from '@turf/turf';

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v2/malhas/23';

export async function loadCearaBoundary() {
  const cached = await db.get(db.stores.boundary, 'latest');
  if (cached?.data) {
    return cached.data;
  }

  try {
    const res = await fetchWithTimeout(
      `${IBGE_BASE}?formato=application/vnd.geo+json`,
      {},
      20000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    if (!geojson?.features?.length) {
      throw new Error('IBGE retornou GeoJSON vazio');
    }

    await db.put(db.stores.boundary, {
      id: 'latest',
      data: geojson,
      updated_date: Date.now(),
      source: 'ibge',
    });
    return geojson;
  } catch (err) {
    console.error('[municipalityService] loadCearaBoundary falhou:', err);
    ErrorManager.report('layer', err, { layer: 'boundary' });
    if (cached?.data) return cached.data;
    return { type: 'FeatureCollection', features: [] };
  }
}

export async function loadMunicipalities() {
  const cached = await db.get(db.stores.municipalities, 'latest');
  if (cached?.data) {
    return cached.data;
  }

  try {
    const res = await fetchWithTimeout(
      `${IBGE_BASE}?resolucao=5&formato=application/vnd.geo+json`,
      {},
      30000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    if (!geojson?.features?.length) {
      throw new Error('IBGE retornou GeoJSON vazio (municípios)');
    }

    await db.put(db.stores.municipalities, {
      id: 'latest',
      data: geojson,
      updated_date: Date.now(),
      source: 'ibge',
    });
    return geojson;
  } catch (err) {
    console.error('[municipalityService] loadMunicipalities falhou:', err);
    ErrorManager.report('layer', err, { layer: 'municipalities' });
    if (cached?.data) return cached.data;
    return { type: 'FeatureCollection', features: [] };
  }
}

export function computeBbox(geojson) {
  const bbox = turf.bbox(geojson);
  return `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;
}

export function getBoundaryPolygon(boundaryFeatureCollection) {
  if (!boundaryFeatureCollection?.features?.length) return null;
  return boundaryFeatureCollection.features[0];
}