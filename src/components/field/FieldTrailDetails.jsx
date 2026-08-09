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
  Download,
  FileJson,
  Gauge,
  LocateFixed,
  Mountain,
  Palette,
  Route,
  Satellite,
  Save,
  Timer,
  X,
} from 'lucide-react';

import {
  useEffect,
  useState,
} from 'react';
import {
  formatDistance,
} from '../../utils/formatters';
import {
  EventBus,
  EVENTS,
} from '../../core/EventBus';

import {
  FieldController,
} from '../../field/FieldController';

import {
  downloadFieldExport,
  getFieldExportDateStamp,
  slugifyFieldExportName,
} from './fieldExportUtils';

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

/**
 * Converte o objeto persistido do trilho em uma
 * feição GeoJSON LineString somente para navegação
 * e enquadramento no mapa.
 */
function createTrailFeature(
  trail,
) {
  const coordinates =
    Array.isArray(
      trail?.samples,
    )
      ? trail.samples
          .map(
            (sample) =>
              sample
                ?.geometry
                ?.coordinates,
          )
          .filter(
            (coordinate) =>
              Array.isArray(
                coordinate,
              ) &&
              coordinate.length >=
                2 &&
              Number.isFinite(
                Number(
                  coordinate[0],
                ),
              ) &&
              Number.isFinite(
                Number(
                  coordinate[1],
                ),
              ),
          )
      : [];

  if (
    coordinates.length <
    2
  ) {
    return null;
  }

  return {
    type:
      'Feature',

    id:
      trail.id,

    geometry: {
      type:
        'LineString',

      coordinates,
    },

    properties: {
      trailId:
        trail.id,

      name:
        trail.name ||
        null,
    },
  };
}

export default function FieldTrailDetails({
  trail,
  onClose,
}) {
  if (!trail) {
    return null;
  }

  const [
    editingStyle,
    setEditingStyle,
  ] = useState(
    false,
  );

  const [
    draftStyle,
    setDraftStyle,
  ] = useState(
    {
      color:
        trail.style
          ?.color ||
        '#16a34a',

      width:
        trail.style
          ?.width ??
        4,

      opacity:
        trail.style
          ?.opacity ??
        0.9,

      linePattern:
        trail.style
          ?.linePattern ||
        'solid',
    },
  );

  const [
    savingStyle,
    setSavingStyle,
  ] = useState(
    false,
  );

  const [
    styleError,
    setStyleError,
  ] = useState(
    null,
  );

  useEffect(
    () => {
      setDraftStyle({
        color:
          trail.style
            ?.color ||
          '#16a34a',

        width:
          trail.style
            ?.width ??
          4,

        opacity:
          trail.style
            ?.opacity ??
          0.9,

        linePattern:
          trail.style
            ?.linePattern ||
          'solid',
      });

      setEditingStyle(
        false,
      );

      setStyleError(
        null,
      );
    },
    [
      trail.id,
      trail.style?.color,
      trail.style?.width,
      trail.style?.opacity,
      trail.style?.linePattern,
    ],
  );

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

  const trailFeature =
    createTrailFeature(
      trail,
    );

  function handleFocusOnMap() {
    if (!trailFeature) {
      return;
    }

    EventBus.emit(
      EVENTS.MAP_FOCUS_FIELD_FEATURE,
      {
        feature:
          trailFeature,
      },
    );
  }

  function handleExportGeoJSON() {
    const content =
      FieldController
        .exportGeoJSON({
          trailId:
            trail.id,
        });

    const name =
      slugifyFieldExportName(
        trail.name ||
        'trilho',
      );

    downloadFieldExport({
      content,

      filename:
        `geofogo-${name}-${getFieldExportDateStamp()}.geojson`,

      mimeType:
        'application/geo+json',
    });
  }

  function handleExportGPX() {
    const content =
      FieldController
        .exportGPX({
          trailId:
            trail.id,
        });

    const name =
      slugifyFieldExportName(
        trail.name ||
        'trilho',
      );

    downloadFieldExport({
      content,

      filename:
        `geofogo-${name}-${getFieldExportDateStamp()}.gpx`,

      mimeType:
        'application/gpx+xml',
    });
  }

  function handleCancelStyleEdit() {
    setDraftStyle({
      color:
        trail.style
          ?.color ||
        '#16a34a',

      width:
        trail.style
          ?.width ??
        4,

      opacity:
        trail.style
          ?.opacity ??
        0.9,

      linePattern:
        trail.style
          ?.linePattern ||
        'solid',
    });

    setStyleError(
      null,
    );

    setEditingStyle(
      false,
    );
  }

  async function handleSaveStyle() {
    if (
      savingStyle
    ) {
      return;
    }

    try {
      setSavingStyle(
        true,
      );

      setStyleError(
        null,
      );

      await FieldController
        .updateTrailStyle(
          trail.id,
          draftStyle,
        );

      setEditingStyle(
        false,
      );
    } catch (error) {
      setStyleError(
        error?.message ||
          'Não foi possível salvar a aparência do trilho.',
      );
    } finally {
      setSavingStyle(
        false,
      );
    }
  }

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

      <button
        type="button"
        onClick={
          handleFocusOnMap
        }
        disabled={
          !trailFeature
        }
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300"
      >
        <LocateFixed className="h-3.5 w-3.5" />

        Ir para
      </button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={
            handleExportGeoJSON
          }
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent"
        >
          <FileJson className="h-3.5 w-3.5" />

          GeoJSON
        </button>

        <button
          type="button"
          onClick={
            handleExportGPX
          }
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" />

          GPX
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
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Aparência
          </p>

          {!editingStyle && (
            <button
              type="button"
              onClick={() =>
                setEditingStyle(
                  true,
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Editar aparência"
              aria-label="Editar aparência do trilho"
            >
              <Palette className="h-4 w-4" />
            </button>
          )}
        </div>

        {!editingStyle ? (
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
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-[9px] font-semibold text-muted-foreground">
                Cor
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={
                    draftStyle.color
                  }
                  onChange={(event) =>
                    setDraftStyle(
                      (current) => ({
                        ...current,

                        color:
                          event.target
                            .value,
                      }),
                    )
                  }
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-background p-1"
                />

                <input
                  type="text"
                  value={
                    draftStyle.color
                  }
                  onChange={(event) =>
                    setDraftStyle(
                      (current) => ({
                        ...current,

                        color:
                          event.target
                            .value,
                      }),
                    )
                  }
                  maxLength={7}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[10px]"
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-[9px] font-semibold text-muted-foreground">
                  Espessura
                </label>

                <span className="text-[9px] text-muted-foreground">
                  {draftStyle.width} px
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={
                  draftStyle.width
                }
                onChange={(event) =>
                  setDraftStyle(
                    (current) => ({
                      ...current,

                      width:
                        Number(
                          event.target
                            .value,
                        ),
                    }),
                  )
                }
                className="w-full"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="text-[9px] font-semibold text-muted-foreground">
                  Opacidade
                </label>

                <span className="text-[9px] text-muted-foreground">
                  {Math.round(
                    draftStyle.opacity *
                      100,
                  )}
                  %
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={
                  draftStyle.opacity
                }
                onChange={(event) =>
                  setDraftStyle(
                    (current) => ({
                      ...current,

                      opacity:
                        Number(
                          event.target
                            .value,
                        ),
                    }),
                  )
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[9px] font-semibold text-muted-foreground">
                Padrão
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDraftStyle(
                      (current) => ({
                        ...current,

                        linePattern:
                          'solid',
                      }),
                    )
                  }
                  className={`rounded-md border px-2 py-2 text-[10px] font-semibold transition-colors ${
                    draftStyle.linePattern ===
                    'solid'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      : 'border-border bg-background hover:bg-accent'
                  }`}
                >
                  Contínua
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setDraftStyle(
                      (current) => ({
                        ...current,

                        linePattern:
                          'dashed',
                      }),
                    )
                  }
                  className={`rounded-md border px-2 py-2 text-[10px] font-semibold transition-colors ${
                    draftStyle.linePattern ===
                    'dashed'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      : 'border-border bg-background hover:bg-accent'
                  }`}
                >
                  Tracejada
                </button>
              </div>
            </div>

            {styleError && (
              <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-[9px] text-destructive">
                {styleError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={
                  handleCancelStyleEdit
                }
                disabled={
                  savingStyle
                }
                className="rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  handleSaveStyle
                }
                disabled={
                  savingStyle
                }
                className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />

                {savingStyle
                  ? 'Salvando...'
                  : 'Salvar'}
              </button>
            </div>
          </div>
        )}
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