/**
 * SpatialEngine — operações geográficas com Turf.js.
 *
 * Responsabilidades:
 * - Validar GeoJSON
 * - Calcular interseções e distâncias entre geometrias
 * - Recortar geometrias pelo limite estadual
 * - Calcular áreas
 * - Gerar buffers
 * - Identificar municípios e UCs
 * - Gerar pontos representativos (pointOnFeature / centerOfMass / centroid)
 * - Filtrar dados pelo polígono real do Ceará
 *
 * Operações pesadas devem ir para Web Worker (preparado, mas não obrigatório agora).
 */
import * as turf from '@turf/turf';

export function isValidFeature(feature) {
  if (!feature || !feature.type) return false;
  if (feature.type === 'Feature') {
    return feature.geometry?.type && feature.geometry?.coordinates != null;
  }
  return false;
}

export function filterByBoundary(geojson, boundaryFeature) {
  if (!boundaryFeature || !geojson?.features) {
    return { type: 'FeatureCollection', features: [] };
  }

  const kept = [];
  const clipped = [];

  for (const feature of geojson.features) {
    if (!isValidFeature(feature)) continue;
    try {
      const intersects = turf.booleanIntersects(feature, boundaryFeature);
      if (intersects) {
        const isWithin = turf.booleanWithin(feature, boundaryFeature);
        if (isWithin) {
          kept.push(feature);
        } else {
          try {
            const intersection = turf.intersect(turf.featureCollection([feature, boundaryFeature]));
            if (intersection) {
              clipped.push({
                ...intersection,
                properties: { ...feature.properties, _clipped: true },
              });
            } else {
              kept.push(feature);
            }
          } catch {
            kept.push(feature);
          }
        }
      }
    } catch (err) {
      console.warn('[SpatialEngine] feature skip', err);
    }
  }

  return { type: 'FeatureCollection', features: [...kept, ...clipped] };
}

export function distanceBetween(featureA, featureB) {
  try {
    if (turf.booleanIntersects(featureA, featureB)) return 0;
    return turf.distance(featureA, featureB, { units: 'meters' });
  } catch {
    try {
      const ca = turf.centerOfMass(featureA);
      const cb = turf.centerOfMass(featureB);
      return turf.distance(ca, cb, { units: 'meters' });
    } catch {
      return Infinity;
    }
  }
}

export function computeArea(feature) {
  try {
    return turf.area(feature) / 1_000_000; // m² → km²
  } catch {
    return 0;
  }
}

export function representativePoint(feature) {
  try {
    return turf.pointOnFeature(feature);
  } catch {
    try {
      return turf.centerOfMass(feature);
    } catch {
      return turf.centroid(feature);
    }
  }
}

export function findContaining(feature, polygons) {
  const results = [];
  if (!polygons?.features) return results;
  for (const poly of polygons.features) {
    try {
      const pt = representativePoint(feature);
      if (turf.booleanPointInPolygon(pt, poly)) {
        results.push(poly);
      }
    } catch (err) {
      console.error('[SpatialEngine] findContaining skip:', err);
    }
  }
  return results;
}

export function findNearby(feature, polygons, maxDistanceKm) {
  const results = [];
  if (!polygons?.features) return results;
  const maxMeters = maxDistanceKm * 1000;
  for (const poly of polygons.features) {
    const dist = distanceBetween(feature, poly);
    if (dist <= maxMeters) {
      results.push({ feature: poly, distance: dist });
    }
  }
  return results.sort((a, b) => a.distance - b.distance);
}

export function generateBuffer(feature, radiusKm) {
  try {
    return turf.buffer(feature, radiusKm, { units: 'kilometers' });
  } catch (err) {
    console.error('[SpatialEngine] generateBuffer falhou:', err);
    return null;
  }
}

export function computeBbox(geojson) {
  try {
    return turf.bbox(geojson);
  } catch (err) {
    console.error('[SpatialEngine] computeBbox falhou, usando fallback:', err);
    return [-41.4, -7.8, -37.2, -2.8]; // fallback aproximado do Ceará
  }
}

export function simplifyGeometry(feature, tolerance = 0.005) {
  try {
    return turf.simplify(feature, { tolerance, highQuality: false });
  } catch (err) {
    console.error('[SpatialEngine] simplifyGeometry falhou:', err);
    return feature;
  }
}