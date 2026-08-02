/**
 * SensitiveAreaRegistry
 *
 * Contrato central das Áreas Sensíveis do GeoFogo Ceará.
 *
 * Uma Área Sensível pode ser:
 * - Unidade de Conservação;
 * - Terra Indígena;
 * - hospital;
 * - escola;
 * - área urbanizada;
 * - reservatório;
 * - comunidade tradicional;
 * - qualquer outra área de interesse operacional.
 *
 * Nesta primeira versão, o módulo apenas normaliza e combina:
 * - Unidades de Conservação;
 * - Terras Indígenas.
 *
 * Ele não altera as camadas originais nem o AlertEngine.
 */

const EMPTY_FEATURE_COLLECTION = {
  type:
    'FeatureCollection',

  features:
    [],
};

/**
 * Tipos atualmente reconhecidos.
 *
 * Novos tipos poderão ser adicionados aqui sem alterar
 * os consumidores da coleção normalizada.
 */
export const SENSITIVE_AREA_TYPES =
  Object.freeze({
    CONSERVATION_UNIT:
      'conservation-unit',

    INDIGENOUS_LAND:
      'indigenous-land',

    HOSPITAL:
      'hospital',

    SCHOOL:
      'school',

    URBAN_AREA:
      'urban-area',

    RESERVOIR:
      'reservoir',

    TRADITIONAL_COMMUNITY:
      'traditional-community',

    OTHER:
      'other',
  });

/**
 * Definições dos tipos atualmente ativos.
 */
export const SENSITIVE_AREA_DEFINITIONS =
  Object.freeze({
    [
      SENSITIVE_AREA_TYPES
        .CONSERVATION_UNIT
    ]:
      Object.freeze({
        type:
          SENSITIVE_AREA_TYPES
            .CONSERVATION_UNIT,

        label:
          'Unidade de Conservação',

        pluralLabel:
          'Unidades de Conservação',

        sourceLayerId:
          'conservation-units',

        source:
          'CNUC/MMA',

        geometryTypes: [
          'Polygon',
          'MultiPolygon',
        ],
      }),

    [
      SENSITIVE_AREA_TYPES
        .INDIGENOUS_LAND
    ]:
      Object.freeze({
        type:
          SENSITIVE_AREA_TYPES
            .INDIGENOUS_LAND,

        label:
          'Terra Indígena',

        pluralLabel:
          'Terras Indígenas',

        sourceLayerId:
          'indigenous-lands',

        source:
          'FUNAI/SIPAM',

        geometryTypes: [
          'Polygon',
          'MultiPolygon',
        ],
      }),
  });

function isFeatureCollection(
  value,
) {
  return (
    value?.type ===
      'FeatureCollection' &&
    Array.isArray(
      value.features,
    )
  );
}

function isFeature(
  value,
) {
  return (
    value?.type ===
      'Feature' &&
    value.geometry &&
    typeof value.geometry.type ===
      'string'
  );
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
    String(
      value,
    ).trim();

  return (
    text ||
    null
  );
}

function normalizeNumber(
  value,
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const numericValue =
    Number(
      value,
    );

  return Number.isFinite(
    numericValue,
  )
    ? numericValue
    : null;
}

/**
 * Retorna o primeiro valor textual válido.
 */
function firstText(
  ...values
) {
  for (
    const value
    of values
  ) {
    const normalized =
      normalizeText(
        value,
      );

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

/**
 * Retorna a definição de um tipo.
 */
export function getSensitiveAreaDefinition(
  type,
) {
  return (
    SENSITIVE_AREA_DEFINITIONS[
      type
    ] ||
    null
  );
}

/**
 * Verifica se uma geometria é aceita para o tipo.
 */
function isGeometryAllowed(
  feature,
  definition,
) {
  if (
    !isFeature(
      feature,
    ) ||
    !definition
  ) {
    return false;
  }

  return definition
    .geometryTypes
    .includes(
      feature.geometry.type,
    );
}

/**
 * Cria um identificador estável para uma Área Sensível.
 */
function createSensitiveId(
  type,
  feature,
  index,
) {
  const properties =
    feature?.properties ||
    {};

  const originalId =
    feature?.id ??
    properties.sensitive_id ??
    properties.cd_cnuc ??
    properties.codigo_cnuc ??
    properties.uc_id ??
    properties.terrai_cod ??
    properties.gid ??
    properties.id ??
    null;

  if (
    originalId !== undefined &&
    originalId !== null &&
    String(
      originalId,
    ).trim()
  ) {
    return (
      `${type}:` +
      `${String(
        originalId,
      ).trim()}`
    );
  }

  return (
    `${type}:generated-` +
    `${index + 1}`
  );
}

/**
 * Normaliza uma Unidade de Conservação.
 */
function normalizeConservationUnit(
  feature,
  index,
) {
  const definition =
    getSensitiveAreaDefinition(
      SENSITIVE_AREA_TYPES
        .CONSERVATION_UNIT,
    );

  if (
    !isGeometryAllowed(
      feature,
      definition,
    )
  ) {
    return null;
  }

  const properties =
    feature.properties ||
    {};

  const name =
    firstText(
      properties.sensitive_name,
      properties.nome_uc,
      properties.nome,
      properties.name,
      properties.nm_uc,
      properties.nome_unidade_conservacao,
      'Unidade de Conservação',
    );

  const category =
    firstText(
      properties.sensitive_category,
      properties.categoria,
      properties.grupo,
      properties.esfera,
    );

  const municipality =
    firstText(
      properties.municipio,
      properties.municipios,
      properties.nome_municipio,
    );

  const manager =
    firstText(
      properties.org_gestor,
      properties.orgao_gestor,
      properties.gestor,
    );

  const areaHa =
    normalizeNumber(
      properties.ha_total ??
      properties.area_ha ??
      properties.area_hectares,
    );

  const sensitiveId =
    createSensitiveId(
      definition.type,
      feature,
      index,
    );

  return {
    type:
      'Feature',

    id:
      sensitiveId,

    geometry:
      feature.geometry,

    properties: {
      ...properties,

      sensitive_id:
        sensitiveId,

      sensitive_type:
        definition.type,

      sensitive_label:
        definition.label,

      sensitive_name:
        name,

      sensitive_category:
        category,

      sensitive_source:
        firstText(
          properties
            .sensitive_source,
          properties.fonte,
          definition.source,
        ),

      sensitive_source_layer:
        definition
          .sourceLayerId,

      sensitive_original_id:
        feature.id ??
        properties.cd_cnuc ??
        properties.uc_id ??
        null,

      sensitive_municipality:
        municipality,

      sensitive_manager:
        manager,

      sensitive_area_ha:
        areaHa,

      sensitive_alert_enabled:
        true,

      sensitive_active:
        true,
    },
  };
}

/**
 * Normaliza uma Terra Indígena.
 */
function normalizeIndigenousLand(
  feature,
  index,
) {
  const definition =
    getSensitiveAreaDefinition(
      SENSITIVE_AREA_TYPES
        .INDIGENOUS_LAND,
    );

  if (
    !isGeometryAllowed(
      feature,
      definition,
    )
  ) {
    return null;
  }

  const properties =
    feature.properties ||
    {};

  const name =
    firstText(
      properties.sensitive_name,
      properties.indigenous_land_name,
      properties.terrai_nom,
      properties.nome,
      properties.name,
      'Terra Indígena',
    );

  const category =
    firstText(
      properties.sensitive_category,
      properties.indigenous_legal_phase,
      properties.fase_ti,
      properties.modalidade,
    );

  const municipality =
    firstText(
      properties.indigenous_municipalities,
      properties.municipio_,
      properties.municipio,
    );

  const people =
    firstText(
      properties.indigenous_people,
      properties.etnia_nome,
      properties.etnia,
    );

  const areaHa =
    normalizeNumber(
      properties.indigenous_area_ha ??
      properties.superficie ??
      properties.area_ha,
    );

  const sensitiveId =
    createSensitiveId(
      definition.type,
      feature,
      index,
    );

  return {
    type:
      'Feature',

    id:
      sensitiveId,

    geometry:
      feature.geometry,

    properties: {
      ...properties,

      sensitive_id:
        sensitiveId,

      sensitive_type:
        definition.type,

      sensitive_label:
        definition.label,

      sensitive_name:
        name,

      sensitive_category:
        category,

      sensitive_source:
        firstText(
          properties
            .sensitive_source,
          properties.fonte,
          definition.source,
        ),

      sensitive_source_layer:
        definition
          .sourceLayerId,

      sensitive_original_id:
        feature.id ??
        properties.terrai_cod ??
        properties.gid ??
        null,

      sensitive_municipality:
        municipality,

      sensitive_people:
        people,

      sensitive_area_ha:
        areaHa,

      sensitive_alert_enabled:
        true,

      sensitive_active:
        true,
    },
  };
}

/**
 * Normaliza uma coleção de acordo com seu tipo.
 */
export function normalizeSensitiveAreaCollection(
  collection,
  type,
) {
  if (
    !isFeatureCollection(
      collection,
    )
  ) {
    return {
      ...EMPTY_FEATURE_COLLECTION,

      metadata: {
        sensitiveType:
          type,

        inputFeatureCount:
          0,

        outputFeatureCount:
          0,

        normalizedAt:
          Date.now(),
      },
    };
  }

  let normalizer =
    null;

  switch (
    type
  ) {
    case SENSITIVE_AREA_TYPES
      .CONSERVATION_UNIT:
      normalizer =
        normalizeConservationUnit;
      break;

    case SENSITIVE_AREA_TYPES
      .INDIGENOUS_LAND:
      normalizer =
        normalizeIndigenousLand;
      break;

    default:
      normalizer =
        null;
  }

  if (!normalizer) {
    return {
      ...EMPTY_FEATURE_COLLECTION,

      metadata: {
        sensitiveType:
          type,

        inputFeatureCount:
          collection
            .features
            .length,

        outputFeatureCount:
          0,

        normalizedAt:
          Date.now(),

        unsupported:
          true,
      },
    };
  }

  const features =
    collection.features
      .map(
        (
          feature,
          index,
        ) =>
          normalizer(
            feature,
            index,
          ),
      )
      .filter(
        Boolean,
      );

  return {
    type:
      'FeatureCollection',

    features,

    metadata: {
      ...(collection.metadata ||
        {}),

      sensitiveType:
        type,

      inputFeatureCount:
        collection
          .features
          .length,

      outputFeatureCount:
        features.length,

      normalizedAt:
        Date.now(),
    },
  };
}

/**
 * Combina todas as fontes de Áreas Sensíveis.
 *
 * A coleção resultante não substitui as camadas originais.
 * Ela será usada posteriormente por:
 * - AlertEngine;
 * - cálculo da área mais próxima;
 * - estatísticas;
 * - diagnóstico.
 */
export function buildSensitiveAreasCollection({
  conservationUnits,
  indigenousLands,
} = {}) {
  const normalizedConservationUnits =
    normalizeSensitiveAreaCollection(
      conservationUnits,
      SENSITIVE_AREA_TYPES
        .CONSERVATION_UNIT,
    );

  const normalizedIndigenousLands =
    normalizeSensitiveAreaCollection(
      indigenousLands,
      SENSITIVE_AREA_TYPES
        .INDIGENOUS_LAND,
    );

  const features = [
    ...normalizedConservationUnits
      .features,

    ...normalizedIndigenousLands
      .features,
  ];

  return {
    type:
      'FeatureCollection',

    features,

    metadata: {
      source:
        'GeoFogo Ceará',

      collectionType:
        'sensitive-areas',

      totalFeatureCount:
        features.length,

      countsByType: {
        [
          SENSITIVE_AREA_TYPES
            .CONSERVATION_UNIT
        ]:
          normalizedConservationUnits
            .features
            .length,

        [
          SENSITIVE_AREA_TYPES
            .INDIGENOUS_LAND
        ]:
          normalizedIndigenousLands
            .features
            .length,
      },

      generatedAt:
        Date.now(),
    },
  };
}

/**
 * Filtra a coleção por tipo.
 */
export function filterSensitiveAreasByType(
  collection,
  type,
) {
  if (
    !isFeatureCollection(
      collection,
    )
  ) {
    return {
      ...EMPTY_FEATURE_COLLECTION,
    };
  }

  return {
    ...collection,

    features:
      collection.features.filter(
        (feature) =>
          feature
            ?.properties
            ?.sensitive_type ===
          type,
      ),
  };
}

/**
 * Localiza uma Área Sensível pelo identificador.
 */
export function findSensitiveAreaById(
  collection,
  sensitiveId,
) {
  if (
    !isFeatureCollection(
      collection,
    ) ||
    sensitiveId ===
      undefined ||
    sensitiveId ===
      null
  ) {
    return null;
  }

  const target =
    String(
      sensitiveId,
    );

  return (
    collection.features.find(
      (feature) =>
        String(
          feature
            ?.properties
            ?.sensitive_id ??
          feature?.id,
        ) ===
        target,
    ) ||
    null
  );
}

/**
 * Retorna um resumo simples para estatísticas
 * e diagnóstico.
 */
export function summarizeSensitiveAreas(
  collection,
) {
  if (
    !isFeatureCollection(
      collection,
    )
  ) {
    return {
      total:
        0,

      byType:
        {},
    };
  }

  const byType =
    {};

  for (
    const feature
    of collection.features
  ) {
    const type =
      feature
        ?.properties
        ?.sensitive_type ||
      SENSITIVE_AREA_TYPES
        .OTHER;

    byType[type] =
      (
        byType[type] ||
        0
      ) +
      1;
  }

  return {
    total:
      collection
        .features
        .length,

    byType,
  };
}