/**
 * municipalityCatalogService
 *
 * Carrega o catálogo oficial de municípios do Ceará
 * pela API de Localidades do IBGE e associa os nomes
 * oficiais às feições da malha municipal.
 *
 * A API de Malhas fornece as geometrias.
 * A API de Localidades fornece os dados administrativos,
 * como código IBGE, nome do município e regiões.
 */

import {
  fetchWithTimeout,
} from '../utils/fetchWithTimeout';

const CEARA_STATE_ID = 23;

const IBGE_LOCALITIES_URL =
  `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${CEARA_STATE_ID}/municipios`;

const REQUEST_TIMEOUT_MS = 30000;

const MINIMUM_EXPECTED_MUNICIPALITIES =
  100;

/**
 * Normaliza diferentes representações do código IBGE.
 *
 * Exemplos:
 *
 * 2300101       → "2300101"
 * "2300101"     → "2300101"
 * "23.001-01"   → "2300101"
 */
export function normalizeMunicipalityId(
  value,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .replace(/\D/g, '');

  return normalized || null;
}

/**
 * Retorna texto não vazio ou null.
 */
function normalizeText(
  value,
) {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

/**
 * Procura o código municipal nos campos mais comuns
 * utilizados por APIs e arquivos geográficos.
 */
export function getMunicipalityFeatureId(
  feature,
) {
  const properties =
    feature?.properties || {};

  const candidates = [
    feature?.id,

    properties.id,
    properties.ID,

    properties.codarea,
    properties.CODAREA,

    properties.codigo_ibge,
    properties.codigoIBGE,

    properties.municipio_id,

    properties.cod_municipio,
    properties.codigo_municipio,

    properties.CD_MUN,
    properties.cd_mun,

    properties.CD_GEOCMU,
    properties.cd_geocmu,

    properties.geocodigo,
    properties.GEOCODIGO,
  ];

  for (
    const candidate
    of candidates
  ) {
    const normalized =
      normalizeMunicipalityId(
        candidate,
      );

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

/**
 * Obtém com segurança a região imediata.
 *
 * Os nomes das propriedades retornadas pelo IBGE
 * contêm hífen e, por isso, precisam ser acessados
 * com a notação de colchetes.
 */
function getImmediateRegion(
  municipality,
) {
  return (
    municipality
      ?.['regiao-imediata'] ||
    municipality
      ?.regiaoImediata ||
    null
  );
}

/**
 * Obtém com segurança a região intermediária.
 */
function getIntermediateRegion(
  municipality,
) {
  const immediateRegion =
    getImmediateRegion(
      municipality,
    );

  return (
    immediateRegion
      ?.['regiao-intermediaria'] ||
    immediateRegion
      ?.regiaoIntermediaria ||
    municipality
      ?.['regiao-intermediaria'] ||
    municipality
      ?.regiaoIntermediaria ||
    null
  );
}

/**
 * Obtém com segurança a UF relacionada ao município.
 */
function getState(
  municipality,
) {
  const intermediateRegion =
    getIntermediateRegion(
      municipality,
    );

  return (
    intermediateRegion?.UF ||
    intermediateRegion?.uf ||
    municipality?.UF ||
    municipality?.uf ||
    null
  );
}

/**
 * Converte um item bruto da API do IBGE
 * para o formato interno do catálogo.
 */
function normalizeMunicipalityCatalogEntry(
  municipality,
) {
  const id =
    normalizeMunicipalityId(
      municipality?.id,
    );

  const name =
    normalizeText(
      municipality?.nome,
    );

  if (!id || !name) {
    return null;
  }

  const immediateRegion =
    getImmediateRegion(
      municipality,
    );

  const intermediateRegion =
    getIntermediateRegion(
      municipality,
    );

  const state =
    getState(
      municipality,
    );

  return {
    id,
    name,

    immediateRegion:
      normalizeText(
        immediateRegion?.nome,
      ),

    intermediateRegion:
      normalizeText(
        intermediateRegion?.nome,
      ),

    state:
      normalizeText(
        state?.nome,
      ) ||
      'Ceará',

    stateCode:
      normalizeText(
        state?.sigla,
      ) ||
      'CE',
  };
}

/**
 * Valida a resposta da API de Localidades.
 */
function validateMunicipalityCatalog(
  data,
) {
  if (!Array.isArray(data)) {
    throw new Error(
      'A API de Localidades do IBGE não retornou uma lista.',
    );
  }

  const validItems =
    data
      .map(
        normalizeMunicipalityCatalogEntry,
      )
      .filter(Boolean);

  if (
    validItems.length <
    MINIMUM_EXPECTED_MUNICIPALITIES
  ) {
    throw new Error(
      `O catálogo municipal do IBGE retornou apenas ${validItems.length} municípios válidos.`,
    );
  }

  return validItems;
}

/**
 * Converte a lista normalizada em um Map para
 * consultas rápidas pelo código IBGE.
 */
export function createMunicipalityCatalogMap(
  municipalities,
) {
  if (!Array.isArray(municipalities)) {
    throw new Error(
      'Não foi informada uma lista municipal válida.',
    );
  }

  const catalog =
    new Map();

  for (
    const municipality
    of municipalities
  ) {
    /*
     * Aceita tanto registros brutos do IBGE quanto
     * registros já normalizados.
     */
    const entry =
      municipality?.name &&
      municipality?.id
        ? {
            id:
              normalizeMunicipalityId(
                municipality.id,
              ),

            name:
              normalizeText(
                municipality.name,
              ),

            immediateRegion:
              normalizeText(
                municipality
                  .immediateRegion,
              ),

            intermediateRegion:
              normalizeText(
                municipality
                  .intermediateRegion,
              ),

            state:
              normalizeText(
                municipality.state,
              ) ||
              'Ceará',

            stateCode:
              normalizeText(
                municipality
                  .stateCode,
              ) ||
              'CE',
          }
        : normalizeMunicipalityCatalogEntry(
            municipality,
          );

    if (
      !entry?.id ||
      !entry?.name
    ) {
      continue;
    }

    catalog.set(
      entry.id,
      entry,
    );
  }

  if (
    catalog.size <
    MINIMUM_EXPECTED_MUNICIPALITIES
  ) {
    throw new Error(
      `O mapa municipal contém apenas ${catalog.size} registros válidos.`,
    );
  }

  return catalog;
}

/**
 * Busca o catálogo oficial dos municípios do Ceará.
 */
export async function loadCearaMunicipalityCatalog(
  {
    signal,
  } = {},
) {
  const response =
    await fetchWithTimeout(
      IBGE_LOCALITIES_URL,
      {
        signal,

        headers: {
          Accept:
            'application/json',
        },

        cache:
          'no-store',
      },
      REQUEST_TIMEOUT_MS,
    );

  if (!response.ok) {
    throw new Error(
      `Falha ao carregar o catálogo municipal do IBGE: HTTP ${response.status} ${response.statusText}`.trim(),
    );
  }

  let data;

  try {
    data =
      await response.json();
  } catch (error) {
    throw new Error(
      'A resposta da API de Localidades do IBGE não é um JSON válido.',
      {
        cause: error,
      },
    );
  }

  const validMunicipalities =
    validateMunicipalityCatalog(
      data,
    );

  const catalog =
    createMunicipalityCatalogMap(
      validMunicipalities,
    );

  console.info(
    '[municipalityCatalogService] Catálogo carregado:',
    {
      municipalityCount:
        catalog.size,
    },
  );

  return catalog;
}

/**
 * Monta as propriedades normalizadas para uma
 * feição municipal.
 */
function createEnrichedProperties(
  originalProperties,
  catalogEntry,
) {
  return {
    ...originalProperties,

    /*
     * Identificadores normalizados.
     */
    id:
      catalogEntry.id,

    codarea:
      normalizeMunicipalityId(
        originalProperties?.codarea,
      ) ||
      catalogEntry.id,

    codigo_ibge:
      catalogEntry.id,

    municipio_id:
      catalogEntry.id,

    /*
     * Nome oficial e aliases mantidos por
     * compatibilidade com os módulos existentes.
     */
    nome:
      catalogEntry.name,

    name:
      catalogEntry.name,

    municipio:
      catalogEntry.name,

    municipality:
      catalogEntry.name,

    nome_municipio:
      catalogEntry.name,

    nomeMunicipio:
      catalogEntry.name,

    /*
     * Unidade federativa.
     */
    uf:
      catalogEntry.stateCode,

    sigla_uf:
      catalogEntry.stateCode,

    estado:
      catalogEntry.state,

    /*
     * Regiões administrativas.
     */
    regiao_imediata:
      catalogEntry
        .immediateRegion,

    regiao_intermediaria:
      catalogEntry
        .intermediateRegion,
  };
}

/**
 * Associa os nomes oficiais às geometrias municipais.
 */
export function enrichMunicipalityGeoJSON(
  geojson,
  catalog,
) {
  if (
    geojson?.type !==
      'FeatureCollection' ||
    !Array.isArray(
      geojson.features,
    )
  ) {
    throw new Error(
      'Não foi informado um FeatureCollection municipal válido.',
    );
  }

  if (!(catalog instanceof Map)) {
    throw new Error(
      'O catálogo municipal informado é inválido.',
    );
  }

  let matchedCount = 0;
  const unmatchedIds = [];

  const features =
    geojson.features.map(
      (feature) => {
        const municipalityId =
          getMunicipalityFeatureId(
            feature,
          );

        const catalogEntry =
          municipalityId
            ? catalog.get(
                municipalityId,
              )
            : null;

        if (!catalogEntry) {
          unmatchedIds.push(
            municipalityId ||
            'sem-codigo',
          );

          return feature;
        }

        matchedCount += 1;

        return {
          ...feature,

          /*
           * O ID GeoJSON passa a ser o código oficial
           * quando a feição original não possuir ID.
           */
          id:
            feature.id ??
            catalogEntry.id,

          properties:
            createEnrichedProperties(
              feature.properties ||
                {},
              catalogEntry,
            ),
        };
      },
    );

  const unmatchedCount =
    features.length -
    matchedCount;

  console.info(
    '[municipalityCatalogService] Malha municipal enriquecida:',
    {
      total:
        features.length,

      matched:
        matchedCount,

      unmatched:
        unmatchedCount,

      unmatchedIds:
        unmatchedCount > 0
          ? unmatchedIds.slice(
              0,
              10,
            )
          : [],
    },
  );

  /*
   * Uma correspondência muito baixa indica que
   * os códigos da malha e do catálogo não são compatíveis.
   * Nesse caso é mais seguro interromper o enriquecimento.
   */
  if (
    features.length > 0 &&
    matchedCount <
      Math.min(
        MINIMUM_EXPECTED_MUNICIPALITIES,
        features.length,
      )
  ) {
    throw new Error(
      `A malha municipal foi enriquecida parcialmente: ${matchedCount} de ${features.length} municípios foram associados ao catálogo do IBGE.`,
    );
  }

  return {
    ...geojson,
    features,
  };
}