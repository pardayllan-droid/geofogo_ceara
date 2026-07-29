/**
 * fireEventEnrichmentService
 *
 * Enriquece os eventos de fogo com o município onde
 * se encontra o seu ponto representativo.
 *
 * Os campos adicionados são:
 *
 * - municipio
 * - municipality
 * - nome
 * - nome_original, quando o evento já possuía nome
 *
 * Isso permite que alertas, popups, marcadores e
 * estatísticas utilizem a mesma identificação.
 */

import {
  findContaining,
  representativePoint,
} from '../spatial/SpatialEngine';

const UNKNOWN_EVENT_NAME =
  'Evento sem município identificado';

/**
 * Retorna o primeiro valor textual válido.
 */
function firstTextValue(
  values,
) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return String(value).trim();
    }
  }

  return null;
}

/**
 * Extrai o nome do município independentemente do
 * campo utilizado pela resposta GeoJSON do IBGE.
 */
export function getMunicipalityName(
  municipalityFeature,
) {
  const properties =
    municipalityFeature?.properties || {};

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
    properties.nome_municipio,

    properties.description,
  ]);
}

/**
 * Tenta localizar diretamente o município que contém
 * o ponto representativo do evento.
 */
function findMunicipalityForEvent(
  eventFeature,
  municipalities,
) {
  if (
    !eventFeature?.geometry ||
    !municipalities?.features?.length
  ) {
    return null;
  }

  try {
    const containing =
      findContaining(
        eventFeature,
        municipalities,
      );

    if (containing.length > 0) {
      return containing[0];
    }
  } catch (error) {
    console.warn(
      '[fireEventEnrichmentService] Falha ao localizar município:',
      error,
    );
  }

  return null;
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

  const municipality =
    findMunicipalityForEvent(
      eventFeature,
      municipalities,
    );

  const municipalityName =
    getMunicipalityName(
      municipality,
    );

  const currentProperties =
    eventFeature.properties || {};

  const originalName =
    firstTextValue([
      currentProperties.nome,
      currentProperties.name,
      currentProperties.eventName,
      currentProperties.event_name,
    ]);

  /*
   * Quando o SIPAM já possui um nome operacional útil,
   * ele é preservado em nome_original.
   *
   * O campo nome passa a apresentar o município, conforme
   * a regra solicitada para o GeoFogo.
   */
  const properties = {
    ...currentProperties,

    nome_original:
      originalName &&
      originalName !==
        'Evento sem nome'
        ? originalName
        : currentProperties.nome_original ||
          null,

    municipio:
      municipalityName ||
      currentProperties.municipio ||
      currentProperties.municipality ||
      null,

    municipality:
      municipalityName ||
      currentProperties.municipality ||
      currentProperties.municipio ||
      null,

    nome:
      municipalityName ||
      currentProperties.municipio ||
      currentProperties.municipality ||
      (
        originalName !==
        'Evento sem nome'
          ? originalName
          : null
      ) ||
      UNKNOWN_EVENT_NAME,

    municipio_identificado:
      Boolean(municipalityName),

    municipio_id:
      municipality?.id ??
      municipality?.properties?.id ??
      municipality?.properties?.codarea ??
      municipality?.properties?.CD_MUN ??
      municipality?.properties?.cd_mun ??
      null,
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
      type: 'FeatureCollection',
      features: [],
    };
  }

  if (
    !municipalities?.features?.length
  ) {
    console.warn(
      '[fireEventEnrichmentService] Malha municipal indisponível. Eventos não foram enriquecidos.',
    );

    return fireEvents;
  }

  let identifiedCount = 0;

  const features =
    fireEvents.features.map(
      (eventFeature) => {
        const enriched =
          enrichFireEventWithMunicipality(
            eventFeature,
            municipalities,
          );

        if (
          enriched?.properties
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
      total: features.length,
      identified: identifiedCount,
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
 *
 * Exportação auxiliar para diagnóstico ou uso futuro.
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