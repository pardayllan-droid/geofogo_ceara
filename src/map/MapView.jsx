/**
 * MapView
 *
 * Componente React responsável por:
 * - criar e destruir o mapa MapLibre;
 * - atualizar as camadas quando os dados do AppCore mudarem;
 * - acompanhar o Modo Campo;
 * - trocar o mapa-base;
 * - enquadrar o limite do Ceará.
 *
 * A criação e atualização de sources/layers deve ocorrer exclusivamente
 * por meio do LayerManager.
 */

import { useCallback, useEffect, useRef } from 'react';

import {
  createMap,
  changeBaseMap as applyBaseMap,
  fitToCeara,
} from './MapController';

import { LayerManager } from '../layers/LayerManager';
import { EventBus, EVENTS } from '../core/EventBus';
import { AppCore } from '../core/AppCore';
import { FieldController } from '../field/FieldController';

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
};

export default function MapView({ baseMapId, onReady }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const baseMapRef = useRef(baseMapId);
  const mountedRef = useRef(false);

  /**
   * Envia os dados atuais do AppCore ao LayerManager.
   *
   * Esta função NÃO deve ser chamada em resposta a LAYER_DATA_UPDATED,
   * porque LayerManager.updateLayerData() emite esse mesmo evento.
   * Escutar o evento aqui criaria uma recursão infinita.
   */
  const updateAllLayers = useCallback(() => {
    const map = mapRef.current;

    if (!map || !LayerManager.isReady()) {
      return;
    }

    if (!map.isStyleLoaded()) {
      return;
    }

    try {
      if (AppCore.cearaBoundary) {
        LayerManager.updateLayerData(
          'ceara-boundary',
          AppCore.cearaBoundary,
        );
      }

      if (AppCore.municipalities) {
        LayerManager.updateLayerData(
          'municipalities',
          AppCore.municipalities,
        );
      }

      if (AppCore.conservationUnits) {
        LayerManager.updateLayerData(
          'conservation-units',
          AppCore.conservationUnits,
        );
      }

      if (AppCore.fireEvents) {
        LayerManager.updateLayerData(
          'fire-events',
          AppCore.fireEvents,
        );

        const markers = AppCore.getFireEventMarkers?.();

        if (markers) {
          LayerManager.updateLayerData(
            'fire-events-markers',
            markers,
          );
        }
      }

      if (AppCore.fireFronts) {
        LayerManager.updateLayerData(
          'fire-fronts',
          AppCore.fireFronts,
        );
      }

      try {
        map.resize();
      } catch (error) {
        console.warn('[MapView] Não foi possível redimensionar o mapa:', error);
      }

      if (
        AppCore.cearaBoundary &&
        !AppCore._fitted &&
        map.isStyleLoaded()
      ) {
        fitToCeara(map, AppCore.cearaBoundary);
        AppCore._fitted = true;
      }
    } catch (error) {
      console.error('[MapView] Falha ao atualizar camadas:', error);
    }
  }, []);

  /**
   * Criação e destruição do mapa.
   */
  useEffect(() => {
    mountedRef.current = true;

    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const map = createMap(containerRef.current, {
      baseMapId: baseMapRef.current,
    });

    mapRef.current = map;

    const handleMapLoad = () => {
      if (!mountedRef.current) {
        return;
      }

      onReady?.(map);

      /*
       * O MapController já conecta o mapa ao LayerManager antes de emitir
       * MAP_READY. Mesmo assim, verificamos a prontidão antes de atualizar.
       */
      requestAnimationFrame(() => {
        if (mountedRef.current) {
          updateAllLayers();
        }
      });
    };

    const handleMapError = (event) => {
      const error = event?.error || event;

      console.error('[MapView] Erro do MapLibre:', error);
    };

    map.on('load', handleMapLoad);
    map.on('error', handleMapError);

    return () => {
      mountedRef.current = false;

      try {
        map.off('load', handleMapLoad);
        map.off('error', handleMapError);
      } catch {
        // O mapa pode já ter sido destruído.
      }

      LayerManager.clearMap(map);

      try {
        map.remove();
      } catch (error) {
        console.warn('[MapView] Falha ao remover o mapa:', error);
      }

      mapRef.current = null;
    };
  }, [onReady, updateAllLayers]);

  /**
   * Troca do mapa-base.
   */
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !baseMapId || baseMapId === baseMapRef.current) {
      return;
    }

    baseMapRef.current = baseMapId;

    applyBaseMap(map, baseMapId, {
      onStyleReady: updateAllLayers,
    });
  }, [baseMapId, updateAllLayers]);

  /**
   * Atualiza as camadas quando os dados do núcleo mudarem.
   *
   * Não escutamos LAYER_DATA_UPDATED aqui.
   */
  useEffect(() => {
    const unsubscribeData = EventBus.on(
      EVENTS.DATA_UPDATED,
      updateAllLayers,
    );

    const unsubscribeSyncCompleted = EventBus.on(
      EVENTS.SYNC_COMPLETED,
      updateAllLayers,
    );

    return () => {
      unsubscribeData?.();
      unsubscribeSyncCompleted?.();
    };
  }, [updateAllLayers]);

  /**
   * Atualização periódica do Modo Campo.
   */
  useEffect(() => {
    const updateFieldLayers = () => {
      const map = mapRef.current;

      if (
        !FieldController.active ||
        !map ||
        !LayerManager.isReady() ||
        !map.isStyleLoaded()
      ) {
        return;
      }

      try {
        LayerManager.updateLayerData(
          'field-position',
          FieldController.getPositionGeoJSON?.() ||
            EMPTY_FEATURE_COLLECTION,
        );

        LayerManager.updateLayerData(
          'field-trail',
          FieldController.getTrailGeoJSON?.() ||
            EMPTY_FEATURE_COLLECTION,
        );

        LayerManager.updateLayerData(
          'field-points',
          FieldController.getPointsGeoJSON?.() ||
            EMPTY_FEATURE_COLLECTION,
        );

        const currentPosition = FieldController.currentPosition;

        if (currentPosition?.geometry?.coordinates) {
          const [longitude, latitude] =
            currentPosition.geometry.coordinates;

          map.easeTo({
            center: [longitude, latitude],
            zoom: Math.max(map.getZoom(), 14),
          });
        }
      } catch (error) {
        console.error(
          '[MapView] Falha ao atualizar o Modo Campo:',
          error,
        );
      }
    };

    const intervalId = window.setInterval(
      updateFieldLayers,
      3000,
    );

    const unsubscribeStopped = EventBus.on(
      EVENTS.FIELD_MODE_STOPPED,
      () => {
        LayerManager.updateLayerData(
          'field-position',
          EMPTY_FEATURE_COLLECTION,
        );

        LayerManager.updateLayerData(
          'field-trail',
          EMPTY_FEATURE_COLLECTION,
        );

        LayerManager.updateLayerData(
          'field-points',
          EMPTY_FEATURE_COLLECTION,
        );
      },
    );

    return () => {
      window.clearInterval(intervalId);
      unsubscribeStopped?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      data-testid="geofogo-map"
    />
  );
}