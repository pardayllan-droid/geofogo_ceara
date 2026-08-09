/**
 * FieldTrailDetails
 *
 * Exibe os detalhes persistidos de um trilho.
 *
 * Pode ser utilizado tanto no gestor de Missões
 * quanto na aba Sem missão.
 */

import {
  Activity,
  CalendarClock,
  Gauge,
  Mountain,
  Route,
  Satellite,
  Timer,
  X,
} from 'lucide-react';

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
      maximumFractionDigits:
        1,
    },
  )} km/h`;
}

function formatMeters(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return '—';
  }

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

function formatDateTime(
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

  return new Date(
    numeric,
  ).toLocaleString(
    'pt-BR',
    {
      dateStyle:
        'short',

      timeStyle:
        'short',
    },
  );
}

function calculateTrailDuration(
  trail,
) {
  if (!trail?.startedAt) {
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
}

function getStatusLabel(
  status,
) {
  switch (
    status
  ) {
    case 'active':
      return 'Em gravação';

    case 'paused':
      return 'Pausado';

    case 'completed':
      return 'Finalizado';

    case 'interrupted':
      return 'Interrompido';

    default:
      return 'Indefinido';
  }
}

function getPatternLabel(
  pattern,
) {
  return pattern ===
    'dashed'
    ? 'Tracejada'
    : 'Contínua';
}

export default function FieldTrailDetails({
  trail,
  onClose,
}) {
  if (!trail) {
    return null;
  }

  const duration =
    calculateTrailDuration(
      trail,
    );

  const style =
    trail.style ||
    {};

  const sampleCount =
    trail.sampleCount ??
    trail.samples
      ?.length ??
    0;

  return (
    <section className="mt-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="flex items-start gap-2">
        <Route className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {trail.name ||
              'Trilho sem nome'}
          </p>

          <p className="mt-0.5 text-[9px] text-muted-foreground">
            {getStatusLabel(
              trail.status,
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Fechar detalhes"
          aria-label="Fechar detalhes do trilho"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric
          icon={
            Timer
          }
          label="Duração"
          value={
            formatDuration(
              duration,
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
              trail.distanceMeters ||
              0,
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
              trail.averageSpeedMps,
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
              trail.maximumSpeedMps,
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
              trail.averageAccuracyMeters,
            )
          }
        />

        <Metric
          icon={
            Mountain
          }
          label="Altitude média"
          value={
            formatMeters(
              trail.averageAltitudeMeters,
            )
          }
        />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <CompactMetric
          label="Em movimento"
          value={
            formatDuration(
              trail.movingTimeMs,
            )
          }
        />

        <CompactMetric
          label="Parado"
          value={
            formatDuration(
              trail.stoppedTimeMs,
            )
          }
        />

        <CompactMetric
          label="Amostras"
          value={
            sampleCount
          }
        />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <CompactMetric
          label="Altitude mín."
          value={
            formatMeters(
              trail.minimumAltitudeMeters,
            )
          }
        />

        <CompactMetric
          label="Altitude média"
          value={
            formatMeters(
              trail.averageAltitudeMeters,
            )
          }
        />

        <CompactMetric
          label="Altitude máx."
          value={
            formatMeters(
              trail.maximumAltitudeMeters,
            )
          }
        />
      </div>

      <div className="mt-3 rounded-lg border border-border/70 bg-background/70 p-2.5">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-3 w-3 text-muted-foreground" />

          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Registro
          </p>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
          <Detail
            label="Início"
            value={
              formatDateTime(
                trail.startedAt,
              )
            }
          />

          <Detail
            label="Fim"
            value={
              trail.endedAt
                ? formatDateTime(
                    trail.endedAt,
                  )
                : '—'
            }
          />
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-border/70 bg-background/70 p-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Aparência
        </p>

        <div className="mt-2 flex items-center gap-3">
          <span
            className="h-6 w-6 shrink-0 rounded-md border border-border"
            style={{
              backgroundColor:
                style.color ||
                '#16a34a',
            }}
            title={
              style.color ||
              '#16a34a'
            }
          />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium">
              {style.color ||
                '#16a34a'}
            </p>

            <p className="text-[9px] text-muted-foreground">
              {getPatternLabel(
                style.linePattern,
              )}
              {' · '}
              {Number(
                style.width ||
                  4,
              ).toLocaleString(
                'pt-BR',
              )}
              {' px · '}
              {Math.round(
                Number(
                  style.opacity ??
                    0.9,
                ) *
                  100,
              )}
              % opacidade
            </p>
          </div>
        </div>
      </div>
    </section>
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

      <p className="mt-0.5 truncate text-[10px] font-semibold">
        {value ??
          '—'}
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
}) {
  return (
    <div>
      <p className="text-[8px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <p className="mt-0.5 text-[9px] font-medium">
        {value}
      </p>
    </div>
  );
}