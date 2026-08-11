/**
 * indigenousLandService
 *
 * Consulta as Terras Indígenas da FUNAI publicadas
 * no serviço WFS do SIPAM.
 *
 * Estratégia:
 * - consulta pelo BBOX do Ceará;
 * - normaliza as propriedades;
 * - armazena a última coleção válida no IndexedDB;
 * - usa cache quando o serviço remoto falhar;
 * - respeita o AbortSignal do SyncEngine.
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
  fetchWithTimeout,
} from '../utils/fetchWithTimeout';

import {
  SIPAM_LAYERS,
} from './sipamLayers';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

const CACHE_ID = 'latest';

const REQUEST_TIMEOUT_MS = 45000;

function isFeatureCollection(
  data,
) {
  return (
    data?.type ===
      'FeatureCollection' &&
    Array.isArray(
      data.features,
    )
  );
}

function normalizeBbox(
  bbox,
) {
  if (Array.isArray(bbox)) {
    return bbox.join(',');
  }

  return String(bbox || '')
    .replace(/\s+/g, '');
}

function normalizeText(
  value,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text || null;
}

function normalizeNumber(
  value,
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

/**
 * Normaliza uma feição FUNAI como Área Sensível.
 */
function normalizeFeature(
  feature,
  index,
) {
  const properties =
    feature?.properties || {};

  const indigenousCode =
    normalizeText(
      properties.terrai_cod,
    );

  const name =
    normalizeText(
      properties.terrai_nom,
    ) ||
    'Terra Indígena sem nome';

  const people =
    normalizeText(
      properties.etnia_nome,
    );

  const municipalities =
    normalizeText(
      properties.municipio_,
    );

  const legalPhase =
    normalizeText(
      properties.fase_ti,
    );

  const modality =
    normalizeText(
      properties.modalidade,
    );

  const sourceId =
    feature?.id ||
    indigenousCode ||
    `indigenous-land-${index + 1}`;

  return {
    type: 'Feature',

    id: sourceId,

    geometry:
      feature?.geometry ||
      null,

    properties: {
      ...properties,

      /*
       * Campos próprios da Terra Indígena.
       */
      indigenous_land_id:
        indigenousCode,

      indigenous_land_name:
        name,

      indigenous_people:
        people,

      indigenous_municipalities:
        municipalities,

      indigenous_legal_phase:
        legalPhase,

      indigenous_modality:
        modality,

      indigenous_area_ha:
        normalizeNumber(
          properties.superficie,
        ),

      indigenous_updated_at:
        normalizeText(
          properties.data_atual,
        ),

      /*
       * Aliases amigáveis usados pelo popup.
       */
      nome:
        name,

      name,

      municipio:
        municipalities,

      uf:
        normalizeText(
          properties.uf_sigla,
        ) ||
        'CE',

      categoria:
        legalPhase,

      fonte:
        'FUNAI/SIPAM',

      /*
       * Contrato genérico de Área Sensível.
       */
      sensitive_id:
        String(sourceId),

      sensitive_type:
        'indigenous-land',

      sensitive_label:
        'Terra Indígena',

      sensitive_name:
        name,

      sensitive_category:
        legalPhase,

      sensitive_source:
        'FUNAI/SIPAM',
    },
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
    type:
      'FeatureCollection',

    metadata: {
      source:
        'FUNAI/SIPAM',

      typeName:
        SIPAM_LAYERS
          .INDIGENOUS_LANDS,

      updatedAt:
        Date.now(),
    },

    features,
  };
}

function buildUrl(
  bbox,
) {
  const normalizedBbox =
    normalizeBbox(bbox);

  if (!normalizedBbox) {
    throw new Error(
      'O BBOX do Ceará não foi informado para consultar as Terras Indígenas.',
    );
  }

  const params =
    new URLSearchParams({
      service:
        'WFS',

      version:
        '1.0.0',

      request:
        'GetFeature',

      typeName:
        SIPAM_LAYERS
          .INDIGENOUS_LANDS,

      outputFormat:
        'application/json',

      srsName:
        'EPSG:4326',

      bbox:
        `${normalizedBbox},EPSG:4326`,

      maxFeatures:
        String(
          config
            .sipamMaxFeatures ||
          500,
        ),
    });

  if (config.sipamApiKey) {
    params.set(
      'api_key',
      config.sipamApiKey,
    );
  }

  return (
    `${config.sipamWfsUrl}` +
    `?${params.toString()}`
  );
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

async function getCachedCollection() {
  try {
    const cached =
      await db.get(
        db.stores
          .indigenousLands,
        CACHE_ID,
      );

    if (
      isFeatureCollection(
        cached?.data,
      )
    ) {
      return cached.data;
    }
  } catch (error) {
    console.warn(
      '[indigenousLandService] Falha ao ler cache:',
      error,
    );
  }

  return null;
}

async function saveCache(
  data,
  url,
) {
  if (!isFeatureCollection(data)) {
    return false;
  }

  await db.put(
    db.stores
      .indigenousLands,
    {
      id:
        CACHE_ID,

      data,

      source:
        'funai-sipam',

      typeName:
        SIPAM_LAYERS
          .INDIGENOUS_LANDS,

      url:
        sanitizeSipamUrl(
          url,
        ),

      updated_date:
        Date.now(),
    },
  );

  return true;
}

async function parseResponse(
  response,
) {
  const contentType =
    response.headers
      .get('content-type')
      ?.toLowerCase() || '';

  if (
    contentType.includes(
      'xml',
    ) ||
    contentType.includes(
      'html',
    )
  ) {
    const text =
      await response.text();

    throw new Error(
      'O SIPAM não retornou GeoJSON para Terras Indígenas.',
    );
  }

  let data;

  try {
    data =
      await response.json();
  } catch (error) {
    throw new Error(
      `A resposta das Terras Indígenas não é um JSON válido: ${error.message}`,
    );
  }

  if (!isFeatureCollection(data)) {
    throw new Error(
      'A resposta das Terras Indígenas não é um FeatureCollection válido.',
    );
  }

  return data;
}

/**
 * Busca as Terras Indígenas pela rede.
 * Em falha, usa o último cache válido.
 */
export async function loadIndigenousLands(
  cearaBbox,
  {
    signal,
  } = {},
) {
  const url =
    buildUrl(
      cearaBbox,
    );

  const cached =
    await getCachedCollection();

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
        REQUEST_TIMEOUT_MS,
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`.trim(),
      );
    }

    const raw =
      await parseResponse(
        response,
      );

    const normalized =
      normalizeCollection(
        raw,
      );

    await saveCache(
      normalized,
      url,
    );

    ErrorManager.clear(
      `sipam:${SIPAM_LAYERS.INDIGENOUS_LANDS}`,
    );

    console.info(
      '[indigenousLandService] Consulta concluída:',
      {
        typeName:
          SIPAM_LAYERS
            .INDIGENOUS_LANDS,

        featureCount:
          normalized
            .features
            .length,
      },
    );

    return normalized;
  } catch (error) {
    if (
      signal?.aborted ||
      error?.name ===
        'AbortError'
    ) {
      throw (
        signal?.reason ||
        error
      );
    }

    if (cached) {
      console.warn(
        '[indigenousLandService] Falha na atualização. Usando cache:',
        error,
      );

      ErrorManager.clear(
        `sipam:${SIPAM_LAYERS.INDIGENOUS_LANDS}`,
      );

      return cached;
    }

    ErrorManager.report(
      'sipam',
      error,
      {
        operation:
          'loadIndigenousLands',

        typeName:
          SIPAM_LAYERS
            .INDIGENOUS_LANDS,

        bbox:
          cearaBbox,

        url:
          sanitizeSipamUrl(
            url,
          ),

        cachedAvailable:
          false,

        userMessage:
          'Não foi possível atualizar as Terras Indígenas.',
      },
    );

    throw error;
  }
}

/**
 * Retorna apenas o cache local.
 */
export async function getCachedIndigenousLands() {
  return (
    (await getCachedCollection()) ||
    EMPTY_FEATURE_COLLECTION
  );
}