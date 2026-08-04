/**
 * FieldModePanel
 *
 * Interface operacional do Modo Campo.
 *
 * Conceitos:
 * - Modo Campo: mantém o GPS ativo;
 * - Trilho: gravação opcional do deslocamento;
 * - Ponto: pode ser independente ou vinculado ao trilho.
 *
 * Nesta fase, o painel permite:
 * - ativar e encerrar o Modo Campo;
 * - iniciar, pausar, retomar e finalizar trilho;
 * - acompanhar métricas do GPS e do trilho;
 * - adicionar ponto na posição atual;
 * - escolher se o ponto será vinculado ao trilho;
 * - exportar GeoJSON e GPX.
 */

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Gauge,
  Navigation,
  Pause,
  Play,
  Radio,
  Route,
  Satellite,
  Square,
  Timer,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FieldController,
} from '../../field/FieldController';

import FieldMarkerForm from './FieldMarkerForm';

import {
  formatDistance,
} from '../../utils/formatters';

function formatDuration(
  milliseconds,
) {
  const numeric =
    Math.max(
      0,
      Number(milliseconds) ||
        0,
    );

  const totalSeconds =
    Math.floor(
      numeric /
        1000,
    );

  const hours =
    Math.floor(
      totalSeconds /
        3600,
    );

  const minutes =
    Math.floor(
      (
        totalSeconds %
        3600
      ) /
        60,
    );

  const seconds =
    totalSeconds %
    60;

  return [
    hours,
    minutes,
    seconds,
  ]
    .map(
      (value) =>
        String(value).padStart(
          2,
          '0',
        ),
    )
    .join(
      ':',
    );
}

function formatSpeed(
  metersPerSecond,
) {
  const numeric =
    Number(
      metersPerSecond,
    );

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—';
  }

  return `${(
    numeric *
    3.6
  ).toLocaleString(
    'pt-BR',
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        1,
    },
  )} km/h`;
}

function formatMeters(
  value,
) {
  const numeric =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—';
  }

  return `${numeric.toLocaleString(
    'pt-BR',
    {
      maximumFractionDigits:
        1,
    },
  )} m`;
}

function downloadTextFile({
  content,
  filename,
  mimeType,
}) {
  const blob =
    new Blob(
      [
        content,
      ],
      {
        type:
          mimeType,
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      'a',
    );

  anchor.href =
    url;

  anchor.download =
    filename;

  document.body.appendChild(
    anchor,
  );

  anchor.click();

  anchor.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        url,
      );
    },
    0,
  );
}

export default function FieldModePanel({
  fieldState,
  onStart,
  onStop,
  onToggleRecord,
  onFinishTrail,
  onAddPoint,
}) {

  const [
    actionError,
    setActionError,
  ] = useState(
    null,
  );

  const [
    actionMessage,
    setActionMessage,
  ] = useState(
    null,
  );

  /**
   * Mantém o cronômetro fluido mesmo quando o GPS não
   * produz uma nova posição durante alguns segundos.
   */
  const [
    clockTick,
    setClockTick,
  ] = useState(
    Date.now(),
  );

  useEffect(
    () => {
      if (
        !fieldState?.active
      ) {
        return undefined;
      }

      const timer =
        window.setInterval(
          () => {
            setClockTick(
              Date.now(),
            );
          },
          1000,
        );

      return () => {
        window.clearInterval(
          timer,
        );
      };
    },
    [
      fieldState?.active,
    ],
  );

  const liveDuration =
    useMemo(
      () => {
        void clockTick;

        if (
          !fieldState
            ?.currentTrail
        ) {
          return 0;
        }

        const trail =
          fieldState.currentTrail;

        const end =
          trail.endedAt ||
          Date.now();

        let paused =
          trail.totalPausedMs ||
          0;

        if (
          trail.status ===
            'paused' &&
          trail.pausedAt
        ) {
          paused +=
            Math.max(
              0,
              Date.now() -
                trail.pausedAt,
            );
        }

        return Math.max(
          0,
          end -
            trail.startedAt -
            paused,
        );
      },
      [
        clockTick,
        fieldState
          ?.currentTrail,
      ],
    );

  const trailExists =
    Boolean(
      fieldState
        ?.currentTrail,
    );

  const trailCompleted =
    fieldState
      ?.trailStatus ===
    'completed';

  const trailPaused =
    fieldState
      ?.trailStatus ===
    'paused';

  const trailOpen =
    trailExists &&
    !trailCompleted;

  const hasCurrentPosition =
    Boolean(
      fieldState
        ?.currentPosition,
    );

  async function handleStartFieldMode() {
    setActionError(
      null,
    );

    setActionMessage(
      null,
    );

    try {
      await onStart();
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível ativar o Modo Campo.',
      );
    }
  }

  async function handleStopFieldMode() {
    setActionError(
      null,
    );

    try {
      await onStop();
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível encerrar o Modo Campo.',
      );
    }
  }

  async function handleToggleTrail() {
    setActionError(
      null,
    );

    setActionMessage(
      null,
    );

    try {
      await onToggleRecord();
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível alterar o estado do trilho.',
      );
    }
  }

  async function handleFinishTrail() {
    setActionError(
      null,
    );

    setActionMessage(
      null,
    );

    try {
      await onFinishTrail();

      setActionMessage(
        'Trilho finalizado e salvo.',
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível finalizar o trilho.',
      );
    }
  }

  function handleExport(
    format,
  ) {
    setActionError(
      null,
    );

    try {
      const timestamp =
        new Date()
          .toISOString()
          .replaceAll(
            ':',
            '-',
          );

      if (
        format ===
        'geojson'
      ) {
        downloadTextFile({
          content:
            FieldController.exportGeoJSON(),

          filename:
            `geofogo-campo-${timestamp}.geojson`,

          mimeType:
            'application/geo+json',
        });

        return;
      }

      downloadTextFile({
        content:
          FieldController.exportGPX(),

        filename:
          `geofogo-campo-${timestamp}.gpx`,

        mimeType:
          'application/gpx+xml',
      });
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível exportar os dados.',
      );
    }
  }

  if (
    !fieldState?.active
  ) {
    return (
      <div className="flex min-h-full flex-col">
        <PanelHeader />

        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
            <Navigation className="h-7 w-7 text-blue-500" />
          </div>

          <h3 className="text-sm font-semibold">
            Coleta de campo
          </h3>

          <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Ative o GPS para registrar trilhos, marcar pontos e acompanhar sua
            posição durante uma operação.
          </p>

          <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-muted-foreground">
            Na versão web, o rastreamento depende de a aplicação permanecer em
            primeiro plano. O APK utilizará um provedor Android próprio.
          </p>

          {actionError && (
            <FeedbackMessage
              type="error"
              message={
                actionError
              }
            />
          )}

          <button
            type="button"
            onClick={
              handleStartFieldMode
            }
            className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Satellite className="h-4 w-4" />

            Ativar Modo Campo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <PanelHeader
        recording={
          fieldState.recording
        }
        onStop={
          handleStopFieldMode
        }
      />

      <div className="space-y-3 p-3">
        <LocationStatus
          fieldState={
            fieldState
          }
        />

        {trailExists && (
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Route className="h-4 w-4 shrink-0 text-green-600" />

                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">
                    {fieldState
                      .currentTrail
                      ?.name ||
                      'Trilho atual'}
                  </p>

                  <p className="text-[10px] text-muted-foreground">
                    {fieldState.recording
                      ? 'Gravando'
                      : trailPaused
                        ? 'Pausado'
                        : trailCompleted
                          ? 'Finalizado'
                          : 'Preparado'}
                  </p>
                </div>
              </div>

              {fieldState.recording && (
                <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-[9px] font-bold text-red-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />

                  REC
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric
                icon={Timer}
                label="Duração"
                value={formatDuration(
                  liveDuration,
                )}
              />

              <Metric
                icon={Route}
                label="Distância"
                value={formatDistance(
                  fieldState.distance,
                )}
              />

              <Metric
                icon={Gauge}
                label="Velocidade atual"
                value={formatSpeed(
                  fieldState.speed,
                )}
              />

              <Metric
                icon={Gauge}
                label="Velocidade média"
                value={formatSpeed(
                  fieldState.averageSpeed,
                )}
              />

              <Metric
                icon={Activity}
                label="Velocidade máxima"
                value={formatSpeed(
                  fieldState.maximumSpeed,
                )}
              />

              <Metric
                icon={Satellite}
                label="Precisão média"
                value={formatMeters(
                  fieldState.averageAccuracy,
                )}
              />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <CompactMetric
                label="Em movimento"
                value={formatDuration(
                  fieldState.movingTime,
                )}
              />

              <CompactMetric
                label="Parado"
                value={formatDuration(
                  fieldState.stoppedTime,
                )}
              />

              <CompactMetric
                label="Amostras"
                value={
                  fieldState.trailLength
                }
              />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <CompactMetric
                label="Altitude mín."
                value={formatMeters(
                  fieldState.minimumAltitude,
                )}
              />

              <CompactMetric
                label="Altitude média"
                value={formatMeters(
                  fieldState.averageAltitude,
                )}
              />

              <CompactMetric
                label="Altitude máx."
                value={formatMeters(
                  fieldState.maximumAltitude,
                )}
              />
            </div>
          </div>
        )}

        <TrailControls
          fieldState={
            fieldState
          }
          trailExists={
            trailExists
          }
          trailOpen={
            trailOpen
          }
          trailPaused={
            trailPaused
          }
          trailCompleted={
            trailCompleted
          }
          onToggle={
            handleToggleTrail
          }
          onFinish={
            handleFinishTrail
          }
        />

        <FieldMarkerForm
          currentPositionAvailable={
            hasCurrentPosition
          }
          trailOpen={
            trailOpen
          }
          onCreateCurrentPosition={
            onAddPoint
          }
        />

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold">
            Exportar dados carregados
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                handleExport(
                  'geojson',
                )
              }
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium transition-colors hover:bg-accent/80"
            >
              <FileText className="h-3.5 w-3.5" />

              GeoJSON
            </button>

            <button
              type="button"
              onClick={() =>
                handleExport(
                  'gpx',
                )
              }
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium transition-colors hover:bg-accent/80"
            >
              <Download className="h-3.5 w-3.5" />

              GPX
            </button>
          </div>
        </div>

        {actionMessage && (
          <FeedbackMessage
            type="success"
            message={
              actionMessage
            }
          />
        )}

        {actionError && (
          <FeedbackMessage
            type="error"
            message={
              actionError
            }
          />
        )}

        <p className="pb-2 text-center text-[10px] text-muted-foreground">
          Encerrar o Modo Campo desativa o GPS. Finalizar o trilho mantém o GPS
          disponível.
        </p>
      </div>
    </div>
  );
}

function PanelHeader({
  recording =
    false,

  onStop =
    null,
}) {
  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <Navigation className="h-4 w-4 text-blue-500" />

        <h2 className="text-sm font-semibold">
          Campo
        </h2>

        {recording && (
          <span className="flex items-center gap-1 text-[10px] text-red-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />

            REC
          </span>
        )}
      </div>

      {onStop && (
        <button
          type="button"
          onClick={
            onStop
          }
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
          title="Encerrar Modo Campo e desligar GPS"
        >
          <Square className="h-3.5 w-3.5" />

          Encerrar Campo
        </button>
      )}
    </div>
  );
}

function LocationStatus({
  fieldState,
}) {
  const available =
    Boolean(
      fieldState
        .currentPosition,
    );

  const backgroundSupported =
    Boolean(
      fieldState
        .supportsBackgroundTracking,
    );

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            available
              ? 'bg-green-500/10'
              : 'bg-amber-500/10'
          }`}
        >
          {available ? (
            <Radio className="h-4 w-4 text-green-600" />
          ) : (
            <Satellite className="h-4 w-4 animate-pulse text-amber-600" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            {available
              ? 'GPS disponível'
              : 'Aguardando posição GPS'}
          </p>

          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Provedor: {fieldState.locationProvider || '—'}
          </p>

          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Precisão atual: {formatMeters(fieldState.currentAccuracy)}
          </p>

          <p
            className={`mt-1 text-[9px] ${
              backgroundSupported
                ? 'text-green-600'
                : 'text-amber-600'
            }`}
          >
            {backgroundSupported
              ? 'Rastreamento em segundo plano disponível'
              : 'Rastreamento em segundo plano indisponível nesta plataforma'}
          </p>
        </div>
      </div>

      {fieldState.locationError && (
        <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">
          {fieldState.locationError}
        </p>
      )}
    </div>
  );
}

function TrailControls({
  fieldState,
  trailExists,
  trailOpen,
  trailPaused,
  trailCompleted,
  onToggle,
  onFinish,
}) {
  let primaryLabel =
    'Iniciar trilho';

  if (
    fieldState.recording
  ) {
    primaryLabel =
      'Pausar trilho';
  } else if (
    trailPaused
  ) {
    primaryLabel =
      'Retomar trilho';
  } else if (
    trailCompleted
  ) {
    primaryLabel =
      'Iniciar novo trilho';
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={
          onToggle
        }
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
          fieldState.recording
            ? 'bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-300'
            : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        {fieldState.recording ? (
          <Pause className="h-4 w-4" />
        ) : trailPaused ? (
          <Play className="h-4 w-4" />
        ) : (
          <Route className="h-4 w-4" />
        )}

        {primaryLabel}
      </button>

      {trailOpen && (
        <button
          type="button"
          onClick={
            onFinish
          }
          className="flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15"
          title="Finalizar e salvar o trilho"
        >
          <Square className="h-3.5 w-3.5" />

          Finalizar trilho
        </button>
      )}

      {!trailExists && (
        <span className="sr-only">
          Nenhum trilho iniciado
        </span>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-lg bg-accent/30 p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />

        <span className="text-[9px]">
          {label}
        </span>
      </div>

      <p className="mt-1 text-xs font-semibold">
        {value}
      </p>
    </div>
  );
}

function CompactMetric({
  label,
  value,
}) {
  return (
    <div className="rounded-lg bg-accent/30 px-2 py-2 text-center">
      <p className="truncate text-[9px] text-muted-foreground">
        {label}
      </p>

      <p className="mt-0.5 truncate text-[11px] font-semibold">
        {value ?? '—'}
      </p>
    </div>
  );
}

function FeedbackMessage({
  type,
  message,
}) {
  const success =
    type ===
    'success';

  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[10px] ${
        success
          ? 'bg-green-500/10 text-green-700 dark:text-green-300'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      {success ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}

      <span>
        {message}
      </span>
    </div>
  );
}