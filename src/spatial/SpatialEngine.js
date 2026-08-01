/**
 * SpatialEngine
 *
 * Operações geográficas utilizadas pelo GeoFogo Ceará.
 *
 * Responsabilidades:
 * - validar feições GeoJSON;
 * - filtrar feições pelo limite real do Ceará;
 * - aceitar Polygon e MultiPolygon;
 * - calcular distância, área e bounding box;
 * - gerar buffers;
 * - identificar polígonos que contêm uma feição;
 * - gerar pontos representativos.
 */

import * as turf from '@turf/turf';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

const POLYGON_GEOMETRY_TYPES =
  new Set([
    'Polygon',
    'MultiPolygon',
  ]);

const POINT_GEOMETRY_TYPES =
  new Set([
    'Point',
    'MultiPoint',
  ]);

/**
 * Verifica se o valor é uma Feature GeoJSON válida.
 */
export function isValidFeature(
  feature,
) {
  if (
    !feature ||
    feature.type !== 'Feature' ||
    !feature.geometry ||
    !feature.geometry.type
  ) {
    return false;
  }

  if (
    feature.geometry.type ===
    'GeometryCollection'
  ) {
    return Array.isArray(
      feature.geometry.geometries,
    );
  }

  return (
    feature.geometry.coordinates !==
    undefined &&
    feature.geometry.coordinates !==
    null
  );
}

/**
 * Verifica se o valor é uma FeatureCollection.
 */
function isFeatureCollection(
  geojson,
) {
  return (
    geojson?.type ===
      'FeatureCollection' &&
    Array.isArray(
      geojson.features,
    )
  );
}

/**
 * Verifica se a geometria é poligonal.
 */
function isPolygonFeature(
  feature,
) {
  return (
    isValidFeature(feature) &&
    POLYGON_GEOMETRY_TYPES.has(
      feature.geometry.type,
    )
  );
}

/**
 * Verifica se a geometria é do tipo ponto.
 */
function isPointFeature(
  feature,
) {
  return (
    isValidFeature(feature) &&
    POINT_GEOMETRY_TYPES.has(
      feature.geometry.type,
    )
  );
}

/**
 * Retorna a Feature poligonal usada como limite.
 *
 * Aceita:
 * - Feature Polygon;
 * - Feature MultiPolygon;
 * - FeatureCollection contendo polígonos.
 */
function normalizeBoundaryFeature(
  boundary,
) {
  if (
    isPolygonFeature(boundary)
  ) {
    return boundary;
  }

  if (
    isFeatureCollection(boundary)
  ) {
    const polygonFeatures =
      boundary.features.filter(
        isPolygonFeature,
      );

    if (
      polygonFeatures.length === 0
    ) {
      return null;
    }

    if (
      polygonFeatures.length === 1
    ) {
      return polygonFeatures[0];
    }

    try {
      /*
       * Combina todas as geometrias territoriais em
       * uma única Feature Polygon ou MultiPolygon.
       */
      return turf.combine(
        turf.featureCollection(
          polygonFeatures,
        ),
      ).features[0];
    } catch (error) {
      console.warn(
        '[SpatialEngine] Não foi possível combinar as geometrias do limite:',
        error,
      );

      return polygonFeatures[0];
    }
  }

  return null;
}

/**
 * Verifica se uma feição pontual está dentro do limite.
 */
function pointFeatureIntersectsBoundary(
  feature,
  boundaryFeature,
) {
  if (
    feature.geometry.type ===
    'Point'
  ) {
    return turf.booleanPointInPolygon(
      feature,
      boundaryFeature,
      {
        ignoreBoundary: false,
      },
    );
  }

  if (
    feature.geometry.type ===
    'MultiPoint'
  ) {
    return feature.geometry.coordinates.some(
      (coordinates) => {
        try {
          return turf.booleanPointInPolygon(
            turf.point(
              coordinates,
            ),
            boundaryFeature,
            {
              ignoreBoundary:
                false,
            },
          );
        } catch {
          return false;
        }
      },
    );
  }

  return false;
}

/**
 * Verifica se uma feição intercepta o limite.
 */
function featureIntersectsBoundary(
  feature,
  boundaryFeature,
) {
  if (
    !isValidFeature(feature) ||
    !isPolygonFeature(
      boundaryFeature,
    )
  ) {
    return false;
  }

  try {
    if (isPointFeature(feature)) {
      return pointFeatureIntersectsBoundary(
        feature,
        boundaryFeature,
      );
    }

    return turf.booleanIntersects(
      feature,
      boundaryFeature,
    );
  } catch (error) {
    /*
     * Fallback por bounding box.
     *
     * Ele não substitui uma interseção geométrica precisa,
     * mas impede que uma feição válida seja descartada por
     * incompatibilidade pontual de alguma operação Turf.
     */
    try {
      const featureBbox =
        turf.bbox(feature);

      const boundaryBbox =
        turf.bbox(
          boundaryFeature,
        );

      return !(
        featureBbox[2] <
          boundaryBbox[0] ||
        featureBbox[0] >
          boundaryBbox[2] ||
        featureBbox[3] <
          boundaryBbox[1] ||
        featureBbox[1] >
          boundaryBbox[3]
      );
    } catch {
      console.warn(
        '[SpatialEngine] Não foi possível testar a interseção:',
        {
          featureId:
            feature?.id,

          geometryType:
            feature?.geometry
              ?.type,

          error,
        },
      );

      return false;
    }
  }
}

/**
 * Tenta recortar uma feição poligonal pelo limite.
 *
 * Se o Turf não conseguir processar a geometria, retorna
 * a feição original. Uma falha de recorte não deve provocar
 * perda dos dados.
 */
function clipPolygonFeature(
  feature,
  boundaryFeature,
) {
  if (
    !isPolygonFeature(feature) ||
    !isPolygonFeature(
      boundaryFeature,
    )
  ) {
    return feature;
  }

  try {
    const intersection =
      turf.intersect(
        turf.featureCollection([
          feature,
          boundaryFeature,
        ]),
      );

    if (!intersection) {
      return feature;
    }

    return {
      ...intersection,

      /*
       * Preserva o ID da fonte original.
       */
      id:
        feature.id ??
        intersection.id,

      properties: {
        ...feature.properties,

        _clipped:
          true,

        _original_geometry_type:
          feature.geometry.type,
      },
    };
  } catch (error) {
    console.warn(
      '[SpatialEngine] Não foi possível recortar a feição; a geometria original será preservada:',
      {
        featureId:
          feature?.id,

        geometryType:
          feature?.geometry
            ?.type,

        message:
          error?.message ||
          String(error),
      },
    );

    return feature;
  }
}

/**
 * Filtra uma FeatureCollection pelo limite territorial.
 *
 * Regras:
 * - feições externas são removidas;
 * - feições internas são mantidas;
 * - Polygon e MultiPolygon que cruzam o limite são
 *   recortados quando possível;
 * - se o recorte falhar, a feição original é mantida;
 * - uma falha isolada nunca descarta silenciosamente toda
 *   a coleção.
 */
export function filterByBoundary(
  geojson,
  boundary,
  {
    clipPolygons = true,
  } = {},
) {
  if (
    !isFeatureCollection(
      geojson,
    )
  ) {
    return {
      ...EMPTY_FEATURE_COLLECTION,
    };
  }

  const boundaryFeature =
    normalizeBoundaryFeature(
      boundary,
    );

  if (!boundaryFeature) {
    console.warn(
      '[SpatialEngine] Limite territorial inválido. A coleção original será preservada.',
    );

    return geojson;
  }

  const features = [];

  let invalidCount = 0;
  let outsideCount = 0;
  let clippedCount = 0;
  let preservedCount = 0;

  for (
    const feature
    of geojson.features
  ) {
    if (!isValidFeature(feature)) {
      invalidCount += 1;
      continue;
    }

    const intersects =
      featureIntersectsBoundary(
        feature,
        boundaryFeature,
      );

    if (!intersects) {
      outsideCount += 1;
      continue;
    }

    if (
      clipPolygons &&
      isPolygonFeature(feature)
    ) {
      const processedFeature =
        clipPolygonFeature(
          feature,
          boundaryFeature,
        );

      if (
        processedFeature
          ?.properties
          ?._clipped
      ) {
        clippedCount += 1;
      } else {
        preservedCount += 1;
      }

      features.push(
        processedFeature,
      );

      continue;
    }

    preservedCount += 1;

    features.push(feature);
  }

  console.info(
    '[SpatialEngine] Filtro territorial concluído:',
    {
      inputCount:
        geojson.features.length,

      outputCount:
        features.length,

      clippedCount,
      preservedCount,
      outsideCount,
      invalidCount,
    },
  );

  return {
    ...geojson,
    features,

    metadata: {
      ...(geojson.metadata ||
        {}),

      boundaryFiltered:
        true,

      inputFeatureCount:
        geojson.features.length,

      outputFeatureCount:
        features.length,

      clippedFeatureCount:
        clippedCount,

      outsideFeatureCount:
        outsideCount,

      invalidFeatureCount:
        invalidCount,

      filteredAt:
        Date.now(),
    },
  };
}

/**
 * Gera um ponto representativo confiável.
 */
export function representativePoint(
  feature,
) {
  if (!isValidFeature(feature)) {
    return null;
  }

  if (
    feature.geometry.type ===
    'Point'
  ) {
    return turf.clone(feature);
  }

  try {
    return turf.pointOnFeature(
      feature,
    );
  } catch {
    try {
      return turf.centerOfMass(
        feature,
      );
    } catch {
      try {
        return turf.centroid(
          feature,
        );
      } catch {
        return null;
      }
    }
  }
}

/**
 * Calcula a distância mínima aproximada entre duas feições.
 *
 * Retorno:
 * metros.
 */
export function distanceBetween(
  featureA,
  featureB,
) {
  if (
    !isValidFeature(featureA) ||
    !isValidFeature(featureB)
  ) {
    return Infinity;
  }

  try {
    if (
      turf.booleanIntersects(
        featureA,
        featureB,
      )
    ) {
      return 0;
    }
  } catch {
    // Continua para os fallbacks.
  }

  /*
   * Para polígonos, usa pontos representativos como
   * fallback consistente com a arquitetura atual.
   */
  const pointA =
    representativePoint(
      featureA,
    );

  const pointB =
    representativePoint(
      featureB,
    );

  if (!pointA || !pointB) {
    return Infinity;
  }

  try {
    return turf.distance(
      pointA,
      pointB,
      {
        units: 'meters',
      },
    );
  } catch {
    return Infinity;
  }
}

/**
 * Calcula a área de uma feição.
 *
 * Retorno:
 * quilômetros quadrados.
 */
export function computeArea(
  feature,
) {
  if (!isValidFeature(feature)) {
    return 0;
  }

  try {
    return (
      turf.area(feature) /
      1_000_000
    );
  } catch {
    return 0;
  }
}

/**
 * Encontra polígonos que contêm o ponto representativo
 * da feição informada.
 */
export function findContaining(
  feature,
  polygons,
) {
  const results = [];

  if (
    !isFeatureCollection(
      polygons,
    )
  ) {
    return results;
  }

  const point =
    representativePoint(
      feature,
    );

  if (!point) {
    return results;
  }

  for (
    const polygon
    of polygons.features
  ) {
    if (
      !isPolygonFeature(
        polygon,
      )
    ) {
      continue;
    }

    try {
      if (
        turf.booleanPointInPolygon(
          point,
          polygon,
          {
            ignoreBoundary:
              false,
          },
        )
      ) {
        results.push(
          polygon,
        );
      }
    } catch (error) {
      console.warn(
        '[SpatialEngine] Não foi possível verificar a contenção:',
        {
          polygonId:
            polygon?.id,

          geometryType:
            polygon?.geometry
              ?.type,

          message:
            error?.message ||
            String(error),
        },
      );
    }
  }

  return results;
}

/**
 * Encontra polígonos dentro de uma distância máxima.
 *
 * A distância informada é em quilômetros.
 * A distância retornada é em metros.
 */
export function findNearby(
  feature,
  polygons,
  maxDistanceKm,
) {
  const results = [];

  if (
    !isFeatureCollection(
      polygons,
    )
  ) {
    return results;
  }

  const numericDistance =
    Number(maxDistanceKm);

  if (
    !Number.isFinite(
      numericDistance,
    ) ||
    numericDistance < 0
  ) {
    return results;
  }

  const maxMeters =
    numericDistance *
    1000;

  for (
    const polygon
    of polygons.features
  ) {
    const distance =
      distanceBetween(
        feature,
        polygon,
      );

    if (
      Number.isFinite(
        distance,
      ) &&
      distance <= maxMeters
    ) {
      results.push({
        feature:
          polygon,

        distance,
      });
    }
  }

  return results.sort(
    (
      first,
      second,
    ) =>
      first.distance -
      second.distance,
  );
}

/**
 * Gera um buffer ao redor de uma feição.
 */
export function generateBuffer(
  feature,
  radiusKm,
) {
  if (!isValidFeature(feature)) {
    return null;
  }

  const numericRadius =
    Number(radiusKm);

  if (
    !Number.isFinite(
      numericRadius,
    ) ||
    numericRadius < 0
  ) {
    return null;
  }

  try {
    return turf.buffer(
      feature,
      numericRadius,
      {
        units:
          'kilometers',
      },
    );
  } catch (error) {
    console.error(
      '[SpatialEngine] Falha ao gerar buffer:',
      error,
    );

    return null;
  }
}

/**
 * Calcula o bounding box.
 */
export function computeBbox(
  geojson,
) {
  try {
    const bbox =
      turf.bbox(
        geojson,
      );

    if (
      !Array.isArray(bbox) ||
      bbox.length !== 4 ||
      bbox.some(
        (value) =>
          !Number.isFinite(
            value,
          ),
      )
    ) {
      throw new Error(
        'Bounding box inválido.',
      );
    }

    return bbox;
  } catch (error) {
    console.error(
      '[SpatialEngine] Falha ao calcular bounding box; usando valor aproximado do Ceará:',
      error,
    );

    return [
      -41.4215,
      -7.8575,
      -37.2532,
      -2.7845,
    ];
  }
}

/**
 * Simplifica uma geometria.
 */
export function simplifyGeometry(
  feature,
  tolerance = 0.005,
) {
  if (!isValidFeature(feature)) {
    return feature;
  }

  try {
    return turf.simplify(
      feature,
      {
        tolerance,
        highQuality:
          false,

        mutate:
          false,
      },
    );
  } catch (error) {
    console.error(
      '[SpatialEngine] Falha ao simplificar geometria:',
      error,
    );

    return feature;
  }
}