/**
 * MapView — componente React que renderiza o mapa MapLibre.
 * Atualiza as camadas via LayerManager (nunca chama map.addSource/addLayer diretamente).
 */
import { useEffect, useRef } from 'react';
import { createMap, changeBaseMap, fitToCeara } from '../map/MapController';
import { LayerManager } from '../layers/LayerManager';
import { EventBus, EVENTS } from '../core/EventBus';
import { AppCore } from '../core/AppCore';
import { FieldController } from '../field/FieldController';

export default function MapView({ baseMapId, onReady }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const baseMapRef = useRef(baseMapId);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = createMap(containerRef.current, {
      baseMapId: baseMapRef.current,
    });
    mapRef.current = map;

    map.on('load', () => {
      onReady?.(map);
      updateAllLayers();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Trocar mapa-base
  useEffect(() => {
    if (!mapRef.current || baseMapId === baseMapRef.current) return;
    baseMapRef.current = baseMapId;
    changeBaseMap(mapRef.current, baseMapId);
  }, [baseMapId]);

  // Atualizar camadas quando os dados mudarem
  useEffect(() => {
    const unsub1 = EventBus.on(EVENTS.LAYER_DATA_UPDATED, () => updateAllLayers());
    const unsub2 = EventBus.on(EVENTS.DATA_UPDATED, () => updateAllLayers());
    const unsub3 = EventBus.on(EVENTS.MAP_READY, () => updateAllLayers());
    return () => {
      unsub1?.();
      unsub2?.();
      unsub3?.();
    };
  }, []);

  // Atualizar posição do Modo Campo
  useEffect(() => {
    let unsub;
    const interval = setInterval(() => {
      if (FieldController.active && mapRef.current) {
        const pos = FieldController.getPositionGeoJSON();
        LayerManager.updateLayerData('field-position', pos);
        LayerManager.updateLayerData('field-trail', FieldController.getTrailGeoJSON());
        LayerManager.updateLayerData('field-points', FieldController.getPointsGeoJSON());

        const pt = FieldController.currentPosition;
        if (pt) {
          const [lng, lat] = pt.geometry.coordinates;
          mapRef.current.easeTo({ center: [lng, lat], zoom: Math.max(mapRef.current.getZoom(), 14) });
        }
      }
    }, 3000);

    unsub = EventBus.on(EVENTS.FIELD_MODE_STOPPED, () => {
      LayerManager.updateLayerData('field-position', { type: 'FeatureCollection', features: [] });
    });

    return () => {
      clearInterval(interval);
      unsub?.();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
}

function updateAllLayers() {
  const core = AppCore;
  const map = LayerManager._map;

  if (core.cearaBoundary) {
    LayerManager.updateLayerData('ceara-boundary', core.cearaBoundary);
  }
  if (core.municipalities) {
    LayerManager.updateLayerData('municipalities', core.municipalities);
  }
  if (core.conservationUnits) {
    LayerManager.updateLayerData('conservation-units', core.conservationUnits);
  }
  if (core.fireEvents) {
    LayerManager.updateLayerData('fire-events', core.fireEvents);
    LayerManager.updateLayerData('fire-events-markers', core.getFireEventMarkers());
  }
  if (core.fireFronts) {
    LayerManager.updateLayerData('fire-fronts', core.fireFronts);
  }

  // Garantir que o mapa redimensione após atualizações
  if (map) {
    try { map.resize(); } catch { /* skip */ }
  }

  // Enquadrar no Ceará se ainda não feito
  if (core.cearaBoundary && !core._fitted && map) {
    fitToCeara(map, core.cearaBoundary);
    core._fitted = true;
  }
}