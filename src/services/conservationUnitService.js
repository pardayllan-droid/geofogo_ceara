/**
 * Conservation Unit Service
 *
 * Carrega as Unidades de Conservação do Ceará.
 *
 * Estratégia:
 * 1. tenta arquivos GeoJSON locais;
 * 2. tenta fontes WFS públicas;
 * 3. utiliza cache válido como fallback;
 * 4. nunca considera coleção vazia como cache válido.
 */

import { db } from '../storage/indexedDb';
import { ErrorManager } from '../core/ErrorManager';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * Caminhos locais possíveis.
 *
 * O Vite disponibiliza arquivos da pasta public
 * diretamente a partir da raiz da aplicação.
 */
const LOCAL_UC_SOURCES = [
  '/data/conservation_units/conservation_units.geojson',
  '/data/conservation_units/unidades_conservacao.geojson',
  '/data/conservation_units/ucs_ceara.geojson',
  '/data/conservation_units/ucs.geojson',
  '/data/conservation-units.geojson',
  '/data/unidades_conservacao.geojson',
  '/data/ucs_ceara.geojson',
];

/**
 * Fontes públicas alternativas.
 *
 * Algumas fontes podem bloquear CORS ou ficar
 * temporariamente indisponíveis. Por isso nenhuma
 * delas é considerada única fonte obrigatória.
 */
const REMOTE_UC_SOURCES = [
  'https://geoserver.icmbio.gov.br/geoserver/uc/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=uc:uc&outputFormat=application/json&srsName=EPSG:4326&maxFeatures=10000',
];

function isFeatureCollection(data) {
  return (
    data?.type === 'FeatureCollection' &&
    Array.isArray(data.features)
  );
}

function hasFeatures(data) {
  return (
    isFeatureCollection(data) &&
    data.features.length > 0
  );
}

function normalizeFeatureCollection(data) {
  if (isFeatureCollection(data)) {
    return data;
  }

  if (data?.type === 'Feature') {
    return {
      type: 'FeatureCollection',
      features: [data],
    };
  }

  return EMPTY_FEATURE_COLLECTION;
}

/**
 * Detecta se uma feição pertence ao Ceará.
 *
 * O filtro é conservador: quando não existe informação
 * de UF, a feição não é descartada.
 */
function belongsToCeara(feature) {
  const properties = feature?.properties || {};

  const possibleValues = [
    properties.uf,
    properties.UF,
    properties.sigla_uf,
    properties.SIGLA_UF,
    properties.estado,
    properties.ESTADO,
    properties.cd_uf,
    properties.codigo_uf,
  ]
    .filter(
      (value) =>
        value !== null &&
        value !== undefined,
    )
    .map((value) =>
      String(value)
        .trim()
        .toUpperCase(),
    );

  if (possibleValues.length === 0) {
    return true;
  }

  return possibleValues.some(
    (value) =>
      value === 'CE' ||
      value === '23' ||
      value === 'CEARÁ' ||
      value === 'CEARA',
  );
}

function filterCearaFeatures(data) {
  const normalized =
    normalizeFeatureCollection(data);

  if (!hasFeatures(normalized)) {
    return EMPTY_FEATURE_COLLECTION;
  }

  const filtered =
    normalized.features.filter(
      belongsToCeara,
    );

  /*
   * Se nenhuma feição possuir campo de UF compatível,
   * preservamos o conjunto original. O filtro espacial
   * definitivo poderá ser realizado pelo AppCore.
   */
  if (filtered.length === 0) {
    return normalized;
  }

  return {
    ...normalized,
    features: filtered,
  };
}

async function readJsonSource(
  url,
  {
    signal,
    timeout = 30000,
  } = {},
) {
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
      timeout,
    );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ao carregar ${url}`,
    );
  }

  const contentType =
    response.headers
      .get('content-type')
      ?.toLowerCase() || '';

  /*
   * Alguns servidores GeoServer retornam XML de erro
   * mesmo com status HTTP 200.
   */
  if (
    contentType.includes('xml') ||
    contentType.includes('text/html')
  ) {
    const text = await response.text();

    throw new Error(
      `A fonte não retornou GeoJSON: ${text.slice(
        0,
        180,
      )}`,
    );
  }

  const data = await response.json();

  if (!isFeatureCollection(data)) {
    throw new Error(
      'A fonte não retornou uma FeatureCollection válida.',
    );
  }

  if (!data.features.length) {
    throw new Error(
      'A fonte retornou uma coleção vazia.',
    );
  }

  return data;
}

async function saveCache(
  data,
  source,
) {
  if (!hasFeatures(data)) {
    return false;
  }

  await db.put(
    db.stores.conservationUnits,
    {
      id: 'latest',
      data,
      updated_date: Date.now(),
      source,
    },
  );

  return true;
}

async function getValidCache() {
  const cached = await db.get(
    db.stores.conservationUnits,
    'latest',
  );

  if (hasFeatures(cached?.data)) {
    return cached.data;
  }

  return null;
}

async function trySources(
  sources,
  {
    signal,
    sourceType,
  },
) {
  const failures = [];

  for (const url of sources) {
    try {
      const raw = await readJsonSource(
        url,
        {
          signal,
          timeout:
            sourceType === 'local'
              ? 15000
              : 45000,
        },
      );

      const filtered =
        filterCearaFeatures(raw);

      if (!hasFeatures(filtered)) {
        throw new Error(
          'Nenhuma Unidade de Conservação válida foi encontrada.',
        );
      }

      await saveCache(filtered, url);

      console.info(
        '[conservationUnitService] UCs carregadas:',
        {
          source: url,
          sourceType,
          featureCount:
            filtered.features.length,
        },
      );

      return filtered;
    } catch (error) {
      failures.push({
        url,
        message: error.message,
      });

      /*
       * Arquivos locais inexistentes são esperados
       * durante a tentativa dos caminhos alternativos.
       */
      if (sourceType === 'remote') {
        console.warn(
          '[conservationUnitService] Fonte remota falhou:',
          url,
          error,
        );
      }
    }
  }

  return {
    data: null,
    failures,
  };
}

/**
 * Carrega UCs priorizando atualização online.
 *
 * O cache é fallback, não bloqueio para nova consulta.
 */
export async function loadConservationUnits(
  {
    signal,
    forceRefresh = false,
  } = {},
) {
  const cached =
    await getValidCache();

  /*
   * Primeiro tentamos arquivos locais.
   * Isso torna a PWA previsível e funciona offline
   * depois que o arquivo é incluído no build.
   */
  const localResult =
    await trySources(
      LOCAL_UC_SOURCES,
      {
        signal,
        sourceType: 'local',
      },
    );

  if (hasFeatures(localResult)) {
    return localResult;
  }

  /*
   * Quando estiver offline, utilizamos o cache válido.
   */
  if (
    typeof navigator !== 'undefined' &&
    navigator.onLine === false
  ) {
    return (
      cached ||
      EMPTY_FEATURE_COLLECTION
    );
  }

  /*
   * Em modo normal, tentamos atualizar pela fonte remota.
   */
  const remoteResult =
    await trySources(
      REMOTE_UC_SOURCES,
      {
        signal,
        sourceType: 'remote',
      },
    );

  if (hasFeatures(remoteResult)) {
    return remoteResult;
  }

  /*
   * Se a atualização falhar, preservamos o último
   * cache realmente válido.
   */
  if (cached) {
    console.warn(
      '[conservationUnitService] Usando cache válido de UCs.',
    );

    return cached;
  }

  const failures = [
    ...(localResult?.failures || []),
    ...(remoteResult?.failures || []),
  ];

  const error = new Error(
    'Nenhuma fonte válida de Unidades de Conservação foi encontrada.',
  );

  ErrorManager.report(
    'conservation',
    error,
    {
      operation:
        'loadConservationUnits',
      forceRefresh,
      attempts: failures,
    },
  );

  return EMPTY_FEATURE_COLLECTION;
}

export async function getCachedUCs() {
  return (
    (await getValidCache()) ||
    EMPTY_FEATURE_COLLECTION
  );
}