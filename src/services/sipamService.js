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

import {
  SIPAM_LAYERS,
  getSipamLayerLabel,
} from './sipamLayers';

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

function sanitizeSipamUrl(
  url,
) {
  if (!url) {
    return null;
  }

  try {
    const parsed =
      new URL(url);

    parsed.searchParams.delete(
      'api_key',
    );

    return parsed.toString();
  } catch {
    return String(url)
      .replace(
        /([?&])api_key=[^&]*/gi,
        '$1api_key=[redacted]',
      );
  }
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
    url:
      sanitizeSipamUrl(
        url,
      ),
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
    const text =
      await response.text();

    const preview =
      text
        .replace(
          /\s+/g,
          ' ',
        )
        .trim()
        .slice(
          0,
          300,
        );

    console.warn(
      '[sipamService] Resposta inesperada do SIPAM:',
      {
        typeName,
        preview,
      },
    );

    throw new Error(
      `O SIPAM não retornou GeoJSON para ${typeName}.`,
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

    /*
    * A consulta online funcionou.
    * Remove eventual erro antigo desta camada SIPAM.
    */
    ErrorManager.clear(
      `sipam:${typeName}`,
    );

    console.info(
      '[sipamService] Consulta concluída:',
      {
        layer:
          getSipamLayerLabel(
            typeName,
          ),

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
      `[sipamService] ${getSipamLayerLabel(
        typeName,
      )} falhou:`,
      {
        typeName,
        error,
      },
    );

   /*
    * Quando existe cache válido, a indisponibilidade
    * temporária do SIPAM não deve gerar erro crítico
    * na interface.
    */
    if (cached) {
      /*
      * Existe cache válido e a aplicação consegue continuar.
      * Não mantém um erro crítico antigo no banner.
      */
      ErrorManager.clear(
        `sipam:${typeName}`,
      );

      console.warn(
        `[SIPAM] Não foi possível atualizar "${typeName}". ` +
          'Usando os últimos dados armazenados.',
        error,
      );

      EventBus.emit(
        EVENTS.SYNC_PROGRESS,
        {
          message:
            `Não foi possível atualizar ${typeName}. ` +
            'Usando os últimos dados armazenados.',
          typeName,
          source: 'cache',
          cached: true,
        },
      );

      return cached;
    }

    /*
    * Sem resposta remota e sem cache, agora existe
    * uma falha real que precisa aparecer na interface.
    */
    /*
    * Se existe cache válido, a falha temporária do SIPAM
    * não deve ser exibida como erro crítico.
    */
    if (cached) {
      console.warn(
        `[SIPAM] Falha ao atualizar "${typeName}". ` +
          'Usando dados armazenados.',
        error,
      );

      EventBus.emit(
        EVENTS.SYNC_PROGRESS,
        {
          message:
            `Usando dados armazenados de ${typeName}.`,
          typeName,
          source: 'cache',
          cached: true,
        },
      );

      return cached;
    }

    /*
    * Sem resposta do SIPAM e sem cache, existe uma falha real.
    */
    ErrorManager.report(
      'sipam',
      error,
      {
        operation: 'fetchWfs',
        typeName,
        bbox,
        url:
          sanitizeSipamUrl(
            url,
          ),
        cachedAvailable: false,
      },
    );

    throw error;
  }
}

export async function loadFireEvents(
  cearaBbox,
  {
    signal,
  } = {},
) {
  const data = await fetchWfs(
    SIPAM_LAYERS.FIRE_EVENTS,
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
    SIPAM_LAYERS.FIRE_DETECTIONS,
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