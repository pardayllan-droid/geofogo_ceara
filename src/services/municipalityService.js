/**
 * municipalityService
 *
 * Carrega:
 * - limite territorial do Ceará;
 * - limites dos 184 municípios do Ceará.
 *
 * Fonte:
 * API de Malhas Territoriais do IBGE.
 *
 * Estratégia:
 * 1. tenta buscar dados atualizados na rede;
 * 2. valida a resposta;
 * 3. grava no IndexedDB;
 * 4. em caso de falha, utiliza cache válido;
 * 5. sem rede e sem cache válido, propaga o erro.
 *
 * Uma FeatureCollection vazia nunca é tratada como sucesso.
 */

import * as turf from '@turf/turf';

import {
  db,
} from '../storage/indexedDb';

import {
  ErrorManager,
} from '../core/ErrorManager';

import {
  enrichMunicipalityGeoJSON,
  loadCearaMunicipalityCatalog,
} from './municipalityCatalogService';

const IBGE_BASE =
  'https://servicodados.ibge.gov.br/api/v2/malhas/23';

const BOUNDARY_CACHE_KEY = 'latest';
const MUNICIPALITIES_CACHE_KEY = 'latest';

const BOUNDARY_TIMEOUT_MS = 30000;
const MUNICIPALITIES_TIMEOUT_MS = 60000;

/**
 * Cria uma FeatureCollection vazia.
 *
 * Usada apenas para utilitários internos. As funções de carregamento
 * não retornam coleção vazia como resultado bem-sucedido.
 */
function emptyFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: [],
  };
}

/**
 * Cria um erro compatível com navegadores diferentes.
 */
function createAbortError(message) {
  try {
    return new DOMException(message, 'AbortError');
  } catch {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
  }
}

/**
 * Combina um AbortSignal externo com timeout.
 */
async function fetchWithSignalAndTimeout(
  url,
  {
    signal: externalSignal,
    timeoutMs = 30000,
    headers = {},
  } = {},
) {
  const controller = new AbortController();

  const abortFromExternalSignal = () => {
    if (!controller.signal.aborted) {
      controller.abort(
        externalSignal?.reason ||
          createAbortError(
            'Requisição cancelada.',
          ),
      );
    }
  };

  if (externalSignal?.aborted) {
    abortFromExternalSignal();
  } else {
    externalSignal?.addEventListener(
      'abort',
      abortFromExternalSignal,
      { once: true },
    );
  }

  const timeoutId = window.setTimeout(() => {
    if (!controller.signal.aborted) {
      const timeoutError = new Error(
        `A API do IBGE não respondeu em ${Math.round(
          timeoutMs / 1000,
        )} segundos.`,
      );

      timeoutError.name = 'TimeoutError';

      controller.abort(timeoutError);
    }
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',

      headers: {
        Accept:
          'application/geo+json, application/json',
        ...headers,
      },

      cache: 'no-store',
      signal: controller.signal,
    });

    return response;
  } catch (error) {
    if (
      controller.signal.aborted &&
      controller.signal.reason
    ) {
      throw controller.signal.reason;
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);

    externalSignal?.removeEventListener(
      'abort',
      abortFromExternalSignal,
    );
  }
}

/**
 * Normaliza o resultado para FeatureCollection.
 */
function normalizeFeatureCollection(data) {
  if (!data || typeof data !== 'object') {
    throw new Error(
      'A resposta do IBGE não contém um objeto GeoJSON.',
    );
  }

  if (
    data.type === 'FeatureCollection' &&
    Array.isArray(data.features)
  ) {
    return data;
  }

  if (
    data.type === 'Feature' &&
    data.geometry
  ) {
    return {
      type: 'FeatureCollection',
      features: [data],
    };
  }

  throw new Error(
    `Formato GeoJSON inesperado: ${
      data.type || 'tipo ausente'
    }.`,
  );
}

/**
 * Verifica se uma geometria é utilizável.
 */
function isValidGeometry(geometry) {
  if (
    !geometry ||
    typeof geometry !== 'object'
  ) {
    return false;
  }

  const validTypes = new Set([
    'Polygon',
    'MultiPolygon',
  ]);

  if (!validTypes.has(geometry.type)) {
    return false;
  }

  return (
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length > 0
  );
}

/**
 * Valida e limpa uma FeatureCollection territorial.
 */
function validateTerritorialGeoJSON(
  data,
  {
    label,
    minimumFeatures = 1,
  },
) {
  const collection =
    normalizeFeatureCollection(data);

  const validFeatures =
    collection.features.filter(
      (feature) =>
        feature?.type === 'Feature' &&
        isValidGeometry(feature.geometry),
    );

  if (validFeatures.length < minimumFeatures) {
    throw new Error(
      `${label} retornou apenas ${validFeatures.length} feição(ões) territorial(is) válida(s).`,
    );
  }

  return {
    ...collection,
    features: validFeatures,
  };
}

/**
 * Lê um cache e retorna apenas dados válidos.
 */
async function readValidCache(
  store,
  key,
  validationOptions,
) {
  try {
    const cached = await db.get(store, key);

    if (!cached?.data) {
      return null;
    }

    const data = validateTerritorialGeoJSON(
      cached.data,
      validationOptions,
    );

    return {
      ...cached,
      data,
    };
  } catch (error) {
    console.warn(
      '[municipalityService] Cache ausente ou inválido:',
      error,
    );

    return null;
  }
}

/**
 * Grava dados no cache sem impedir a exibição caso a gravação falhe.
 */
async function writeCache(
  store,
  key,
  data,
  metadata = {},
) {
  try {
    await db.put(store, {
      id: key,
      data,
      source: 'ibge',
      fetchedAt: Date.now(),
      ...metadata,
    });

    return true;
  } catch (error) {
    console.warn(
      '[municipalityService] Não foi possível gravar o cache:',
      error,
    );

    ErrorManager.report(
      'storage',
      error,
      {
        operation:
          'municipalityService.writeCache',
        store,
        key,
      },
    );

    return false;
  }
}

/**
 * Lê JSON da resposta e produz mensagem compreensível quando
 * o servidor retorna HTML, texto ou outro formato.
 */
async function readJsonResponse(
  response,
  label,
) {
  const contentType =
    response.headers.get('content-type') ||
    '';

  if (!response.ok) {
    let detail = '';

    try {
      detail = await response
        .text()
        .then((text) =>
          text.slice(0, 300),
        );
    } catch {
      // O corpo da resposta pode estar indisponível.
    }

    throw new Error(
      `${label}: HTTP ${response.status} ${
        response.statusText || ''
      }${detail ? ` — ${detail}` : ''}`,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(
      `${label}: a resposta não pôde ser interpretada como JSON. Content-Type: ${
        contentType || 'não informado'
      }.`,
      {
        cause: error,
      },
    );
  }
}

/**
 * Monta a URL da API do IBGE.
 */
function createIbgeUrl({
  municipalities = false,
} = {}) {
  const url = new URL(IBGE_BASE);

  /*
   * O parâmetro formato determina o retorno em GeoJSON.
   */
  url.searchParams.set(
    'formato',
    'application/vnd.geo+json',
  );

  /*
   * Na API usada pelo projeto, resolucao=5 solicita as malhas
   * municipais da unidade federativa.
   */
  if (municipalities) {
    url.searchParams.set(
      'resolucao',
      '5',
    );
  }

  return url.toString();
}

/**
 * Busca e valida o limite estadual.
 */
async function fetchCearaBoundary(signal) {
  const url = createIbgeUrl({
    municipalities: false,
  });

  console.info(
    '[municipalityService] Buscando limite do Ceará no IBGE.',
  );

  const response =
    await fetchWithSignalAndTimeout(url, {
      signal,
      timeoutMs: BOUNDARY_TIMEOUT_MS,
    });

  const rawData = await readJsonResponse(
    response,
    'Falha ao carregar o limite do Ceará',
  );

  return validateTerritorialGeoJSON(
    rawData,
    {
      label: 'Limite do Ceará',
      minimumFeatures: 1,
    },
  );
}

/**
 * Busca, valida e enriquece os limites municipais.
 */
async function fetchMunicipalities(
  signal,
) {
  const url =
    createIbgeUrl({
      municipalities: true,
    });

  console.info(
    '[municipalityService] Buscando malha dos municípios do Ceará no IBGE.',
  );

  const response =
    await fetchWithSignalAndTimeout(
      url,
      {
        signal,

        timeoutMs:
          MUNICIPALITIES_TIMEOUT_MS,
      },
    );

  const rawData =
    await readJsonResponse(
      response,
      'Falha ao carregar os municípios do Ceará',
    );

  /*
   * O Ceará possui 184 municípios. Não exigimos
   * exatamente 184 para não derrubar o app diante
   * de alterações administrativas ou respostas
   * simplificadas.
   */
  const validatedGeoJSON =
    validateTerritorialGeoJSON(
      rawData,
      {
        label:
          'Municípios do Ceará',

        minimumFeatures:
          100,
      },
    );

  try {
    /*
     * Complementa a malha geométrica com o catálogo
     * administrativo oficial da API de Localidades.
     */
    const catalog =
      await loadCearaMunicipalityCatalog(
        {
          signal,
        },
      );

    return enrichMunicipalityGeoJSON(
      validatedGeoJSON,
      catalog,
    );
  } catch (error) {
    /*
     * Uma falha temporária no catálogo de nomes não
     * deve impedir que a malha geométrica seja usada.
     *
     * A próxima sincronização tentará enriquecer
     * novamente os nomes.
     */
    console.warn(
      '[municipalityService] Não foi possível enriquecer os nomes municipais:',
      error,
    );

    return validatedGeoJSON;
  }
}

/**
 * Extrai o AbortSignal recebido do SyncEngine.
 *
 * Também aceita diretamente um AbortSignal para manter flexibilidade.
 */
function extractSignal(options) {
  if (!options) {
    return undefined;
  }

  if (
    typeof AbortSignal !== 'undefined' &&
    options instanceof AbortSignal
  ) {
    return options;
  }

  return options.signal;
}

/**
 * Carrega o limite estadual.
 *
 * Política:
 * - network-first;
 * - cache válido como fallback;
 * - nunca retorna FeatureCollection vazia silenciosamente.
 */
export async function loadCearaBoundary(
  options = {},
) {
  const signal = extractSignal(options);

  const validationOptions = {
    label: 'Limite do Ceará em cache',
    minimumFeatures: 1,
  };

  const cached = await readValidCache(
    db.stores.boundary,
    BOUNDARY_CACHE_KEY,
    validationOptions,
  );

  try {
    const geojson =
      await fetchCearaBoundary(signal);

    await writeCache(
      db.stores.boundary,
      BOUNDARY_CACHE_KEY,
      geojson,
      {
        featureCount:
          geojson.features.length,
      },
    );

    ErrorManager.clear('layer');

    return geojson;
  } catch (error) {
    console.error(
      '[municipalityService] Falha ao atualizar o limite do Ceará:',
      error,
    );

    ErrorManager.report(
      'layer',
      error,
      {
        layer: 'boundary',
        operation:
          'loadCearaBoundary',
        usingCache: Boolean(cached?.data),
      },
    );

    if (cached?.data) {
      console.warn(
        '[municipalityService] Usando limite do Ceará armazenado em cache.',
      );

      return cached.data;
    }

    throw new Error(
      `Não foi possível carregar o limite do Ceará e não existe cache válido. ${
        error?.message || ''
      }`,
      {
        cause: error,
      },
    );
  }
}

/**
 * Carrega os limites municipais.
 *
 * Política:
 * - network-first;
 * - cache válido como fallback;
 * - exige uma quantidade mínima de feições;
 * - nunca retorna FeatureCollection vazia silenciosamente.
 */
export async function loadMunicipalities(
  options = {},
) {
  const signal = extractSignal(options);

  const validationOptions = {
    label:
      'Municípios do Ceará em cache',
    minimumFeatures: 100,
  };

  const cached = await readValidCache(
    db.stores.municipalities,
    MUNICIPALITIES_CACHE_KEY,
    validationOptions,
  );

  try {
    const geojson =
      await fetchMunicipalities(signal);

          const municipalitiesWithName =
        geojson.features.filter(
          (feature) =>
            typeof feature
              ?.properties
              ?.nome ===
              'string' &&
            feature.properties
              .nome
              .trim() !== '',
        ).length;

      await writeCache(
        db.stores.municipalities,
        MUNICIPALITIES_CACHE_KEY,
        geojson,
        {
          featureCount:
            geojson.features.length,

          municipalitiesWithName,
        },
      );

    ErrorManager.clear('layer');

    return geojson;
  } catch (error) {
    console.error(
      '[municipalityService] Falha ao atualizar os municípios:',
      error,
    );

    ErrorManager.report(
      'layer',
      error,
      {
        layer: 'municipalities',
        operation:
          'loadMunicipalities',
        usingCache: Boolean(cached?.data),
      },
    );

    if (cached?.data) {
      console.warn(
        '[municipalityService] Usando municípios armazenados em cache.',
      );

      return cached.data;
    }

    throw new Error(
      `Não foi possível carregar os municípios do Ceará e não existe cache válido. ${
        error?.message || ''
      }`,
      {
        cause: error,
      },
    );
  }
}

/**
 * Calcula a bounding box de um GeoJSON.
 *
 * Retorna no formato esperado pelos serviços WFS:
 * minX,minY,maxX,maxY
 */
export function computeBbox(geojson) {
  const validated =
    validateTerritorialGeoJSON(geojson, {
      label:
        'GeoJSON usado para calcular o BBOX',
      minimumFeatures: 1,
    });

  const bbox = turf.bbox(validated);

  if (
    !Array.isArray(bbox) ||
    bbox.length !== 4 ||
    bbox.some(
      (coordinate) =>
        !Number.isFinite(coordinate),
    )
  ) {
    throw new Error(
      'Não foi possível calcular uma bounding box válida.',
    );
  }

  return bbox.join(',');
}

/**
 * Retorna uma feição única representando o Ceará.
 *
 * Caso a API retorne várias feições, elas são combinadas.
 */
export function getBoundaryPolygon(
  boundaryFeatureCollection,
) {
  if (
    !boundaryFeatureCollection?.features
      ?.length
  ) {
    return null;
  }

  const validFeatures =
    boundaryFeatureCollection.features.filter(
      (feature) =>
        feature?.type === 'Feature' &&
        isValidGeometry(feature.geometry),
    );

  if (validFeatures.length === 0) {
    return null;
  }

  if (validFeatures.length === 1) {
    return validFeatures[0];
  }

  try {
    const collection = {
      type: 'FeatureCollection',
      features: validFeatures,
    };

    const combined = turf.combine(collection);

    return combined?.features?.[0] || null;
  } catch (error) {
    console.warn(
      '[municipalityService] Não foi possível combinar as feições do limite:',
      error,
    );

    return validFeatures[0];
  }
}

/**
 * Permite consultar manualmente o cache, sem solicitar a rede.
 */
export async function getCachedCearaBoundary() {
  const cached = await readValidCache(
    db.stores.boundary,
    BOUNDARY_CACHE_KEY,
    {
      label: 'Limite do Ceará em cache',
      minimumFeatures: 1,
    },
  );

  return cached?.data || null;
}

/**
 * Permite consultar manualmente o cache municipal.
 */
export async function getCachedMunicipalities() {
  const cached = await readValidCache(
    db.stores.municipalities,
    MUNICIPALITIES_CACHE_KEY,
    {
      label:
        'Municípios do Ceará em cache',
      minimumFeatures: 100,
    },
  );

  return cached?.data || null;
}

/**
 * Exportação auxiliar para lugares que precisem de uma coleção vazia.
 */
export function createEmptyFeatureCollection() {
  return emptyFeatureCollection();
}