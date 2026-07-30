/**
 * MapController
 *
 * Wrapper do MapLibre GL JS.
 *
 * Responsabilidades:
 * - criar a instância do mapa;
 * - gerenciar a troca de mapa-base;
 * - preservar posição e zoom;
 * - reconectar o LayerManager após troca de estilo;
 * - enquadrar o limite do Ceará.
 */

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import * as turf from '@turf/turf';

import { BASE_MAPS } from '../layers/LayerDefinitions';
import { LayerManager } from '../layers/LayerManager';
import { EventBus, EVENTS } from '../core/EventBus';
import { config } from '../core/config';

/**
 * Cria uma nova instância do mapa.
 */
export function createMap(container, options = {}) {
  if (!container) {
    throw new Error(
      'Não foi informado um elemento HTML para criar o mapa.',
    );
  }

  const requestedBaseMapId =
    options.baseMapId || config.defaultBaseMap;

  const baseMap =
    BASE_MAPS[requestedBaseMapId] ||
    BASE_MAPS.standard ||
    Object.values(BASE_MAPS)[0];

  if (!baseMap?.style) {
    throw new Error(
      `Mapa-base inválido: ${requestedBaseMapId}`,
    );
  }

  const map = new maplibregl.Map({
    container,
    style: baseMap.style,
    center: options.center || [-39.5, -5.2],
    zoom: options.zoom ?? 6,
    maxZoom: options.maxZoom ?? 18,
    minZoom: options.minZoom ?? 4,
    attributionControl: true,
  });

  map.addControl(
    new maplibregl.NavigationControl(),
    'top-right',
  );

  map.addControl(
    new maplibregl.ScaleControl({
      unit: 'metric',
    }),
    'bottom-left',
  );

  map.once('load', () => {
    LayerManager.setMap(map);

    EventBus.emit(EVENTS.MAP_READY, {
      map,
      baseMapId: requestedBaseMapId,
    });
  });

  return map;
}

/**
 * Troca o estilo do mapa-base.
 *
 * Quando map.setStyle() é executado, as sources e layers operacionais
 * são removidas pelo MapLibre. Por isso o LayerManager precisa ser
 * informado e os dados precisam ser reaplicados depois que o novo
 * estilo estiver carregado.
 */
export function changeBaseMap(
  map,
  baseMapId,
  options = {},
) {
  const baseMap = BASE_MAPS[baseMapId];

  if (!map) {
    console.warn(
      '[MapController] Não existe mapa para trocar o mapa-base.',
    );

    return false;
  }

  if (!baseMap?.style) {
    console.error(
      `[MapController] Mapa-base não encontrado: ${baseMapId}`,
    );

    return false;
  }

  const center = map.getCenter();
  const zoom = map.getZoom();
  const bearing = map.getBearing();
  const pitch = map.getPitch();

  /*
   * As sources continuarão preservadas na memória do LayerManager,
   * mas desaparecerão da instância MapLibre após setStyle().
   */
  LayerManager.prepareForStyleChange();

  const handleStyleReady = () => {
    try {
      LayerManager.setMap(map);

      const layersRestored =
        LayerManager.restoreAllLayers();

      if (!layersRestored) {
        console.warn(
          '[MapController] Algumas camadas podem não ter sido restauradas após a troca de estilo.',
        );
      }

      map.jumpTo({
        center,
        zoom,
        bearing,
        pitch,
      });

      map.resize();

      options.onStyleReady?.(map);

      EventBus.emit(EVENTS.MAP_READY, {
        map,
        baseMapId,
        styleChanged: true,
      });
    } catch (error) {
      console.error(
        '[MapController] Falha ao restaurar camadas após troca de estilo:',
        error,
      );
    }
  };

  /*
   * style.load é mais apropriado que o primeiro styledata,
   * porque styledata pode ocorrer antes de o estilo estar pronto para
   * receber todas as layers personalizadas.
   */
  map.once('style.load', handleStyleReady);

  try {
    map.setStyle(baseMap.style, {
      diff: false,
    });

    return true;
  } catch (error) {
    try {
      map.off('style.load', handleStyleReady);
    } catch {
      // Ignora se o listener já não estiver registrado.
    }

    console.error(
      '[MapController] Não foi possível trocar o mapa-base:',
      error,
    );

    return false;
  }
}

/**
 * Enquadra o mapa no limite do Ceará.
 */
export function fitToCeara(map, boundaryGeoJSON) {
  if (
    !map ||
    !boundaryGeoJSON ||
    !Array.isArray(boundaryGeoJSON.features) ||
    boundaryGeoJSON.features.length === 0
  ) {
    return false;
  }

  try {
    const bounds = turf.bbox(boundaryGeoJSON);

    if (
      !Array.isArray(bounds) ||
      bounds.length !== 4 ||
      bounds.some((value) => !Number.isFinite(value))
    ) {
      throw new Error('Bounding box inválida.');
    }

    map.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      {
        padding: 40,
        duration: 1000,
      },
    );

    return true;
  } catch (error) {
    console.error(
      '[MapController] Não foi possível enquadrar o Ceará:',
      error,
    );

    return false;
  }
}