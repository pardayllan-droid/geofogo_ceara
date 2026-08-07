/**
 * GeoFogo — página principal do GeoFogo Ceará.
 * Conecta o hook useGeoFogo ao AppShell.
 */
import { useGeoFogo } from '../hooks/useGeoFogo';
import AppShell from '../components/layout/AppShell';

export default function GeoFogo() {
  const geo = useGeoFogo();

  return (
    <AppShell
      ready={geo.ready}
      online={geo.online}
      syncing={geo.syncing}
      syncState={geo.syncState}
      syncMessage={geo.syncMessage}
      layers={geo.layers}
      layerGroups={geo.layerGroups}
      stats={geo.stats}
      alerts={geo.alerts}
      errors={geo.errors}
      selectedFeature={geo.selectedFeature}
      fieldState={geo.fieldState}
      baseMaps={geo.baseMaps}
      baseMapId={geo.baseMapId}
      config={geo.config}
      sync={geo.sync}
      toggleLayer={geo.toggleLayer}
      setLayerOpacity={geo.setLayerOpacity}
      setAlertDistance={geo.setAlertDistance}
      changeBaseMap={geo.changeBaseMap}
      startFieldMode={geo.startFieldMode}
      stopFieldMode={geo.stopFieldMode}
      toggleRecording={geo.toggleRecording}
      finishFieldTrail={geo.finishFieldTrail}
      addFieldPoint={geo.addFieldPoint}
      addFieldPointAtCoordinates={geo.addFieldPointAtCoordinates}
      getFieldMissionRecords={geo.getFieldMissionRecords}
      toggleFieldTrailVisibility={geo.toggleFieldTrailVisibility}
      toggleFieldPointVisibility={geo.toggleFieldPointVisibility}
      missionState={geo.missionState}
      createFieldMission={geo.createFieldMission}
      setActiveFieldMission={geo.setActiveFieldMission}
      toggleFieldMissionVisibility={geo.toggleFieldMissionVisibility}
      deleteFieldMission={geo.deleteFieldMission}
      closePopup={geo.closePopup}
    />
  );
}