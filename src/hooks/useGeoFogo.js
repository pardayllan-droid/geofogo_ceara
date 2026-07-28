/**
 * useGeoFogo — hook principal que integra AppCore + LayerManager + SyncEngine + FieldController
 * com a interface React.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppCore } from '../core/AppCore';
import { LayerManager } from '../layers/LayerManager';
import { LayerRegistry } from '../layers/LayerRegistry';
import { EventBus, EVENTS } from '../core/EventBus';
import { SyncEngine } from '../sync/SyncEngine';
import { FieldController } from '../field/FieldController';
import { ErrorManager } from '../core/ErrorManager';
import { config, saveUserOverrides } from '../core/config';
import { db } from '../storage/indexedDb';

export function useGeoFogo() {
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncState, setSyncState] = useState(SyncEngine.state);
  const [syncMessage, setSyncMessage] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [layers, setLayers] = useState([]);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [errors, setErrors] = useState([]);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [fieldState, setFieldState] = useState(FieldController.getState());
  const [baseMapId, setBaseMapId] = useState(config.defaultBaseMap);

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      await AppCore.initialize();
      await AppCore.loadCachedData();
      setReady(true);
      setLayers(LayerManager.getAllLayers());
      setStats(AppCore.getStats());
      setAlerts(AppCore.alerts || []);

      // Disparar sync inicial
      await handleSync();
    })();
  }, []);

  // Subscriptions
  useEffect(() => {
    const unsubs = [
      EventBus.on(EVENTS.SYNC_STARTED, () => {
        setSyncing(true);
        setSyncState('syncing');
      }),
      EventBus.on(EVENTS.SYNC_PROGRESS, ({ state, message }) => {
        setSyncState(state);
        if (message) setSyncMessage(message);
      }),
      EventBus.on(EVENTS.SYNC_COMPLETED, () => {
        setSyncing(false);
        setSyncState('success');
        setStats(AppCore.getStats());
        setAlerts(AppCore.alerts || []);
        setLayers([...LayerManager.getAllLayers()]);
      }),
      EventBus.on(EVENTS.SYNC_FAILED, () => {
        setSyncing(false);
        setSyncState(SyncEngine.state);
        setStats(AppCore.getStats());
        setAlerts(AppCore.alerts || []);
      }),
      EventBus.on(EVENTS.CONNECTION_CHANGED, ({ online: isOnline }) => {
        setOnline(isOnline);
      }),
      EventBus.on(EVENTS.LAYER_VISIBILITY_CHANGED, () => {
        setLayers([...LayerManager.getAllLayers()]);
      }),
      EventBus.on(EVENTS.LAYER_DATA_UPDATED, () => {
        setLayers([...LayerManager.getAllLayers()]);
        setStats(AppCore.getStats());
      }),
      EventBus.on(EVENTS.ALERTS_UPDATED, (a) => setAlerts(a)),
      EventBus.on(EVENTS.ERROR, (e) => {
        setErrors(ErrorManager.all());
      }),
      EventBus.on('layer:click', ({ feature, layerId }) => {
        setSelectedFeature({ feature, layerId });
      }),
    ];

    const fieldUnsub = FieldController.subscribe((state) => setFieldState(state));

    return () => {
      unsubs.forEach((u) => u && u());
      fieldUnsub();
    };
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    await AppCore.syncAll();
    setSyncing(false);
    setStats(AppCore.getStats());
    setAlerts(AppCore.alerts || []);
  }, []);

  const toggleLayer = useCallback((layerId, visible) => {
    LayerManager.setVisibility(layerId, visible);
    setLayers([...LayerManager.getAllLayers()]);
  }, []);

  const setLayerOpacity = useCallback((layerId, opacity) => {
    LayerManager.setOpacity(layerId, opacity);
  }, []);

  const setAlertDistance = useCallback(async (km) => {
    await saveUserOverrides(db, { alertDistanceKm: km });
    EventBus.emit(EVENTS.CONFIG_CHANGED, { alertDistanceKm: km });
    if (AppCore.fireEvents && AppCore.conservationUnits) {
      const { computeAlerts } = await import('../alerts/AlertEngine');
      AppCore.alerts = await computeAlerts(AppCore.fireEvents, AppCore.conservationUnits, km);
      setAlerts(AppCore.alerts);
      setStats(AppCore.getStats());
    }
  }, []);

  const changeBaseMap = useCallback((id) => {
    setBaseMapId(id);
  }, []);

  const startFieldMode = useCallback(async () => {
    await FieldController.start();
    setFieldState(FieldController.getState());
  }, []);

  const stopFieldMode = useCallback(() => {
    FieldController.stop();
    setFieldState(FieldController.getState());
  }, []);

  const toggleRecording = useCallback(() => {
    if (FieldController.recording) {
      FieldController.pauseRecording();
    } else {
      FieldController.startRecording();
    }
    setFieldState(FieldController.getState());
  }, []);

  const addFieldPoint = useCallback((label, observation) => {
    FieldController.addPoint(label, observation);
    setFieldState(FieldController.getState());
  }, []);

  const closePopup = useCallback(() => setSelectedFeature(null), []);

  return {
    ready,
    online,
    syncing,
    syncState,
    syncMessage,
    layers,
    stats,
    alerts,
    errors,
    selectedFeature,
    fieldState,
    baseMapId,
    layerGroups: LayerManager.getLayersByGroup(),
    baseMaps: LayerRegistry.getBaseMaps(),
    sync: handleSync,
    toggleLayer,
    setLayerOpacity,
    setAlertDistance,
    changeBaseMap,
    startFieldMode,
    stopFieldMode,
    toggleRecording,
    addFieldPoint,
    closePopup,
    config,
  };
}