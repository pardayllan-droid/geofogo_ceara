/**
 * Conservation Unit Service
 *
 * Fonte principal:
 * Cadastro Nacional de Unidades de Conservação — CNUC/MMA.
 *
 * O arquivo é preparado pelo comando:
 *
 * npm run update:cnuc
 *
 * Estratégia:
 * 1. tenta carregar o GeoJSON CNUC incluído na PWA;
 * 2. valida e normaliza os dados;
 * 3. armazena no IndexedDB;
 * 4. usa cache válido quando o arquivo não estiver disponível.
 */

import { db } from '../storage/indexedDb';
import { ErrorManager } from '../core/ErrorManager';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

const CNUC_URL =
  '/data/cnuc/ucs-ceara.geojson';

const CACHE_ID =
  'latest';

function isFeatureCollection(data) {
  return (
    data?.type ===
      'FeatureCollection' &&
    Array.isArray(data.features)
  );
}

function hasFeatures(data) {
  return (
    isFeatureCollection(data) &&
    data.features.length > 0
  );
}

function normalizeFeature(
  feature,
  index,
) {
  const properties =
    feature?.properties || {};

  return {
    type: 'Feature',

    id:
      feature?.id ??
      properties.cd_cnuc ??
      properties.uc_id ??
      `cnuc-ce-${index + 1}`,

    properties: {
      ...properties,

      nome_uc:
        properties.nome_uc ??
        properties.nome ??
        'Unidade de Conservação',

      esfera:
        properties.esfera ??
        null,

      categoria:
        properties.categoria ??
        null,

      grupo:
        properties.grupo ??
        null,

      org_gestor:
        properties.org_gestor ??
        properties.orgao_gestor ??
        null,

      municipio:
        properties.municipio ??
        properties.municipios ??
        null,

      uf:
        properties.uf ??
        'CE',

      ha_total:
        properties.ha_total ??
        properties.area_ha ??
        null,

      cd_cnuc:
        properties.cd_cnuc ??
        properties.codigo_cnuc ??
        null,

      fonte:
        'CNUC/MMA',
    },

    geometry:
      feature?.geometry ??
      null,
  };
}

function normalizeCollection(
  data,
) {
  if (!isFeatureCollection(data)) {
    return EMPTY_FEATURE_COLLECTION;
  }

  const features =
    data.features
      .filter(
        (feature) =>
          feature?.geometry &&
          (
            feature.geometry.type ===
              'Polygon' ||
            feature.geometry.type ===
              'MultiPolygon'
          ),
      )
      .map(
        normalizeFeature,
      );

  return {
    type: 'FeatureCollection',

    metadata: {
      ...(data.metadata || {}),

      source:
        data.metadata?.source ??
        'Cadastro Nacional de Unidades de Conservação — CNUC/MMA',
    },

    features,
  };
}

async function getCacheRecord() {
  try {
    const cached =
      await db.get(
        db.stores.conservationUnits,
        CACHE_ID,
      );

    if (
      hasFeatures(
        cached?.data,
      )
    ) {
      return cached;
    }

    return null;
  } catch (error) {
    console.warn(
      '[conservationUnitService] Falha ao ler cache:',
      error,
    );

    return null;
  }
}

async function saveCache(
  data,
) {
  if (!hasFeatures(data)) {
    return false;
  }

  await db.put(
    db.stores.conservationUnits,
    {
      id: CACHE_ID,

      data,

      updated_date:
        Date.now(),

      source:
        'cnuc-mma',

      metadata:
        data.metadata || null,
    },
  );

  return true;
}

async function fetchCnucFile({
  signal,
} = {}) {
  const response =
    await fetchWithTimeout(
      CNUC_URL,
      {
        signal,

        cache:
          'no-cache',

        headers: {
          Accept:
            'application/geo+json, application/json',
        },
      },
      30000,
    );

  if (!response.ok) {
    throw new Error(
      `O arquivo CNUC retornou HTTP ${response.status}. Execute "npm run update:cnuc".`,
    );
  }

  const contentType =
    response.headers
      .get('content-type')
      ?.toLowerCase() || '';

  /*
   * Quando o arquivo não existe, alguns servidores de
   * SPA devolvem index.html com status 200.
   */
  if (
    contentType.includes(
      'text/html',
    )
  ) {
    throw new Error(
      'O servidor retornou HTML no lugar do GeoJSON do CNUC. Execute "npm run update:cnuc".',
    );
  }

  let raw;

  try {
    raw = await response.json();
  } catch (error) {
    throw new Error(
      `O arquivo CNUC não contém JSON válido: ${error.message}`,
    );
  }

  const normalized =
    normalizeCollection(raw);

  if (!hasFeatures(normalized)) {
    throw new Error(
      'O arquivo CNUC não contém polígonos de Unidades de Conservação do Ceará.',
    );
  }

  return normalized;
}

export async function loadConservationUnits({
  signal,
  forceRefresh = false,
} = {}) {
  const cached =
    await getCacheRecord();

  if (
    typeof navigator !==
      'undefined' &&
    navigator.onLine === false
  ) {
    return (
      cached?.data ||
      EMPTY_FEATURE_COLLECTION
    );
  }

  try {
    const data =
      await fetchCnucFile({
        signal,
      });

    await saveCache(data);

    console.info(
      '[conservationUnitService] UCs do CNUC carregadas:',
      {
        featureCount:
          data.features.length,

        source:
          data.metadata?.resource ??
          data.metadata?.source,
      },
    );

    return data;
  } catch (error) {
    console.error(
      '[conservationUnitService] Falha ao carregar CNUC:',
      error,
    );

    /*
     * Em caso de atualização malsucedida, preservamos
     * o último conjunto válido.
     */
    if (cached?.data) {
      console.warn(
        '[conservationUnitService] Utilizando cache anterior do CNUC.',
      );

      return cached.data;
    }

    ErrorManager.report(
      'conservation',
      error,
      {
        operation:
          'loadConservationUnits',

        source:
          CNUC_URL,

        forceRefresh,

        cachedAvailable:
          false,
      },
    );

    return EMPTY_FEATURE_COLLECTION;
  }
}

export async function getCachedUCs() {
  const cached =
    await getCacheRecord();

  return (
    cached?.data ||
    EMPTY_FEATURE_COLLECTION
  );
}