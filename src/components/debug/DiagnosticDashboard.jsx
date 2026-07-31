/**
 * DiagnosticDashboard
 *
 * Visão resumida e amigável do diagnóstico do GeoFogo Ceará.
 *
 * - abre dentro do painel lateral, como os demais painéis;
 * - apresenta informações em cartões;
 * - atualiza automaticamente a cada 15 segundos;
 * - mantém acesso ao relatório técnico completo;
 * - não altera AppCore, SyncEngine, LayerManager ou serviços.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Map,
  RefreshCw,
  Server,
  Smartphone,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';

import { AppCore } from '../../core/AppCore';
import { ErrorManager } from '../../core/ErrorManager';
import { LayerManager } from '../../layers/LayerManager';

import DiagnosticPanel from './DiagnosticPanel';

const AUTO_REFRESH_INTERVAL_MS = 15000;

function countFeatures(data) {
  if (!data) {
    return 0;
  }

  if (
    data.type === 'FeatureCollection' &&
    Array.isArray(data.features)
  ) {
    return data.features.length;
  }

  if (data.type === 'Feature') {
    return 1;
  }

  if (Array.isArray(data)) {
    return data.length;
  }

  return 0;
}

function getErrors() {
  try {
    const fromAll =
      ErrorManager.all?.();

    if (Array.isArray(fromAll)) {
      return fromAll;
    }

    const fromGetErrors =
      ErrorManager.getErrors?.();

    if (
      Array.isArray(
        fromGetErrors,
      )
    ) {
      return fromGetErrors;
    }

    const fromGetAll =
      ErrorManager.getAll?.();

    if (
      Array.isArray(
        fromGetAll,
      )
    ) {
      return fromGetAll;
    }

    if (
      Array.isArray(
        ErrorManager.errors,
      )
    ) {
      return ErrorManager.errors;
    }

    if (
      Array.isArray(
        ErrorManager._errors,
      )
    ) {
      return ErrorManager._errors;
    }

    return [];
  } catch {
    return [];
  }
}

function getLayerRuntime(
  map,
  layerId,
) {
  if (!map) {
    return {
      exists: false,
      visible: false,
      rendered: 0,
    };
  }

  try {
    const layer =
      map.getLayer?.(
        layerId,
      );

    if (!layer) {
      return {
        exists: false,
        visible: false,
        rendered: 0,
      };
    }

    const visibility =
      map.getLayoutProperty?.(
        layerId,
        'visibility',
      ) || 'visible';

    let rendered = 0;

    try {
      rendered =
        map.queryRenderedFeatures?.(
          undefined,
          {
            layers: [
              layerId,
            ],
          },
        )?.length || 0;
    } catch {
      try {
        rendered =
          map.queryRenderedFeatures?.(
            {
              layers: [
                layerId,
              ],
            },
          )?.length || 0;
      } catch {
        rendered = -1;
      }
    }

    return {
      exists: true,
      visible:
        visibility !== 'none',
      rendered,
    };
  } catch {
    return {
      exists: false,
      visible: false,
      rendered: 0,
    };
  }
}

function collectSummary({
  syncState,
  syncing,
  syncMessage,
}) {
  const map =
    LayerManager._map ||
    LayerManager.getMap?.() ||
    null;

  let styleLoaded = false;
  let zoom = null;
  let center = null;

  if (map) {
    try {
      styleLoaded =
        Boolean(
          map.isStyleLoaded?.(),
        );
    } catch {
      styleLoaded = false;
    }

    try {
      zoom =
        map.getZoom?.() ??
        null;
    } catch {
      zoom = null;
    }

    try {
      const currentCenter =
        map.getCenter?.();

      if (currentCenter) {
        center = {
          longitude:
            currentCenter.lng,
          latitude:
            currentCenter.lat,
        };
      }
    } catch {
      center = null;
    }
  }

  const installed =
    typeof window !==
      'undefined' &&
    Boolean(
      window.matchMedia?.(
        '(display-mode: standalone)',
      )?.matches ||
        window.navigator
          ?.standalone === true,
    );

  return {
    collectedAt:
      new Date(),

    application: {
      initialized:
        Boolean(
          AppCore.initialized,
        ),

      online:
        typeof navigator ===
          'undefined'
          ? true
          : navigator.onLine,

      installed,

      syncing:
        Boolean(syncing),

      syncState:
        syncState ||
        'desconhecido',

      syncMessage:
        syncMessage ||
        'Sem mensagem de sincronização.',
    },

    data: {
      boundary:
        countFeatures(
          AppCore.cearaBoundary,
        ),

      municipalities:
        countFeatures(
          AppCore.municipalities,
        ),

      conservationUnits:
        countFeatures(
          AppCore.conservationUnits,
        ),

      fireEvents:
        countFeatures(
          AppCore.fireEvents,
        ),

      fireFronts:
        countFeatures(
          AppCore.fireFronts,
        ),

      alerts:
        Array.isArray(
          AppCore.alerts,
        )
          ? AppCore.alerts.length
          : 0,
    },

    map: {
      connected:
        Boolean(map),

      ready:
        Boolean(
          map &&
            LayerManager.isReady?.(),
        ),

      styleLoaded,
      zoom,
      center,

      events:
        getLayerRuntime(
          map,
          'fire-events',
        ),

      markers:
        getLayerRuntime(
          map,
          'fire-events-markers',
        ),

      fronts:
        getLayerRuntime(
          map,
          'fire-fronts',
        ),

      municipalities:
        getLayerRuntime(
          map,
          'municipalities',
        ),

      conservationUnits:
        getLayerRuntime(
          map,
          'conservation-units',
        ),
    },

    errors:
      getErrors(),

    device: {
      language:
        typeof navigator !==
        'undefined'
          ? navigator.language
          : 'não disponível',

      userAgent:
        typeof navigator !==
        'undefined'
          ? navigator.userAgent
          : 'não disponível',
    },
  };
}

function formatTime(value) {
  if (!value) {
    return 'Não disponível';
  }

  try {
    return value.toLocaleTimeString(
      'pt-BR',
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      },
    );
  } catch {
    return 'Não disponível';
  }
}

function formatNumber(
  value,
  digits = 2,
) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return '—';
  }

  return numeric.toLocaleString(
    'pt-BR',
    {
      maximumFractionDigits:
        digits,
    },
  );
}

function getStatusAppearance(
  status,
) {
  if (status === 'success') {
    return {
      label: 'Concluída',
      className:
        'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300',
      icon: CheckCircle2,
    };
  }

  if (status === 'partial') {
    return {
      label: 'Parcial',
      className:
        'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      icon: AlertTriangle,
    };
  }

  if (status === 'error') {
    return {
      label: 'Erro',
      className:
        'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
      icon: XCircle,
    };
  }

  if (
    status === 'running' ||
    status === 'syncing'
  ) {
    return {
      label: 'Em andamento',
      className:
        'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
      icon: RefreshCw,
    };
  }

  return {
    label:
      status || 'Desconhecida',
    className:
      'border-border bg-muted/40 text-muted-foreground',
    icon: AlertCircle,
  };
}

export default function DiagnosticDashboard({
  onSync,
  syncing = false,
  syncState = 'desconhecido',
  syncMessage = '',
}) {
  const [
    summary,
    setSummary,
  ] = useState(null);

  const [
    fullReportOpen,
    setFullReportOpen,
  ] = useState(false);

  const collect =
    useCallback(() => {
      setSummary(
        collectSummary({
          syncState,
          syncing,
          syncMessage,
        }),
      );
    }, [
      syncState,
      syncing,
      syncMessage,
    ]);

  useEffect(() => {
    collect();

    const interval =
      window.setInterval(
        collect,
        AUTO_REFRESH_INTERVAL_MS,
      );

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [collect]);

  const statusAppearance =
    useMemo(
      () =>
        getStatusAppearance(
          summary?.application
            ?.syncState,
        ),
      [
        summary?.application
          ?.syncState,
      ],
    );

  if (!summary) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />

          Coletando diagnóstico...
        </div>
      </div>
    );
  }

  const StatusIcon =
    statusAppearance.icon;

  const latestError =
    summary.errors[
      summary.errors.length - 1
    ];

  const latestErrorMessage =
    latestError?.message ||
    latestError?.error?.message ||
    latestError?.detail ||
    null;

  return (
    <>
      <div className="flex min-h-full flex-col bg-background">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                <Activity className="h-5 w-5 text-orange-500" />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">
                  Diagnóstico
                </h2>

                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Atualizado às{' '}
                  {formatTime(
                    summary.collectedAt,
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={collect}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Atualizar diagnóstico"
              aria-label="Atualizar diagnóstico"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-3">
          <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-amber-500" />

                <h3 className="text-xs font-semibold uppercase tracking-wide">
                  Aplicação
                </h3>
              </div>

              <div
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${statusAppearance.className}`}
              >
                <StatusIcon
                  className={`h-3 w-3 ${
                    syncing
                      ? 'animate-spin'
                      : ''
                  }`}
                />

                {statusAppearance.label}
              </div>
            </div>

            <StatusRow
              label="Inicializada"
              ok={
                summary.application
                  .initialized
              }
            />

            <StatusRow
              label="Mapa conectado"
              ok={
                summary.map
                  .connected
              }
            />

            <StatusRow
              label="Estilo carregado"
              ok={
                summary.map
                  .styleLoaded
              }
            />

            <StatusRow
              label="Modo instalado"
              ok={
                summary.application
                  .installed
              }
              neutralWhenFalse
            />

            <div className="mt-3 rounded-lg bg-muted/50 p-2">
              <div className="flex items-center gap-2">
                {summary.application
                  .online ? (
                  <Wifi className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-red-500" />
                )}

                <span className="text-xs font-medium">
                  {summary.application
                    .online
                    ? 'Online'
                    : 'Offline'}
                </span>
              </div>

              <p className="mt-1 break-words text-[10px] leading-relaxed text-muted-foreground">
                {
                  summary.application
                    .syncMessage
                }
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-amber-500" />

              <h3 className="text-xs font-semibold uppercase tracking-wide">
                Dados carregados
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                label="Limite"
                value={
                  summary.data
                    .boundary
                }
              />

              <MetricCard
                label="Municípios"
                value={
                  summary.data
                    .municipalities
                }
              />

              <MetricCard
                label="UCs"
                value={
                  summary.data
                    .conservationUnits
                }
              />

              <MetricCard
                label="Eventos"
                value={
                  summary.data
                    .fireEvents
                }
                emphasized
              />

              <MetricCard
                label="Frentes"
                value={
                  summary.data
                    .fireFronts
                }
              />

              <MetricCard
                label="Alertas"
                value={
                  summary.data
                    .alerts
                }
                warning={
                  summary.data
                    .alerts > 0
                }
              />
            </div>
          </section>

          <AccordionSection
            title="Mapa e renderização"
            icon={Map}
            defaultOpen
          >
            <div className="space-y-2">
              <InfoRow
                label="Zoom"
                value={formatNumber(
                  summary.map.zoom,
                )}
              />

              <InfoRow
                label="Longitude"
                value={formatNumber(
                  summary.map.center
                    ?.longitude,
                  5,
                )}
              />

              <InfoRow
                label="Latitude"
                value={formatNumber(
                  summary.map.center
                    ?.latitude,
                  5,
                )}
              />

              <div className="my-2 border-t border-border" />

              <RuntimeRow
                label="Eventos"
                runtime={
                  summary.map.events
                }
              />

              <RuntimeRow
                label="Marcadores"
                runtime={
                  summary.map.markers
                }
              />

              <RuntimeRow
                label="Frentes"
                runtime={
                  summary.map.fronts
                }
              />

              <RuntimeRow
                label="Municípios"
                runtime={
                  summary.map
                    .municipalities
                }
              />

              <RuntimeRow
                label="UCs"
                runtime={
                  summary.map
                    .conservationUnits
                }
              />
            </div>
          </AccordionSection>

          <AccordionSection
            title={`Erros (${summary.errors.length})`}
            icon={
              summary.errors.length > 0
                ? AlertTriangle
                : CheckCircle2
            }
            defaultOpen={
              summary.errors.length > 0
            }
            warning={
              summary.errors.length > 0
            }
          >
            {summary.errors.length ===
            0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-2 text-xs text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />

                Nenhum erro registrado.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2">
                  <p className="break-words text-xs font-medium text-red-700 dark:text-red-300">
                    {latestErrorMessage ||
                      'Erro sem mensagem disponível.'}
                  </p>
                </div>

                {summary.errors.length >
                  1 && (
                  <p className="text-[10px] text-muted-foreground">
                    Existem outros{' '}
                    {summary.errors
                      .length - 1}{' '}
                    registros no relatório
                    completo.
                  </p>
                )}
              </div>
            )}
          </AccordionSection>

          <AccordionSection
            title="Dispositivo"
            icon={Smartphone}
          >
            <div className="space-y-2">
              <InfoRow
                label="Idioma"
                value={
                  summary.device
                    .language
                }
              />

              <div>
                <p className="text-[10px] font-medium text-muted-foreground">
                  Navegador e sistema
                </p>

                <p className="mt-1 break-words text-[10px] leading-relaxed">
                  {
                    summary.device
                      .userAgent
                  }
                </p>
              </div>
            </div>
          </AccordionSection>

          <div className="space-y-2 pb-3">
            <button
              type="button"
              onClick={onSync}
              disabled={
                syncing ||
                typeof onSync !==
                  'function'
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  syncing
                    ? 'animate-spin'
                    : ''
                }`}
              />

              {syncing
                ? 'Sincronizando...'
                : 'Sincronizar dados'}
            </button>

            <button
              type="button"
              onClick={() =>
                setFullReportOpen(true)
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              <FileText className="h-4 w-4" />

              Abrir relatório completo
            </button>
          </div>
        </div>
      </div>

      {fullReportOpen && (
        <DiagnosticPanel
          open
          onClose={() =>
            setFullReportOpen(false)
          }
          syncState={syncState}
          syncing={syncing}
          syncMessage={syncMessage}
        />
      )}
    </>
  );
}

function StatusRow({
  label,
  ok,
  neutralWhenFalse = false,
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs">
        {label}
      </span>

      {ok ? (
        <div className="flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Sim
        </div>
      ) : neutralWhenFalse ? (
        <span className="text-[10px] text-muted-foreground">
          Não
        </span>
      ) : (
        <div className="flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
          <XCircle className="h-3.5 w-3.5" />
          Não
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  emphasized = false,
  warning = false,
}) {
  let className =
    'border-border bg-muted/35';

  if (emphasized) {
    className =
      'border-orange-500/30 bg-orange-500/10';
  }

  if (warning) {
    className =
      'border-red-500/30 bg-red-500/10';
  }

  return (
    <div
      className={`rounded-lg border p-2.5 ${className}`}
    >
      <p className="text-[10px] text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold leading-none">
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-muted-foreground">
        {label}
      </span>

      <span className="max-w-[55%] truncate text-right text-[11px] font-medium">
        {value ?? '—'}
      </span>
    </div>
  );
}

function RuntimeRow({
  label,
  runtime,
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-2">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium">
          {label}
        </p>

        <p className="text-[9px] text-muted-foreground">
          {runtime.exists
            ? runtime.visible
              ? 'Camada visível'
              : 'Camada oculta'
            : 'Camada inexistente'}
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm font-bold">
          {runtime.rendered < 0
            ? '—'
            : runtime.rendered}
        </p>

        <p className="text-[9px] text-muted-foreground">
          renderizadas
        </p>
      </div>
    </div>
  );
}

function AccordionSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  warning = false,
}) {
  const [open, setOpen] =
    useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) => !current,
          )
        }
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/50"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            className={`h-4 w-4 shrink-0 ${
              warning
                ? 'text-red-500'
                : 'text-amber-500'
            }`}
          />

          <h3 className="truncate text-xs font-semibold uppercase tracking-wide">
            {title}
          </h3>
        </div>

        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-3 py-3">
          {children}
        </div>
      )}
    </section>
  );
}