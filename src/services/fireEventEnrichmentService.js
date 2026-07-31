/**
 * fireEventEnrichmentService
 *
 * Enriquece os eventos de fogo com o município onde
 * se encontra o seu ponto representativo.
 *
 * Os campos normalizados adicionados são:
 *
 * - municipio
 * - municipality
 * - nome_municipio
 * - municipio_id
 * - municipio_identificado
 * - nome
 * - nome_original
 *
 * A identificação principal é feita espacialmente,
 * utilizando a malha municipal enriquecida do IBGE.
 */

import {
  findContaining,
  representativePoint,
} from '../spatial/SpatialEngine';

const UNKNOWN_EVENT_NAME =
  'Evento sem município identificado';

const INVALID_EVENT_NAMES =
  new Set([
    'Evento sem nome',
    UNKNOWN_EVENT_NAME,
  ]);

/**
 * Identifica representações internas de arrays Java,
 * que algumas propriedades do SIPAM retornam como texto.
 *
 * Exemplo:
 * [Ljava.lang.String;@24887cdb
 */
function isJavaObjectRepresentation(
  value,
) {
  if (
    typeof value !==
    'string'
  ) {
    return false;
  }

  const text =
    value.trim();

  return (
    /^\[L(?:java\.)?lang\.[A-Za-z]+;@[0-9a-f]+$/i.test(
      text,
    ) ||
    /^\[L[A-Za-z0-9_.]+;@[0-9a-f]+$/i.test(
      text,
    )
  );
}

/**
 * Verifica se um valor pode ser apresentado
 * como texto legível ao usuário.
 */
export function isReadableText(
  value,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return false;
  }

  const text =
    String(value).trim();

  if (!text) {
    return false;
  }

  if (
    isJavaObjectRepresentation(
      text,
    )
  ) {
    return false;
  }

  if (
    text === '[object Object]' ||
    text === 'null' ||
    text === 'undefined'
  ) {
    return false;
  }

  return true;
}

/**
 * Retorna o primeiro valor textual legível.
 */
function firstTextValue(
  values,
) {
  for (const value of values) {
    if (
      isReadableText(
        value,
      )
    ) {
      return String(
        value,
      ).trim();
    }
  }

  return null;
}

/**
 * Extrai o código municipal da feição do IBGE.
 */
export function getMunicipalityId(
  municipalityFeature,
) {
  const properties =
    municipalityFeature
      ?.properties || {};

  const candidates = [
    municipalityFeature?.id,

    properties.id,
    properties.ID,

    properties.municipio_id,

    properties.codigo_ibge,
    properties.codigoIBGE,

    properties.codarea,
    properties.CODAREA,

    properties.CD_MUN,
    properties.cd_mun,

    properties.CD_GEOCMU,
    properties.cd_geocmu,
  ];

  for (const candidate of candidates) {
    if (
      candidate === undefined ||
      candidate === null
    ) {
      continue;
    }

    const normalized =
      String(candidate)
        .trim()
        .replace(/\D/g, '');

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

/**
 * Extrai o nome do município independentemente do
 * campo utilizado pela malha municipal.
 */
export function getMunicipalityName(
  municipalityFeature,
) {
  const properties =
    municipalityFeature
      ?.properties || {};

  return firstTextValue([
    properties.nome,
    properties.NOME,

    properties.name,
    properties.NAME,

    properties.nome_municipio,
    properties.nomeMunicipio,

    properties.municipio,
    properties.municipality,

    properties.NM_MUN,
    properties.nm_mun,

    properties.NM_MUNICIP,
    properties.nm_municip,

    properties.NOME_MUNICIPIO,

    properties.description,
  ]);
}

/**
 * Tenta localizar o município que contém
 * o ponto representativo do evento.
 */
function findMunicipalityForEvent(
  eventFeature,
  municipalities,
) {
  if (
    !eventFeature?.geometry ||
    !municipalities
      ?.features
      ?.length
  ) {
    return null;
  }

  try {
    const containing =
      findContaining(
        eventFeature,
        municipalities,
      );

    if (
      containing.length > 0
    ) {
      return containing[0];
    }
  } catch (error) {
    console.warn(
      '[fireEventEnrichmentService] Falha ao localizar município:',
      error,
    );
  }

  try {
    const point =
      representativePoint(
        eventFeature,
      );

    console.warn(
      '[municipality-debug] Nenhum município encontrado:',
      {
        eventId:
          eventFeature
            ?.properties
            ?.id_evento,

        representativePoint:
          point?.geometry
            ?.coordinates,

        municipalityCount:
          municipalities
            ?.features
            ?.length,
      },
    );
  } catch {
    // Apenas diagnóstico.
  }
  return null;
}

/**
 * Retorna um nome municipal legível já presente
 * no evento, quando existir.
 *
 * Essa é apenas uma alternativa. A identificação
 * espacial pela malha do IBGE tem prioridade.
 */
function getExistingMunicipalityName(
  properties,
) {
  return firstTextValue([
    properties.municipio,
    properties.municipality,

    properties.nome_municipio,
    properties.nomeMunicipio,

    properties.NM_MUN,
    properties.nm_mun,
  ]);
}

/**
 * Enriquece um único evento.
 */
export function enrichFireEventWithMunicipality(
  eventFeature,
  municipalities,
) {
  if (!eventFeature) {
    return eventFeature;
  }

  const municipalityFeature =
    findMunicipalityForEvent(
      eventFeature,
      municipalities,
    );

  const spatialMunicipalityName =
    getMunicipalityName(
      municipalityFeature,
    );

  const spatialMunicipalityId =
    getMunicipalityId(
      municipalityFeature,
    );

  const currentProperties =
    eventFeature.properties ||
    {};

  const existingMunicipalityName =
    getExistingMunicipalityName(
      currentProperties,
    );

  const municipalityName =
    spatialMunicipalityName ||
    existingMunicipalityName ||
    null;

  const originalName =
    firstTextValue([
      currentProperties.nome_original,

      currentProperties.nome,
      currentProperties.name,

      currentProperties.eventName,
      currentProperties.event_name,
    ]);

  const usefulOriginalName =
    originalName &&
    !INVALID_EVENT_NAMES.has(
      originalName,
    )
      ? originalName
      : null;

  const municipalityIdentified =
    Boolean(
      municipalityName,
    );

  const properties = {
    ...currentProperties,

    nome_original:
      usefulOriginalName,

    municipio:
      municipalityName,

    municipality:
      municipalityName,

    nome_municipio:
      municipalityName,

    municipio_id:
      spatialMunicipalityId ||
      currentProperties
        .municipio_id ||
      null,

    municipio_identificado:
      municipalityIdentified,

    /*
     * O nome principal do evento passa a ser o município.
     * Isso mantém alertas, marcadores e popup consistentes.
     */
    nome:
      municipalityName ||
      usefulOriginalName ||
      UNKNOWN_EVENT_NAME,
  };

  return {
    ...eventFeature,
    properties,
  };
}

/**
 * Enriquece uma FeatureCollection de eventos.
 */
export function enrichFireEventsWithMunicipalities(
  fireEvents,
  municipalities,
) {
  if (
    fireEvents?.type !==
      'FeatureCollection' ||
    !Array.isArray(
      fireEvents.features,
    )
  ) {
    return {
      type:
        'FeatureCollection',

      features: [],
    };
  }

  if (
    !municipalities
      ?.features
      ?.length
  ) {
    console.warn(
      '[fireEventEnrichmentService] Malha municipal indisponível. Eventos não foram enriquecidos.',
    );

    return fireEvents;
  }

  let identifiedCount = 0;

  const features =
  console.info(
    '[municipality-debug] Amostra da malha:',
    {
      municipalityCount:
        municipalities.features.length,

      firstMunicipality: {
        id:
          municipalities.features[0]?.id,

        geometryType:
          municipalities.features[0]
            ?.geometry?.type,

        properties:
          municipalities.features[0]
            ?.properties,

        firstCoordinate:
          municipalities.features[0]
            ?.geometry
            ?.coordinates?.[0]?.[0]?.[0] ||
          municipalities.features[0]
            ?.geometry
            ?.coordinates?.[0]?.[0],
      },

      firstEvent: {
        id:
          fireEvents.features[0]
            ?.properties?.id_evento,

        geometryType:
          fireEvents.features[0]
            ?.geometry?.type,

        firstCoordinate:
          fireEvents.features[0]
            ?.geometry
            ?.coordinates?.[0]?.[0]?.[0] ||
          fireEvents.features[0]
            ?.geometry
            ?.coordinates?.[0]?.[0],
      },
    },
  );
    fireEvents.features.map(
      (eventFeature) => {
        const enriched =
          enrichFireEventWithMunicipality(
            eventFeature,
            municipalities,
          );

        if (
          enriched
            ?.properties
            ?.municipio_identificado
        ) {
          identifiedCount += 1;
        }

        return enriched;
      },
    );

  console.info(
    '[fireEventEnrichmentService] Eventos enriquecidos:',
    {
      total:
        features.length,

      identified:
        identifiedCount,

      unidentified:
        features.length -
        identifiedCount,
    },
  );

  return {
    ...fireEvents,
    features,
  };
}

/**
 * Retorna o ponto representativo de um evento.
 */
export function getEventRepresentativePoint(
  eventFeature,
) {
  try {
    return representativePoint(
      eventFeature,
    );
  } catch {
    return null;
  }
}