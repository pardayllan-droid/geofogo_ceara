/**
 * FieldTrailCard
 *
 * Responsável por:
 * - apresentar o trilho atual;
 * - atualizar a duração em tempo real;
 * - mostrar métricas;
 * - pausar/retomar;
 * - finalizar o trilho.
 */

import {
  Activity,
  Gauge,
  Pause,
  Play,
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
  formatDistance,
} from '../../utils/formatters';

function formatDuration(
  milliseconds,
) {
  const numeric =
    Math.max(
      0,
      Number(
        milliseconds,
      ) ||
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
        String(
          value,
        ).padStart(
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

export default function FieldTrailCard({
  fieldState,
  onToggle,
  onFinish,
}) {
  const [
    clockTick,
    setClockTick,
  ] = useState(
    Date.now(),
  );

  const trail =
    fieldState
      ?.currentTrail ||
    null;

  const trailExists =
    Boolean(
      trail,
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

  useEffect(
    () => {
      if (
        !trailOpen
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
      trailOpen,
    ],
  );

  const liveDuration =
    useMemo(
      () => {
        void clockTick;

        if (!trail) {
          return 0;
        }

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
        trail,
      ],
    );

  if (!trailExists) {
    return null;
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Route className="h-4 w-4 shrink-0 text-green-600" />

            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                {trail.name ||
                  'Trilho atual'}
              </p>

              <p className="text-[10px] text-muted-foreground">
                {fieldState
                  ?.recording
                  ? 'Gravando'
                  : trailPaused
                    ? 'Pausado'
                    : trailCompleted
                      ? 'Finalizado'
                      : 'Preparado'}
              </p>
            </div>
          </div>

          {fieldState
            ?.recording && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-[9px] font-bold text-red-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />

              REC
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Metric
            icon={
              Timer
            }
            label="Duração"
            value={
              formatDuration(
                liveDuration,
              )
            }
          />

          <Metric
            icon={
              Route
            }
            label="Distância"
            value={
              formatDistance(
                fieldState
                  ?.distance ||
                  0,
              )
            }
          />

          <Metric
            icon={
              Gauge
            }
            label="Velocidade atual"
            value={
              formatSpeed(
                fieldState
                  ?.speed,
              )
            }
          />

          <Metric
            icon={
              Gauge
            }
            label="Velocidade média"
            value={
              formatSpeed(
                fieldState
                  ?.averageSpeed,
              )
            }
          />

          <Metric
            icon={
              Activity
            }
            label="Velocidade máxima"
            value={
              formatSpeed(
                fieldState
                  ?.maximumSpeed,
              )
            }
          />

          <Metric
            icon={
              Satellite
            }
            label="Precisão média"
            value={
              formatMeters(
                fieldState
                  ?.averageAccuracy,
              )
            }
          />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <CompactMetric
            label="Em movimento"
            value={
              formatDuration(
                fieldState
                  ?.movingTime,
              )
            }
          />

          <CompactMetric
            label="Parado"
            value={
              formatDuration(
                fieldState
                  ?.stoppedTime,
              )
            }
          />

          <CompactMetric
            label="Amostras"
            value={
              fieldState
                ?.trailLength
            }
          />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <CompactMetric
            label="Altitude mín."
            value={
              formatMeters(
                fieldState
                  ?.minimumAltitude,
              )
            }
          />

          <CompactMetric
            label="Altitude média"
            value={
              formatMeters(
                fieldState
                  ?.averageAltitude,
              )
            }
          />

          <CompactMetric
            label="Altitude máx."
            value={
              formatMeters(
                fieldState
                  ?.maximumAltitude,
              )
            }
          />
        </div>
      </section>

      {trailOpen && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={
              onToggle
            }
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
              fieldState
                ?.recording
                ? 'bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-300'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {fieldState
              ?.recording ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}

            {fieldState
              ?.recording
              ? 'Pausar trilho'
              : 'Retomar trilho'}
          </button>

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
        </div>
      )}
    </>
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
        {value ??
          '—'}
      </p>
    </div>
  );
}