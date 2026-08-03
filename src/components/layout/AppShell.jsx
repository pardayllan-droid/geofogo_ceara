/**
 * AppShell
 *
 * Layout principal responsivo do GeoFogo Ceará.
 *
 * Desktop:
 * - mapa em tela cheia;
 * - navegação lateral;
 * - painel lateral recolhível;
 * - aba discreta para reabrir o painel;
 * - conteúdo dos painéis possui rolagem independente.
 *
 * Celular e tablet:
 * - navegação fixa na parte inferior;
 * - painéis apresentados como gaveta inferior;
 * - conteúdo com rolagem vertical;
 * - diagnóstico abre como os demais painéis.
 */

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Layers,
  Navigation,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

import MapView from '../../map/MapView';

import DiagnosticDashboard from '../debug/DiagnosticDashboard';
import FieldModePanel from '../field/FieldModePanel';
import AlertPanel from '../panels/AlertPanel';
import FeaturePopup from '../panels/FeaturePopup';
import LayerPanel from '../panels/LayerPanel';
import SettingsPanel from '../panels/SettingsPanel';
import StatsPanel from '../panels/StatsPanel';

const PANELS = [
  {
    id: 'stats',
    label: 'Resumo',
    icon: BarChart3,
  },
  {
    id: 'alerts',
    label: 'Alertas',
    icon: AlertTriangle,
  },
  {
    id: 'layers',
    label: 'Camadas',
    icon: Layers,
  },
  {
    id: 'field',
    label: 'Campo',
    fullLabel: 'Modo Campo',
    icon: Navigation,
  },
  {
    id: 'settings',
    label: 'Ajustes',
    fullLabel: 'Configurações',
    icon: Settings,
  },
  {
    id: 'diagnostic',
    label: 'Diagnóstico',
    icon: Activity,
  },
];

const DESKTOP_RESIZE_DELAY_MS = 230;

/**
 * Configuração da gaveta móvel.
 *
 * A gaveta fecha quando:
 * - o deslocamento ultrapassa 80 px; ou
 * - o usuário faz um movimento rápido para baixo.
 */
const MOBILE_SHEET_CLOSE_DISTANCE_PX =
  80;

const MOBILE_SHEET_FAST_SWIPE_DISTANCE_PX =
  28;

const MOBILE_SHEET_CLOSE_VELOCITY_PX_MS =
  0.6;

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
  finishFieldTrail,
  addFieldPoint,
  closePopup,
}) {
  const [activePanel, setActivePanel] =
    useState('stats');

  const [
    desktopPanelOpen,
    setDesktopPanelOpen,
  ] = useState(true);

  const [
    mobilePanelOpen,
    setMobilePanelOpen,
  ] = useState(false);

  const [
  showSyncSuccess,
  setShowSyncSuccess,
  ] = useState(false);

  const [
    startupAlertVisible,
    setStartupAlertVisible,
  ] = useState(false);

  const startupAlertEvaluatedRef =
    useRef(false);

  const previousSyncingRef =
    useRef(syncing);

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          window.dispatchEvent(
            new Event('resize'),
          );
        },
        DESKTOP_RESIZE_DELAY_MS,
      );

    return () => {
      window.clearTimeout(timer);
    };
  }, [desktopPanelOpen]);

  /**
   * Mostra uma confirmação temporária quando uma
   * sincronização termina com sucesso.
   */
  useEffect(
    () => {
      const wasSyncing =
        previousSyncingRef.current;

      previousSyncingRef.current =
        syncing;

      if (
        !wasSyncing ||
        syncing ||
        syncState !==
          'success'
      ) {
        return undefined;
      }

      setShowSyncSuccess(
        true,
      );

      const timer =
        window.setTimeout(
          () => {
            setShowSyncSuccess(
              false,
            );
          },
          3000,
        );

      return () => {
        window.clearTimeout(
          timer,
        );
      };
    },
    [
      syncing,
      syncState,
    ],
  );

  /**
   * Exibe um aviso uma única vez por abertura da aplicação
   * quando existirem alertas ativos.
   *
   * Aguarda o término da sincronização inicial para evitar
   * mostrar uma contagem antiga e logo em seguida alterá-la.
   */
  useEffect(
    () => {
      if (
        !ready ||
        syncing ||
        startupAlertEvaluatedRef.current
      ) {
        return;
      }

      startupAlertEvaluatedRef.current =
        true;

      const activeAlerts =
        Number(
          stats?.alertsCount,
        ) ||
        0;

      if (
        activeAlerts >
        0
      ) {
        setStartupAlertVisible(
          true,
        );
      }
    },
    [
      ready,
      syncing,
      stats?.alertsCount,
    ],
  );
  
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
    syncMessage,
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
    finishFieldTrail,
    addFieldPoint,
    openAlertsPanel,
  };

  function openDesktopPanel(
    panelId,
  ) {
    setActivePanel(panelId);
    setDesktopPanelOpen(true);
  }

  function toggleMobilePanel(
    panelId,
  ) {
    if (
      activePanel === panelId &&
      mobilePanelOpen
    ) {
      setMobilePanelOpen(false);
      return;
    }

    setActivePanel(panelId);
    setMobilePanelOpen(true);
  }

  function openDiagnosticPanel() {
    setActivePanel('diagnostic');
    setDesktopPanelOpen(true);
    setMobilePanelOpen(true);
  }

  function openAlertsPanel() {
    setActivePanel(
      'alerts',
    );

    /**
     * No desktop, abre o painel lateral.
     * No celular/tablet, mantém a gaveta aberta.
     */
    setDesktopPanelOpen(
      true,
    );

    setMobilePanelOpen(
      true,
    );
  }

  return (
    <div className="geofogo-app-shell fixed inset-0 flex flex-col overflow-hidden bg-background">
      <header className="relative z-40 flex flex-shrink-0 items-center justify-between border-b border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600 shadow-sm">
            <Flame className="h-4 w-4 text-white" />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold leading-none">
              GeoFogo Ceará
            </h1>

            <p className="mt-1 hidden truncate text-[10px] leading-none text-muted-foreground min-[400px]:block">
              Monitoramento de incêndios florestais
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px]">
            {online ? (
              <Wifi className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-red-500" />
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
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title="Sincronizar dados"
            aria-label="Sincronizar dados"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                syncing
                  ? 'animate-spin'
                  : ''
              }`}
            />
          </button>
        </div>
      </header>

      {syncing && (
        <div className="relative z-40 flex-shrink-0 overflow-hidden border-b border-amber-500/20 bg-amber-500/10">
          <div className="flex min-h-8 items-center justify-center gap-2 px-3 py-1.5 text-center text-[11px] text-amber-700 dark:text-amber-300">
            <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />

            <span className="truncate">
              {syncMessage ||
                'Atualizando dados...'}
            </span>
          </div>

          <div className="h-0.5 w-full overflow-hidden bg-amber-500/15">
            <div className="geofogo-sync-progress h-full w-1/3 bg-amber-500" />
          </div>
        </div>
      )}

      {showSyncSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="relative z-40 flex min-h-8 flex-shrink-0 items-center justify-center gap-2 border-b border-green-500/20 bg-green-500/10 px-3 py-1.5 text-center text-[11px] text-green-700 dark:text-green-300"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
            ✓
          </span>

          Dados atualizados com sucesso
        </div>
      )}

      {errors.length > 0 && !syncing && (
        <button
          type="button"
          onClick={openDiagnosticPanel}
          className="relative z-40 flex-shrink-0 border-b border-destructive/20 bg-destructive/10 px-3 py-1.5 text-center text-[11px] text-destructive transition-colors hover:bg-destructive/15"
        >
          {errors[errors.length - 1].message}
          {' — '}
          toque para abrir o diagnóstico
        </button>
      )}

      {startupAlertVisible &&
        Number(
          stats?.alertsCount,
        ) > 0 && (
          <div
            role="alert"
            aria-live="assertive"
            className="
              relative z-40
              flex flex-shrink-0
              items-start gap-3
              border-b border-red-500/30
              bg-red-500/10
              px-3 py-2.5
              text-red-800
              dark:text-red-200
            "
          >
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">
                {stats.alertsCount}{' '}
                {stats.alertsCount === 1
                  ? 'alerta ativo'
                  : 'alertas ativos'}
              </p>

              <p className="mt-0.5 text-[10px] text-red-700/80 dark:text-red-200/80">
                Existem eventos próximos ou dentro de Áreas Sensíveis.
              </p>

              <button
                type="button"
                onClick={() => {
                  setStartupAlertVisible(
                    false,
                  );

                  openAlertsPanel();
                }}
                className="
                  mt-1.5
                  rounded-md
                  bg-red-600
                  px-2.5 py-1
                  text-[10px] font-semibold
                  text-white
                  transition-colors
                  hover:bg-red-700
                "
              >
                Ver alertas
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                setStartupAlertVisible(
                  false,
                )
              }
              aria-label="Fechar aviso de alertas"
              title="Fechar aviso"
              className="
                flex h-7 w-7
                flex-shrink-0
                items-center justify-center
                rounded-md
                text-red-700
                transition-colors
                hover:bg-red-500/15
                dark:text-red-200
              "
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main className="geofogo-map-region relative min-w-0 flex-1">
          <MapView
            baseMapId={baseMapId}
          />

          <DesktopNavigation
            activePanel={
              activePanel
            }
            panelOpen={
              desktopPanelOpen
            }
            alertsCount={
              Number(
                stats?.alertsCount,
              ) ||
              0
            }
            onSelect={
              openDesktopPanel
            }
          />

          {!desktopPanelOpen && (
            <button
              type="button"
              onClick={() =>
                setDesktopPanelOpen(
                  true,
                )
              }
              className="absolute right-0 top-1/2 z-20 hidden h-16 w-8 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-border bg-card/95 text-muted-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent hover:text-foreground lg:flex"
              title="Abrir painel lateral"
              aria-label="Abrir painel lateral"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          <MobilePanel
            open={mobilePanelOpen}
            activePanel={
              activePanel
            }
            panelProps={
              panelProps
            }
            onClose={() =>
              setMobilePanelOpen(
                false,
              )
            }
          />
        </main>

        <DesktopPanel
          open={desktopPanelOpen}
          activePanel={
            activePanel
          }
          panelProps={
            panelProps
          }
          onClose={() =>
            setDesktopPanelOpen(
              false,
            )
          }
        />

        <BottomNavigation
          activePanel={
            activePanel
          }
          panelOpen={
            mobilePanelOpen
          }
          alertsCount={
            Number(
              stats?.alertsCount,
            ) ||
            0
          }
          onSelect={
            toggleMobilePanel
          }
        />
      </div>

      {selectedFeature && (
        <FeaturePopup
          selectedFeature={
            selectedFeature
          }
          onClose={closePopup}
        />
      )}
    </div>
  );
}

function DesktopNavigation({
  activePanel,
  panelOpen,
  alertsCount,
  onSelect,
}) {
  return (
    <nav
      className="absolute left-3 top-3 z-20 hidden flex-col gap-1.5 lg:flex"
      aria-label="Navegação dos painéis"
    >
      {PANELS.map((panel) => {
        const Icon =
          panel.icon;

        const active =
          activePanel ===
            panel.id &&
          panelOpen;

        return (
          <button
            type="button"
            key={panel.id}
            onClick={() =>
              onSelect(
                panel.id,
              )
            }
            className={`flex h-10 w-10 items-center justify-center rounded-lg border shadow-md backdrop-blur transition-all ${
              active
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-border bg-card/95 text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
            title={
              panel.fullLabel ||
              panel.label
            }
            aria-label={
              panel.fullLabel ||
              panel.label
            }
            aria-pressed={active}
          >
            <div className="relative">
              <Icon className="h-4 w-4" />

              {panel.id ===
                'alerts' &&
                alertsCount > 0 && (
                  <span
                    className="
                      absolute -right-2.5 -top-2.5
                      flex min-h-4 min-w-4
                      items-center justify-center
                      rounded-full
                      bg-red-600
                      px-1
                      text-[8px] font-bold
                      leading-none text-white
                      ring-2 ring-card
                    "
                    aria-label={`${alertsCount} alertas ativos`}
                  >
                    {alertsCount > 99
                      ? '99+'
                      : alertsCount}
                  </span>
                )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}

function DesktopPanel({
  open,
  activePanel,
  panelProps,
  onClose,
}) {
  return (
    <aside
      className={`relative z-30 hidden flex-shrink-0 overflow-visible bg-card transition-all duration-200 ease-out lg:flex ${
        open
          ? 'w-80 border-l border-border'
          : 'w-0 border-l-0'
      }`}
      aria-hidden={!open}
    >
      <div className="relative flex h-full w-80 min-w-80 flex-col overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute -left-4 top-1/2 z-40 flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-border bg-card text-muted-foreground shadow-md transition-colors hover:bg-accent hover:text-foreground"
          title="Recolher painel"
          aria-label="Recolher painel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="touch-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {renderPanel(
            activePanel,
            panelProps,
          )}
        </div>
      </div>
    </aside>
  );
}

/**
 * Gaveta inferior utilizada por todos os painéis em
 * celulares e tablets.
 *
 * O gesto de fechamento só pode começar no cabeçalho.
 * Isso evita conflito com:
 * - rolagem das listas;
 * - botões dos painéis;
 * - controles de camadas;
 * - conteúdo do diagnóstico.
 */
function MobilePanel({
  open,
  activePanel,
  panelProps,
  onClose,
}) {
  const [
    dragOffset,
    setDragOffset,
  ] = useState(
    0,
  );

  const [
    dragging,
    setDragging,
  ] = useState(
    false,
  );

  const dragStateRef =
    useRef({
      pointerId:
        null,

      startY:
        0,

      currentY:
        0,

      startedAt:
        0,

      moved:
        false,
    });

  /**
   * Sempre que a gaveta for fechada externamente,
   * elimina qualquer deslocamento restante.
   */
  useEffect(
    () => {
      if (!open) {
        setDragOffset(
          0,
        );

        setDragging(
          false,
        );

        dragStateRef.current = {
          pointerId:
            null,

          startY:
            0,

          currentY:
            0,

          startedAt:
            0,

          moved:
            false,
        };
      }
    },
    [
      open,
    ],
  );

  function resetDrag() {
    setDragging(
      false,
    );

    setDragOffset(
      0,
    );

    dragStateRef.current = {
      pointerId:
        null,

      startY:
        0,

      currentY:
        0,

      startedAt:
        0,

      moved:
        false,
    };
  }

  function handleDragStart(
    event,
  ) {
    if (
      !open ||
      event.button !==
        undefined &&
      event.button !==
        0
    ) {
      return;
    }

    /**
     * Não inicia um novo gesto quando o toque começou
     * no botão lateral de fechar.
     */
    if (
      event.target.closest(
        '[data-mobile-sheet-close-button]',
      )
    ) {
      return;
    }

    const pointerId =
      event.pointerId;

    dragStateRef.current = {
      pointerId,

      startY:
        event.clientY,

      currentY:
        event.clientY,

      startedAt:
        performance.now(),

      moved:
        false,
    };

    setDragging(
      true,
    );

    try {
      event.currentTarget
        .setPointerCapture(
          pointerId,
        );
    } catch {
      /**
       * Alguns navegadores podem não permitir captura,
       * mas o gesto ainda pode funcionar normalmente.
       */
    }
  }

  function handleDragMove(
    event,
  ) {
    const dragState =
      dragStateRef.current;

    if (
      !dragging ||
      dragState.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const difference =
      event.clientY -
      dragState.startY;

    /**
     * A gaveta só acompanha movimentos para baixo.
     * Movimentos para cima são ignorados.
     */
    const nextOffset =
      Math.max(
        0,
        difference,
      );

    dragState.currentY =
      event.clientY;

    if (
      nextOffset >
      4
    ) {
      dragState.moved =
        true;
    }

    setDragOffset(
      nextOffset,
    );
  }

  function finishDrag(
    event,
  ) {
    const dragState =
      dragStateRef.current;

    if (
      dragState.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const endedAt =
      performance.now();

    const elapsedMs =
      Math.max(
        1,
        endedAt -
          dragState.startedAt,
      );

    const distance =
      Math.max(
        0,
        dragState.currentY -
          dragState.startY,
      );

    const velocity =
      distance /
      elapsedMs;

    const crossedDistance =
      distance >=
      MOBILE_SHEET_CLOSE_DISTANCE_PX;

    const wasFastSwipe =
      distance >=
        MOBILE_SHEET_FAST_SWIPE_DISTANCE_PX &&
      velocity >=
        MOBILE_SHEET_CLOSE_VELOCITY_PX_MS;

    try {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId,
        );
    } catch {
      /**
       * A captura pode já ter sido liberada pelo navegador.
       */
    }

    setDragging(
      false,
    );

    if (
      crossedDistance ||
      wasFastSwipe
    ) {
      /**
       * Mantém brevemente o deslocamento atual para que
       * a animação de fechamento continue desse ponto.
       */
      setDragOffset(
        distance,
      );

      onClose();

      return;
    }

    /**
     * Se o limite não foi alcançado, a gaveta retorna
     * suavemente para a posição original.
     */
    setDragOffset(
      0,
    );

    dragStateRef.current = {
      pointerId:
        null,

      startY:
        0,

      currentY:
        0,

      startedAt:
        0,

      moved:
        false,
    };
  }

  function handleDragCancel(
    event,
  ) {
    try {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId,
        );
    } catch {
      /**
       * Nenhuma ação adicional é necessária.
       */
    }

    resetDrag();
  }

  /**
   * Durante o arraste, o transform inline substitui
   * temporariamente a transformação das classes Tailwind.
   *
   * Quando a gaveta está fechada, nenhuma transformação
   * inline é aplicada e a classe translate-y assume.
   */
  const sheetStyle =
    open
      ? {
          transform:
            `translateY(${dragOffset}px)`,

          transition:
            dragging
              ? 'none'
              : undefined,
        }
      : undefined;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar painel"
        onClick={
          onClose
        }
        className={`geofogo-mobile-backdrop absolute inset-0 z-20 bg-black/25 transition-opacity duration-200 lg:hidden ${
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      />

      <section
        className={`geofogo-mobile-sheet absolute left-0 right-0 z-30 flex max-h-[72%] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border bg-card shadow-2xl transition-transform duration-200 ease-out lg:hidden ${
          open
            ? 'translate-y-0'
            : 'translate-y-[calc(100%+1rem)]'
        }`}
        style={
          sheetStyle
        }
        aria-hidden={
          !open
        }
      >
        {/*
         * Área exclusiva de arraste.
         *
         * touchAction none impede que o navegador interprete
         * este gesto como rolagem da página. O conteúdo abaixo
         * continua rolando normalmente.
         */}
        <div
          className={`relative flex h-8 flex-shrink-0 select-none items-center justify-center border-b border-border/60 ${
            dragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
          }`}
          style={{
            touchAction:
              'none',
          }}
          onPointerDown={
            handleDragStart
          }
          onPointerMove={
            handleDragMove
          }
          onPointerUp={
            finishDrag
          }
          onPointerCancel={
            handleDragCancel
          }
          onLostPointerCapture={
            (
              event,
            ) => {
              const dragState =
                dragStateRef.current;

              if (
                dragging &&
                dragState.pointerId ===
                  event.pointerId
              ) {
                resetDrag();
              }
            }
          }
          role="presentation"
        >
          <span
            className={`h-1 rounded-full bg-muted-foreground/30 transition-[width,opacity] duration-150 ${
              dragging
                ? 'w-14 opacity-80'
                : 'w-10 opacity-100'
            }`}
          />

          <button
            type="button"
            data-mobile-sheet-close-button
            onClick={
              onClose
            }
            className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Recolher painel"
            aria-label="Recolher painel"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/*
         * Este permanece como o único scroll principal dos
         * painéis móveis. O gesto de fechamento não começa
         * dentro desta área.
         */}
        <div className="touch-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          {renderPanel(
            activePanel,
            panelProps,
          )}
        </div>
      </section>
    </>
  );
}

function BottomNavigation({
  activePanel,
  panelOpen,
  alertsCount,
  onSelect,
}) {
  return (
    <nav
      className="geofogo-bottom-navigation absolute bottom-0 left-0 right-0 z-40 grid grid-cols-6 border-t border-border bg-card/95 shadow-[0_-4px_18px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden"
      aria-label="Navegação principal"
    >
      {PANELS.map((panel) => {
        const Icon =
          panel.icon;

        const active =
          activePanel ===
            panel.id &&
          panelOpen;

        return (
          <button
            type="button"
            key={panel.id}
            onClick={() =>
              onSelect(
                panel.id,
              )
            }
            className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 transition-colors ${
              active
                ? 'text-amber-500'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label={
              panel.fullLabel ||
              panel.label
            }
            aria-pressed={active}
          >
            {active && (
              <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-amber-500" />
            )}

            <div className="relative">
              <Icon
                className={`h-[18px] w-[18px] ${
                  active
                    ? 'stroke-[2.5]'
                    : ''
                }`}
              />

              {panel.id ===
                'alerts' &&
                alertsCount > 0 && (
                  <span
                    className="
                      absolute -right-2.5 -top-2.5
                      flex min-h-4 min-w-4
                      items-center justify-center
                      rounded-full
                      bg-red-600
                      px-1
                      text-[8px] font-bold
                      leading-none text-white
                      ring-2 ring-card
                    "
                    aria-label={`${alertsCount} alertas ativos`}
                  >
                    {alertsCount > 99
                      ? '99+'
                      : alertsCount}
                  </span>
                )}
            </div>

            <span className="w-full truncate text-center text-[9px] font-medium leading-none">
              {panel.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function renderPanel(
  id,
  props,
) {
  switch (id) {
    case 'layers':
      return (
        <LayerPanel
          layerGroups={
            props.layerGroups
          }
          onToggle={
            props.toggleLayer
          }
          onOpacity={
            props.setLayerOpacity
          }
          onSync={props.sync}
        />
      );

    case 'alerts':
      return (
        <AlertPanel
          alerts={props.alerts}
        />
      );

    case 'stats':
      return (
        <StatsPanel
          stats={
            props.stats
          }
          online={
            props.online
          }
          syncing={
            props.syncing
          }
          onOpenAlerts={
            props.openAlertsPanel
          }
        />
      );

    <FieldModePanel
      fieldState={
        props.fieldState
      }
      onStart={
        props.startFieldMode
      }
      onStop={
        props.stopFieldMode
      }
      onToggleRecord={
        props.toggleRecording
      }
      onFinishTrail={
        props.finishFieldTrail
      }
      onAddPoint={
        props.addFieldPoint
      }
    />
      return (
        <FieldModePanel
          fieldState={
            props.fieldState
          }
          onStart={
            props.startFieldMode
          }
          onStop={
            props.stopFieldMode
          }
          onToggleRecord={
            props.toggleRecording
          }
          onFinishTrail={
            props.finishFieldTrail
          }
          onAddPoint={
            props.addFieldPoint
          }
        />
      );

    case 'settings':
      return (
        <SettingsPanel
          alertDistanceKm={
            props.config
              .alertDistanceKm
          }
          onAlertDistance={
            props.setAlertDistance
          }
          baseMaps={
            props.baseMaps
          }
          baseMapId={
            props.baseMapId
          }
          onBaseMap={
            props.changeBaseMap
          }
        />
      );

    case 'diagnostic':
      return (
        <DiagnosticDashboard
          onSync={props.sync}
          syncing={
            props.syncing
          }
          syncState={
            props.syncState
          }
          syncMessage={
            props.syncMessage
          }
        />
      );

    default:
      return null;
  }
}