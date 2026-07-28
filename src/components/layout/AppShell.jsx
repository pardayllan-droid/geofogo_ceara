/**
 * AppShell — layout principal do GeoFogo Ceará.
 * Mapa em tela cheia + barra de controle + painel lateral recolhível.
 * Desktop: painel lateral. Mobile: painel inferior.
 */
import { useState } from 'react';
import { Flame, Layers, AlertTriangle, BarChart3, Settings, Navigation, RefreshCw, Wifi, WifiOff, Menu, X } from 'lucide-react';
import MapView from '../../map/MapView';
import LayerPanel from '../panels/LayerPanel';
import AlertPanel from '../panels/AlertPanel';
import StatsPanel from '../panels/StatsPanel';
import SettingsPanel from '../panels/SettingsPanel';
import FieldModePanel from '../field/FieldModePanel';
import FeaturePopup from '../panels/FeaturePopup';

const PANELS = [
  { id: 'layers', label: 'Camadas', icon: Layers },
  { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
  { id: 'stats', label: 'Estatísticas', icon: BarChart3 },
  { id: 'field', label: 'Modo Campo', icon: Navigation },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export default function AppShell({
  ready,
  online,
  syncing,
  syncMessage,
  layers,
  layerGroups,
  stats,
  alerts,
  errors,
  selectedFeature,
  fieldState,
  baseMaps,
  baseMapId,
  config,
  sync,
  toggleLayer,
  setLayerOpacity,
  setAlertDistance,
  changeBaseMap,
  startFieldMode,
  stopFieldMode,
  toggleRecording,
  addFieldPoint,
  closePopup,
}) {
  const [activePanel, setActivePanel] = useState('stats');
  const [panelOpen, setPanelOpen] = useState(true);

  if (!ready) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <Flame className="w-12 h-12 text-amber-500 animate-pulse mb-4" />
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Inicializando GeoFogo Ceará...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Topbar */}
      <header className="flex items-center justify-between px-3 py-2 bg-card border-b border-border z-20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none">GeoFogo Ceará</h1>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
              Monitoramento de incêndios florestais
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 px-2 py-1 rounded text-[10px]">
            {online ? (
              <Wifi className="w-3 h-3 text-green-500" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-500" />
            )}
            <span className="hidden sm:inline text-muted-foreground">
              {online ? (syncing ? 'Sincronizando...' : 'Online') : 'Offline'}
            </span>
          </div>
          <button
            onClick={sync}
            disabled={syncing}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Sincronizar"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground md:hidden"
          >
            {panelOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Sync message bar */}
      {syncMessage && syncing && (
        <div className="px-3 py-1 bg-amber-500/10 text-amber-700 text-[11px] text-center border-b border-amber-500/20">
          {syncMessage}
        </div>
      )}

      {/* Error banner */}
      {errors.length > 0 && !syncing && (
        <div className="px-3 py-1 bg-destructive/10 text-destructive text-[11px] text-center border-b border-destructive/20">
          {errors[errors.length - 1].message}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <MapView baseMapId={baseMapId} />

          {/* Panel toggle tabs — desktop */}
          <div className="hidden md:flex absolute left-3 top-3 flex-col gap-1 z-10">
            {PANELS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActivePanel(p.id);
                  setPanelOpen(true);
                }}
                className={`flex items-center justify-center w-10 h-10 rounded-lg shadow-md transition-colors ${
                  activePanel === p.id && panelOpen
                    ? 'bg-amber-500 text-white'
                    : 'bg-card text-muted-foreground hover:bg-accent'
                }`}
                title={p.label}
              >
                <p.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar — desktop */}
        <aside
          className={`hidden md:flex flex-col w-80 bg-card border-l border-border flex-shrink-0 transition-transform ${
            panelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {renderPanel(activePanel, {
            layers,
            layerGroups,
            stats,
            alerts,
            online,
            syncing,
            baseMaps,
            baseMapId,
            config,
            fieldState,
            sync,
            toggleLayer,
            setLayerOpacity,
            setAlertDistance,
            changeBaseMap,
            startFieldMode,
            stopFieldMode,
            toggleRecording,
            addFieldPoint,
          })}
        </aside>

        {/* Bottom panel — mobile */}
        {panelOpen && (
          <div className="md:hidden absolute bottom-0 left-0 right-0 max-h-[55vh] bg-card border-t border-border rounded-t-xl shadow-2xl z-20 flex flex-col">
            <div className="flex items-center justify-around px-2 py-1.5 border-b border-border">
              {PANELS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePanel(p.id)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded ${
                    activePanel === p.id ? 'text-amber-500' : 'text-muted-foreground'
                  }`}
                >
                  <p.icon className="w-4 h-4" />
                  <span className="text-[9px]">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden max-h-[45vh]">
              {renderPanel(activePanel, {
                layers,
                layerGroups,
                stats,
                alerts,
                online,
                syncing,
                baseMaps,
                baseMapId,
                config,
                fieldState,
                sync,
                toggleLayer,
                setLayerOpacity,
                setAlertDistance,
                changeBaseMap,
                startFieldMode,
                stopFieldMode,
                toggleRecording,
                addFieldPoint,
              })}
            </div>
          </div>
        )}
      </div>

      {/* Feature popup */}
      {selectedFeature && (
        <FeaturePopup selectedFeature={selectedFeature} onClose={closePopup} />
      )}
    </div>
  );
}

function renderPanel(id, props) {
  switch (id) {
    case 'layers':
      return (
        <LayerPanel
          layerGroups={props.layerGroups}
          onToggle={props.toggleLayer}
          onOpacity={props.setLayerOpacity}
          onSync={props.sync}
        />
      );
    case 'alerts':
      return <AlertPanel alerts={props.alerts} />;
    case 'stats':
      return <StatsPanel stats={props.stats} online={props.online} syncing={props.syncing} />;
    case 'field':
      return (
        <FieldModePanel
          fieldState={props.fieldState}
          onStart={props.startFieldMode}
          onStop={props.stopFieldMode}
          onToggleRecord={props.toggleRecording}
          onAddPoint={props.addFieldPoint}
        />
      );
    case 'settings':
      return (
        <SettingsPanel
          alertDistanceKm={props.config.alertDistanceKm}
          onAlertDistance={props.setAlertDistance}
          baseMaps={props.baseMaps}
          baseMapId={props.baseMapId}
          onBaseMap={props.changeBaseMap}
        />
      );
    default:
      return null;
  }
}