/**
 * municipalityCatalogService
 *
 * Carrega o catálogo oficial de municípios do Ceará
 * pela API de Localidades do IBGE e associa os nomes
 * oficiais às feições da malha municipal.
 *
 * A API de malhas fornece prioritariamente geometria.
 * A API de localidades fornece os dados administrativos,
 * incluindo código IBGE e nome oficial do município.
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

  if (!normalized) {
    return null;
  }

  return normalized;
}

/**
 * Procura o código municipal nos campos mais comuns
 * usados pelas APIs e arquivos geográficos.
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

    properties.cod_municipio,
    properties.codigo_municipio,

    properties.CD_MUN,
    properties.cd_mun,

    properties.CD_GEOCMU,
    properties.cd_geocmu,

    properties.geocodigo,
    properties.GEOCODIGO,
  ];

  for (const candidate of candidates) {
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
    data.filter(
      (item) =>
        normalizeMunicipalityId(
          item?.id,
        ) &&
        typeof item?.nome ===
          'string' &&
        item.nome.trim() !== '',
    );

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
 * Converte a lista do IBGE em um Map para consulta rápida.
 *
 * Chave:
 * código IBGE normalizado.
 */
export function createMunicipalityCatalogMap(
  municipalities,
) {
  const catalog =
    new Map();

  for (
    const municipality
    of municipalities
  ) {
    const id =
      normalizeMunicipalityId(
        municipality?.id,
      );

    const name =
      typeof municipality?.nome ===
        'string'
        ? municipality.nome.trim()
        : '';

    if (!id || !name) {
      continue;
    }

    catalog.set(
      id,
      {
        id,
        name,

        immediateRegion:
          municipality
            ?.regiao-imediata
            ?.nome ||
          null,

        intermediateRegion:
          municipality
            ?.regiao-imediata
            ?.['regiao-intermediaria']
            ?.nome ||
          null,

        state:
          municipality
            ?.regiao-imediata
            ?.['regiao-intermediaria']
            ?.UF?.nome ||
          'Ceará',

        stateCode:
          municipality
            ?.regiao-imediata
            ?.['regiao-intermediaria']
            ?.UF?.sigla ||
          'CE',
      },
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
          return feature;
        }

        matchedCount += 1;

        return {
          ...feature,

          id:
            feature.id ??
            catalogEntry.id,

          properties: {
            ...feature.properties,

            /*
             * Campos normalizados usados internamente.
             */
            id:
              catalogEntry.id,

            codigo_ibge:
              catalogEntry.id,

            municipio_id:
              catalogEntry.id,

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

            uf:
              catalogEntry.stateCode,

            sigla_uf:
              catalogEntry.stateCode,

            estado:
              catalogEntry.state,

            regiao_imediata:
              catalogEntry
                .immediateRegion,

            regiao_intermediaria:
              catalogEntry
                .intermediateRegion,
          },
        };
      },
    );

  console.info(
    '[municipalityCatalogService] Malha municipal enriquecida:',
    {
      total:
        features.length,

      matched:
        matchedCount,

      unmatched:
        features.length -
        matchedCount,
    },
  );

  return {
    ...geojson,
    features,
  };
}