/**
 * SIPAM Service
 *
 * Consulta eventos e frentes de fogo por WFS.
 *
 * Regras:
 * - utiliza BBOX do Ceará;
 * - exige GeoJSON válido;
 * - coleção vazia é um resultado válido;
 * - respostas inválidas não sobrescrevem cache;
 * - em falha real, utiliza o último cache válido;
 * - aceita AbortSignal do SyncEngine.
 */

import { config } from '../core/config';
import { db } from '../storage/indexedDb';

import {
  EventBus,
  EVENTS,
} from '../core/EventBus';

import { ErrorManager } from '../core/ErrorManager';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

function isFeatureCollection(data) {
  return (
    data?.type === 'FeatureCollection' &&
    Array.isArray(data.features)
  );
}

function normalizeBbox(bbox) {
  if (Array.isArray(bbox)) {
    return bbox.join(',');
  }

  return String(bbox || '')
    .replace(/\s+/g, '');
}

function buildSipamUrl({
  typeName,
  bbox,
  maxFeatures =
    config.sipamMaxFeatures,
}) {
  const normalizedBbox =
    normalizeBbox(bbox);

  if (!normalizedBbox) {
    throw new Error(
      'BBOX do Ceará não foi informado.',
    );
  }

  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.0.0',
    request: 'GetFeature',
    typeName,
    outputFormat:
      'application/json',
    srsName: 'EPSG:4326',
    bbox: `${normalizedBbox},EPSG:4326`,
    maxFeatures: String(
      maxFeatures,
    ),
  });

  if (config.sipamApiKey) {
    params.set(
      'api_key',
      config.sipamApiKey,
    );
  }

  return `${config.sipamWfsUrl}?${params.toString()}`;
}

async function getValidCache(
  cacheStore,
) {
  const cached = await db.get(
    cacheStore,
    'latest',
  );

  if (
    isFeatureCollection(
      cached?.data,
    )
  ) {
    return cached.data;
  }

  return null;
}

async function saveCache(
  cacheStore,
  data,
  {
    typeName,
    url,
  },
) {
  if (!isFeatureCollection(data)) {
    return false;
  }

  await db.put(cacheStore, {
    id: 'latest',
    data,
    updated_date: Date.now(),
    source: 'sipam',
    typeName,
    url,
  });

  return true;
}

async function parseGeoJsonResponse(
  response,
  typeName,
) {
  const contentType =
    response.headers
      .get('content-type')
      ?.toLowerCase() || '';

  if (
    contentType.includes('xml') ||
    contentType.includes('html')
  ) {
    const text = await response.text();

    throw new Error(
      `O SIPAM não retornou GeoJSON para ${typeName}: ${text.slice(
        0,
        220,
      )}`,
    );
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error(
      `Resposta inválida do SIPAM para ${typeName}: ${error.message}`,
    );
  }

  if (!isFeatureCollection(data)) {
    const serviceMessage =
      data?.exceptions?.[0]?.text ||
      data?.message ||
      data?.error;

    throw new Error(
      serviceMessage ||
        `Resposta WFS inválida para ${typeName}.`,
    );
  }

  return data;
}

async function fetchWfs(
  typeName,
  bbox,
  cacheStore,
  {
    signal,
  } = {},
) {
  const url = buildSipamUrl({
    typeName,
    bbox,
  });

  const cached =
    await getValidCache(
      cacheStore,
    );

  try {
    const response =
      await fetchWithTimeout(
        url,
        {
          signal,
          headers: {
            Accept:
              'application/geo+json, application/json',
          },
        },
        45000,
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`.trim(),
      );
    }

    const geojson =
      await parseGeoJsonResponse(
        response,
        typeName,
      );

    /*
     * Coleção vazia também é armazenada, porque ela
     * representa corretamente a ausência de eventos.
     */
    await saveCache(
      cacheStore,
      geojson,
      {
        typeName,
        url,
      },
    );

    console.info(
      '[sipamService] Consulta concluída:',
      {
        typeName,
        featureCount:
          geojson.features.length,
      },
    );

    return geojson;
  } catch (error) {
    if (
      signal?.aborted ||
      error?.name === 'AbortError'
    ) {
      throw (
        signal?.reason ||
        error
      );
    }

    console.error(
      `[sipamService] ${typeName} falhou:`,
      error,
    );

    ErrorManager.report(
      'sipam',
      error,
      {
        operation: 'fetchWfs',
        typeName,
        bbox,
        url,
        cachedAvailable:
          Boolean(cached),
      },
    );

    if (cached) {
      EventBus.emit(
        EVENTS.SYNC_PROGRESS,
        {
          message:
            `Usando dados armazenados de ${typeName}.`,
        },
      );

      return cached;
    }

    return EMPTY_FEATURE_COLLECTION;
  }
}

export async function loadFireEvents(
  cearaBbox,
  {
    signal,
  } = {},
) {
  const data = await fetchWfs(
    'painel_do_fogo:mv_evento_filtro',
    cearaBbox,
    db.stores.fireEvents,
    {
      signal,
    },
  );

  EventBus.emit(
    EVENTS.FIRE_EVENTS_UPDATED,
    data,
  );

  return data;
}

export async function loadFireFronts(
  cearaBbox,
  {
    signal,
  } = {},
) {
  const data = await fetchWfs(
    'painel_do_fogo:mv_frente_deteccao',
    cearaBbox,
    db.stores.fireFronts,
    {
      signal,
    },
  );

  EventBus.emit(
    EVENTS.FIRE_FRONTS_UPDATED,
    data,
  );

  return data;
}

export async function getCachedFireEvents() {
  return (
    (await getValidCache(
      db.stores.fireEvents,
    )) ||
    EMPTY_FEATURE_COLLECTION
  );
}

export async function getCachedFireFronts() {
  return (
    (await getValidCache(
      db.stores.fireFronts,
    )) ||
    EMPTY_FEATURE_COLLECTION
  );
}