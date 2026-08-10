/**
 * FieldPointDetails
 *
 * Exibe os detalhes persistidos de um marcador de campo.
 *
 * Pode ser utilizado tanto dentro de uma missão
 * quanto na aba Sem missão.
 */

import {
  CalendarClock,
  ChevronDown,
  Compass,
  Crosshair,
  Download,
  FileJson,
  LocateFixed,
  MapPin,
  Mountain,
  Palette,
  Satellite,
  Save,
} from 'lucide-react';

import {
  useEffect,
  useState,
} from 'react';

import {
  EventBus,
  EVENTS,
} from '../../core/EventBus';

import {
  FieldController,
} from '../../field/FieldController';

import {
  FIELD_MARKER_ICON,
  FIELD_MARKER_SIZE,
} from '../../field/FieldStyles';

import {
  downloadFieldExport,
  getFieldExportDateStamp,
  slugifyFieldExportName,
} from './fieldExportUtils';

function formatNumber(
  value,
  digits = 6,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—';
  }

  return numeric.toLocaleString(
    'pt-BR',
    {
      minimumFractionDigits:
        digits,

      maximumFractionDigits:
        digits,
    },
  );
}

function formatMeters(
  value,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  const numeric =
    Number(value);

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

function formatHeading(
  value,
) {
  const numeric =
    Number(value);

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
        0,
    },
  )}°`;
}

function formatDateTime(
  value,
) {
  const numeric =
    Number(value);

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

function getCategoryLabel(
  category,
) {
  switch (category) {
    case 'active-fire':
      return 'Foco ativo';

    case 'vehicle':
      return 'Viatura';

    case 'water-source':
      return 'Ponto d’água';

    case 'blockage':
      return 'Bloqueio';

    case 'risk':
      return 'Área de risco';

    case 'service':
      return 'Atendimento';

    case 'observation':
      return 'Observação';

    default:
      return 'Marcador';
  }
}

function getOriginLabel(
  origin,
) {
  switch (origin) {
    case 'current-position':
      return 'Posição atual';

    case 'manual-coordinate':
      return 'Coordenada informada';

    default:
      return 'Indefinida';
  }
}

function getStatusLabel(
  status,
) {
  switch (status) {
    case 'new':
      return 'Novo';

    case 'in-progress':
      return 'Em andamento';

    case 'verified':
      return 'Verificado';

    case 'completed':
      return 'Concluído';

    default:
      return 'Indefinido';
  }
}

function getMarkerIconLabel(
  iconId,
) {
  switch (iconId) {
    case FIELD_MARKER_ICON.FLAME:
      return 'Fogo';

    case FIELD_MARKER_ICON.VEHICLE:
      return 'Viatura';

    case FIELD_MARKER_ICON.WATER:
      return 'Água';

    case FIELD_MARKER_ICON.BLOCKAGE:
      return 'Bloqueio';

    case FIELD_MARKER_ICON.RISK:
      return 'Risco';

    case FIELD_MARKER_ICON.SERVICE:
      return 'Atendimento';

    case FIELD_MARKER_ICON.OBSERVATION:
      return 'Observação';

    default:
      return 'Observação';
  }
}

function getMarkerSizeLabel(
  size,
) {
  switch (size) {
    case FIELD_MARKER_SIZE.SMALL:
      return 'Pequeno';

    case FIELD_MARKER_SIZE.LARGE:
      return 'Grande';

    case FIELD_MARKER_SIZE.MEDIUM:
    default:
      return 'Médio';
  }
}

function createStyleDraft(
  point,
) {
  const properties =
    point?.properties ||
    {};

  const style =
    properties.style ||
    {};

  const category =
    properties.category ||
    'observation';

  return {
    color:
      style.color ||
      '#7c3aed',

    iconId:
      style.iconId ||
      category,

    size:
      style.size ||
      FIELD_MARKER_SIZE.MEDIUM,
  };
}

export default function FieldPointDetails({
  point,
  onClose,
  embedded = false,
}) {
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
    () =>
      createStyleDraft(
        point,
      ),
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
      if (!point) {
        return;
      }

      /*
       * Reinicializa o formulário somente quando
       * outro marcador é selecionado.
       *
       * Atualizações do próprio marcador não devem
       * fechar o editor de aparência.
       */
      setDraftStyle(
        createStyleDraft(
          point,
        ),
      );

      setEditingStyle(
        false,
      );

      setStyleError(
        null,
      );
    },
    [
      point?.id,
    ],
  );

  if (!point) {
    return null;
  }

  const properties =
    point.properties ||
    {};

  const coordinates =
    point.geometry
      ?.coordinates ||
    [];

  const longitude =
    coordinates[0];

  const latitude =
    coordinates[1];

  const category =
    properties.category ||
    'observation';

  const label =
    properties.label ||
    getCategoryLabel(
      category,
    );

  const style =
    properties.style ||
    {};

  function handleFocusOnMap() {
    EventBus.emit(
      EVENTS.MAP_FOCUS_FIELD_FEATURE,
      {
        feature:
          point,
      },
    );
  }

  function handleExportGeoJSON() {
    const content =
      FieldController
        .exportGeoJSON({
          pointId:
            point.id,
        });

    const name =
      slugifyFieldExportName(
        label ||
        'marcador',
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
          pointId:
            point.id,
        });

    const name =
      slugifyFieldExportName(
        label ||
        'marcador',
      );

    downloadFieldExport({
      content,

      filename:
        `geofogo-${name}-${getFieldExportDateStamp()}.gpx`,

      mimeType:
        'application/gpx+xml',
    });
  }

  function handleStartStyleEdit() {
    setDraftStyle(
      createStyleDraft(
        point,
      ),
    );

    setStyleError(
      null,
    );

    setEditingStyle(
      true,
    );
  }

  function handleCancelStyleEdit() {
    setDraftStyle(
      createStyleDraft(
        point,
      ),
    );

    setStyleError(
      null,
    );

    setEditingStyle(
      false,
    );
  }

  async function handleSaveStyle() {
    if (savingStyle) {
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
        .updatePointStyle(
          point.id,
          draftStyle,
        );

      setEditingStyle(
        false,
      );
    } catch (error) {
      setStyleError(
        error?.message ||
        'Não foi possível salvar a aparência do marcador.',
      );
    } finally {
      setSavingStyle(
        false,
      );
    }
  }

  const detailsContent = (
    <>
      <button
        type="button"
        onClick={
          handleFocusOnMap
        }
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[10px] font-semibold text-blue-700 transition-colors hover:bg-blue-500/15 dark:text-blue-300"
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

      {properties.observation && (
        <div className="mt-3 rounded-lg bg-accent/20 p-2.5">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
            Observação
          </p>

          <p className="mt-1 text-[10px] leading-relaxed">
            {properties.observation}
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric
          icon={
            Crosshair
          }
          label="Latitude"
          value={
            formatNumber(
              latitude,
            )
          }
        />

        <Metric
          icon={
            Crosshair
          }
          label="Longitude"
          value={
            formatNumber(
              longitude,
            )
          }
        />

        <Metric
          icon={
            Mountain
          }
          label="Altitude"
          value={
            formatMeters(
              properties.altitude,
            )
          }
        />

        <Metric
          icon={
            Satellite
          }
          label="Precisão"
          value={
            formatMeters(
              properties.accuracy,
            )
          }
        />

        <Metric
          icon={
            Compass
          }
          label="Direção"
          value={
            formatHeading(
              properties.heading,
            )
          }
        />

        <Metric
          icon={
            Satellite
          }
          label="Precisão altitude"
          value={
            formatMeters(
              properties.altitudeAccuracy,
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
            label="Criado em"
            value={
              formatDateTime(
                properties.timestamp ||
                point.created_date,
              )
            }
          />

          <Detail
            label="Origem"
            value={
              getOriginLabel(
                properties.origin,
              )
            }
          />

          <Detail
            label="Formato original"
            value={
              properties.originalCoordinateFormat ||
              '—'
            }
          />

          <Detail
            label="Trilho vinculado"
            value={
              point.trailId ||
              properties.trailId ||
              'Nenhum'
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
              onClick={
                handleStartStyleEdit
              }
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Editar aparência"
              aria-label="Editar aparência do marcador"
            >
              <Palette className="h-4 w-4" />
            </button>
          )}
        </div>

        {!editingStyle ? (
          <div className="mt-2 flex items-center gap-3">
            <span
              className="h-6 w-6 shrink-0 rounded-full border border-border"
              style={{
                backgroundColor:
                  style.color ||
                  '#7c3aed',
              }}
              title={
                style.color ||
                '#7c3aed'
              }
            />

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium">
                {style.color ||
                  '#7c3aed'}
              </p>

              <p className="text-[9px] text-muted-foreground">
                Ícone:{' '}

                {getMarkerIconLabel(
                  style.iconId ||
                  category,
                )}

                {' · '}

                Tamanho:{' '}

                {getMarkerSizeLabel(
                  style.size,
                )}
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
                      (
                        current,
                      ) => ({
                        ...current,

                        color:
                          event
                            .target
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
                      (
                        current,
                      ) => ({
                        ...current,

                        color:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={7}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[10px]"
                  placeholder="#7c3aed"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[9px] font-semibold text-muted-foreground">
                Ícone
              </label>

              <select
                value={
                  draftStyle.iconId
                }
                onChange={(event) =>
                  setDraftStyle(
                    (
                      current,
                    ) => ({
                      ...current,

                      iconId:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-[10px]"
              >
                <option
                  value={
                    FIELD_MARKER_ICON.FLAME
                  }
                >
                  Fogo
                </option>

                <option
                  value={
                    FIELD_MARKER_ICON.VEHICLE
                  }
                >
                  Viatura
                </option>

                <option
                  value={
                    FIELD_MARKER_ICON.WATER
                  }
                >
                  Água
                </option>

                <option
                  value={
                    FIELD_MARKER_ICON.BLOCKAGE
                  }
                >
                  Bloqueio
                </option>

                <option
                  value={
                    FIELD_MARKER_ICON.RISK
                  }
                >
                  Risco
                </option>

                <option
                  value={
                    FIELD_MARKER_ICON.SERVICE
                  }
                >
                  Atendimento
                </option>

                <option
                  value={
                    FIELD_MARKER_ICON.OBSERVATION
                  }
                >
                  Observação
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[9px] font-semibold text-muted-foreground">
                Tamanho
              </label>

              <div className="grid grid-cols-3 gap-2">
                <SizeButton
                  active={
                    draftStyle.size ===
                    FIELD_MARKER_SIZE.SMALL
                  }
                  onClick={() =>
                    setDraftStyle(
                      (
                        current,
                      ) => ({
                        ...current,

                        size:
                          FIELD_MARKER_SIZE.SMALL,
                      }),
                    )
                  }
                >
                  Pequeno
                </SizeButton>

                <SizeButton
                  active={
                    draftStyle.size ===
                    FIELD_MARKER_SIZE.MEDIUM
                  }
                  onClick={() =>
                    setDraftStyle(
                      (
                        current,
                      ) => ({
                        ...current,

                        size:
                          FIELD_MARKER_SIZE.MEDIUM,
                      }),
                    )
                  }
                >
                  Médio
                </SizeButton>

                <SizeButton
                  active={
                    draftStyle.size ===
                    FIELD_MARKER_SIZE.LARGE
                  }
                  onClick={() =>
                    setDraftStyle(
                      (
                        current,
                      ) => ({
                        ...current,

                        size:
                          FIELD_MARKER_SIZE.LARGE,
                      }),
                    )
                  }
                >
                  Grande
                </SizeButton>
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
                className="rounded-md border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent disabled:opacity-50"
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
                className="flex items-center justify-center gap-1.5 rounded-md bg-purple-600 px-3 py-2 text-[10px] font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
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
    </>
  );

  /**
   * Quando estiver dentro da própria linha
   * expansível de Missões/Sem missão,
   * mostra apenas o conteúdo dos detalhes.
   */
  if (embedded) {
    return (
      <div className="px-3 py-3">
        {detailsContent}
      </div>
    );
  }

  /**
   * Uso independente.
   *
   * Mantém o cabeçalho completo para qualquer local
   * que ainda use FieldPointDetails diretamente.
   */
  return (
    <section className="mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 px-3 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-purple-500" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wide">
              {label}
            </p>

            <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
              {getCategoryLabel(
                category,
              )}

              {' · '}

              {getStatusLabel(
                properties.status,
              )}
            </p>
          </div>
        </div>

        {typeof onClose ===
          'function' && (
          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Recolher detalhes"
            aria-label="Recolher detalhes do marcador"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="border-t border-border px-3 py-3">
        {detailsContent}
      </div>
    </section>
  );
}

function SizeButton({
  active,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`rounded-md border px-2 py-2 text-[9px] font-semibold transition-colors ${
        active
          ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300'
          : 'border-border bg-background text-muted-foreground hover:bg-accent'
      }`}
    >
      {children}
    </button>
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

      <p className="mt-1 break-all text-[10px] font-semibold">
        {value}
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

      <p className="mt-0.5 break-all text-[9px] font-medium">
        {value}
      </p>
    </div>
  );
}