/**
 * AppShell
 *
 * Layout principal do GeoFogo Ceará.
 *
 * - mapa em tela cheia;
 * - barra superior;
 * - painel lateral no desktop;
 * - painel inferior no mobile/tablet;
 * - painel de diagnóstico acessível sem DevTools.
 */

import { useState } from 'react';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Flame,
  Layers,
  Menu,
  Navigation,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

import MapView from '../../map/MapView';

import DiagnosticPanel from '../debug/DiagnosticPanel';
import FieldModePanel from '../field/FieldModePanel';
import AlertPanel from '../panels/AlertPanel';
import FeaturePopup from '../panels/FeaturePopup';
import LayerPanel from '../panels/LayerPanel';
import SettingsPanel from '../panels/SettingsPanel';
import StatsPanel from '../panels/StatsPanel';

const PANELS = [
  {
    id: 'layers',
    label: 'Camadas',
    icon: Layers,
  },
  {
    id: 'alerts',
    label: 'Alertas',
    icon: AlertTriangle,
  },
  {
    id: 'stats',
    label: 'Estatísticas',
    icon: BarChart3,
  },
  {
    id: 'field',
    label: 'Modo Campo',
    icon: Navigation,
  },
  {
    id: 'settings',
    label: 'Configurações',
    icon: Settings,
  },
  {
    id: 'diagnostic',
    label: 'Diagnóstico',
    shortLabel: 'Diagnóstico',
    icon: Activity,
  },
];

export default function AppShell({
  ready,
  online,
  syncing,
  syncState,
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
  const [activePanel, setActivePanel] =
    useState('stats');

  const [panelOpen, setPanelOpen] =
    useState(true);

  if (!ready) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <Flame className="mb-4 h-12 w-12 animate-pulse text-amber-500" />

        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />

        <p className="text-sm text-muted-foreground">
          Inicializando GeoFogo Ceará...
        </p>
      </div>
    );
  }

  const panelProps = {
    layers,
    layerGroups,
    stats,
    alerts,
    online,
    syncing,
    syncState,
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
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <header className="z-20 flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600">
            <Flame className="h-4 w-4 text-white" />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold leading-none">
              GeoFogo Ceará
            </h1>

            <p className="mt-0.5 truncate text-[10px] leading-none text-muted-foreground">
              Monitoramento de incêndios florestais
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center gap-1 rounded px-2 py-1 text-[10px]">
            {online ? (
              <Wifi className="h-3 w-3 text-green-500" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}

            <span className="hidden text-muted-foreground sm:inline">
              {online
                ? syncing
                  ? 'Sincronizando...'
                  : 'Online'
                : 'Offline'}
            </span>
          </div>

          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Sincronizar"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                syncing ? 'animate-spin' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() =>
              setPanelOpen((current) => !current)
            }
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            aria-label={
              panelOpen
                ? 'Fechar painel'
                : 'Abrir painel'
            }
          >
            {panelOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {syncMessage && syncing && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-1 text-center text-[11px] text-amber-700 dark:text-amber-300">
          {syncMessage}
        </div>
      )}

      {errors.length > 0 && !syncing && (
        <button
          type="button"
          onClick={() => {
            setActivePanel('diagnostic');
            setPanelOpen(true);
          }}
          className="border-b border-destructive/20 bg-destructive/10 px-3 py-1 text-center text-[11px] text-destructive"
        >
          {errors[errors.length - 1].message}
          {' — '}
          toque para abrir o diagnóstico
        </button>
      )}

      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <MapView baseMapId={baseMapId} />

          <div className="absolute left-3 top-3 z-10 hidden flex-col gap-1 md:flex">
            {PANELS.map((panel) => {
              const Icon = panel.icon;

              const active =
                activePanel === panel.id &&
                panelOpen;

              return (
                <button
                  type="button"
                  key={panel.id}
                  onClick={() => {
                    setActivePanel(panel.id);
                    setPanelOpen(true);
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg shadow-md transition-colors ${
                    active
                      ? 'bg-amber-500 text-white'
                      : 'bg-card text-muted-foreground hover:bg-accent'
                  }`}
                  title={panel.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>

        <aside
          className={`hidden w-80 flex-shrink-0 flex-col border-l border-border bg-card transition-transform md:flex ${
            panelOpen
              ? 'translate-x-0'
              : 'translate-x-full'
          }`}
        >
          {renderPanel(
            activePanel,
            panelProps,
          )}
        </aside>

        {panelOpen && (
          <div className="absolute bottom-0 left-0 right-0 z-20 flex max-h-[72vh] flex-col rounded-t-xl border-t border-border bg-card shadow-2xl md:hidden">
            <div className="grid grid-cols-6 border-b border-border px-1 py-1.5">
              {PANELS.map((panel) => {
                const Icon = panel.icon;

                return (
                  <button
                    type="button"
                    key={panel.id}
                    onClick={() =>
                      setActivePanel(panel.id)
                    }
                    className={`flex min-w-0 flex-col items-center gap-0.5 rounded px-1 py-1 ${
                      activePanel === panel.id
                        ? 'text-amber-500'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />

                    <span className="max-w-full truncate text-[8px]">
                      {panel.shortLabel ||
                        panel.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {renderPanel(
                activePanel,
                panelProps,
              )}
            </div>
          </div>
        )}
      </div>

      {selectedFeature && (
        <FeaturePopup
          selectedFeature={selectedFeature}
          onClose={closePopup}
        />
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
      return (
        <AlertPanel alerts={props.alerts} />
      );

    case 'stats':
      return (
        <StatsPanel
          stats={props.stats}
          online={props.online}
          syncing={props.syncing}
        />
      );

    case 'field':
      return (
        <FieldModePanel
          fieldState={props.fieldState}
          onStart={props.startFieldMode}
          onStop={props.stopFieldMode}
          onToggleRecord={
            props.toggleRecording
          }
          onAddPoint={props.addFieldPoint}
        />
      );

    case 'settings':
      return (
        <SettingsPanel
          alertDistanceKm={
            props.config.alertDistanceKm
          }
          onAlertDistance={
            props.setAlertDistance
          }
          baseMaps={props.baseMaps}
          baseMapId={props.baseMapId}
          onBaseMap={props.changeBaseMap}
        />
      );

    case 'diagnostic':
      return (
        <DiagnosticPanel
          onSync={props.sync}
          syncing={props.syncing}
          syncState={props.syncState}
        />
      );

    default:
      return null;
  }
}