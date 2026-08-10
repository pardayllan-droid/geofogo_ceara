/**
 * FieldMissionPanel
 *
 * Interface inicial de gestão das missões operacionais.
 *
 * Permite:
 * - visualizar a missão ativa;
 * - criar uma missão;
 * - selecionar a missão ativa;
 * - mostrar ou ocultar uma missão;
 * - excluir uma missão.
 *
 * Nesta etapa, excluir uma missão não exclui trilhos
 * nem marcadores vinculados. Esses registros permanecem
 * armazenados e poderão ser reassociados posteriormente.
 */

import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FileJson,
  MapPin,
  Plus,
  Route,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import FieldTrailDetails from './FieldTrailDetails';
import FieldPointDetails from './FieldPointDetails';
import {
  FieldController,
} from '../../field/FieldController';

import {
  downloadFieldExport,
  getFieldExportDateStamp,
  slugifyFieldExportName,
} from './fieldExportUtils';


function formatMissionDate(
  timestamp,
) {
  const numeric =
    Number(
      timestamp,
    );

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return 'Data indisponível';
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

function getMarkerCategoryLabel(
  category,
) {
  switch (
    category
  ) {
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

function MissionRecordGroup({
  title,
  icon: Icon,
  emptyMessage,
  children,
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      </div>

      {children &&
      children.length > 0 ? (
        <div className="space-y-1.5">
          {children}
        </div>
      ) : (
        <p className="text-[9px] text-muted-foreground">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

function MissionRecordRow({
  label,
  visible,
  busy,
  expanded,
  onOpen,
  onToggle,
  onDelete,
  children,
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-background">
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={
            onOpen
          }
          disabled={
            !onOpen
          }
          aria-expanded={
            Boolean(
              expanded,
            )
          }
          className={`flex min-w-0 flex-1 items-center gap-2 text-left ${
            onOpen
              ? 'cursor-pointer'
              : 'cursor-default'
          }`}
          title={
            onOpen
              ? expanded
                ? `Recolher detalhes de ${label}`
                : `Abrir detalhes de ${label}`
              : undefined
          }
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}

          <span
            className={`min-w-0 flex-1 truncate text-[9px] font-medium ${
              onOpen
                ? 'transition-colors hover:text-blue-600'
                : ''
            }`}
          >
            {label}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={
              onToggle
            }
            disabled={
              busy
            }
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label={
              visible
                ? `Ocultar ${label}`
                : `Exibir ${label}`
            }
            title={
              visible
                ? 'Ocultar no mapa'
                : 'Exibir no mapa'
            }
          >
            {visible ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={
              onDelete
            }
            disabled={
              busy
            }
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            aria-label={`Excluir ${label}`}
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

function MoveRecordToMission({
  missions,
  currentMissionId,
  onMove,
}) {
  const [
    destination,
    setDestination,
  ] = useState(
    '',
  );

  const [
    moving,
    setMoving,
  ] = useState(
    false,
  );

  const destinations =
    missions.filter(
      (mission) =>
        mission.id !==
        currentMissionId,
    );

  const hasDestinations =
    destinations.length >
    0;

  async function handleMove() {
    if (
      !destination ||
      moving
    ) {
      return;
    }

    try {
      setMoving(
        true,
      );

      await onMove?.(
        destination ===
          '__unassigned__'
          ? null
          : destination,
      );

      setDestination(
        '',
      );
    } finally {
      setMoving(
        false,
      );
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-border bg-background/70 p-2">
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        Mover para
      </p>

      <div className="flex gap-1.5">
        <select
          value={
            destination
          }
          onChange={(event) =>
            setDestination(
              event.target
                .value,
            )
          }
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[10px]"
        >
          <option value="">
            Selecione...
          </option>

          <option value="__unassigned__">
            Sem missão
          </option>

          {hasDestinations &&
            destinations.map(
              (mission) => (
                <option
                  key={
                    mission.id
                  }
                  value={
                    mission.id
                  }
                >
                  {mission.name}
                </option>
              ),
            )}
        </select>

        <button
          type="button"
          disabled={
            !destination ||
            moving
          }
          onClick={
            handleMove
          }
          className="rounded-md bg-blue-600 px-3 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {moving
            ? 'Movendo...'
            : 'Mover'}
        </button>
      </div>
    </div>
  );
}

export default function FieldMissionPanel({
  missionState,
  getMissionRecords,
  onCreateMission,
  onSetActiveMission,
  onClearActiveMission,
  onToggleMissionVisibility,
  onToggleTrailVisibility,
  onTogglePointVisibility,
  onMoveTrailToMission,
  onMovePointToMission,
  onDeleteTrail,
  onDeletePoint,
  onDeleteMission,
}) {
  const [
    createOpen,
    setCreateOpen,
  ] = useState(false);

  const [
    expandedMissionIds,
    setExpandedMissionIds,
  ] = useState(
    () =>
      new Set(),
  );

  const [
    name,
    setName,
  ] = useState('');

  const [
    description,
    setDescription,
  ] = useState('');

  const [
    busyMissionId,
    setBusyMissionId,
  ] = useState(null);

  const [
    actionError,
    setActionError,
  ] = useState(null);

  const [
    actionMessage,
    setActionMessage,
  ] = useState(null);

  const [
    selectedTrailId,
    setSelectedTrailId,
  ] = useState(
    null,
  );

  const [
    selectedPointId,
    setSelectedPointId,
  ] = useState(
    null,
  );

  const [
    exportMissionId,
    setExportMissionId,
  ] = useState(
    null,
  );

  const missions =
    Array.isArray(
      missionState
        ?.missions,
    )
      ? missionState.missions
      : [];

  const visibleMissionsCount =
    useMemo(
      () =>
        missions.filter(
          (mission) =>
            mission.visible !==
            false,
        ).length,
      [
        missions,
      ],
    );

  function clearFeedback() {
    setActionError(
      null,
    );

    setActionMessage(
      null,
    );
  }

  function handleExportMissionGeoJSON(
    mission,
  ) {
    try {
      clearFeedback();

      const content =
        FieldController
          .exportGeoJSON({
            missionId:
              mission.id,
          });

      const name =
        slugifyFieldExportName(
          mission.name ||
          'missao',
        );

      downloadFieldExport({
        content,

        filename:
          `geofogo-missao-${name}-${getFieldExportDateStamp()}.geojson`,

        mimeType:
          'application/geo+json',
      });

      setExportMissionId(
        null,
      );

      setActionMessage(
        `Missão “${mission.name}” exportada em GeoJSON.`,
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível exportar a missão em GeoJSON.',
      );
    }
  }

  function handleExportMissionGPX(
    mission,
  ) {
    try {
      clearFeedback();

      const content =
        FieldController
          .exportGPX({
            missionId:
              mission.id,
          });

      const name =
        slugifyFieldExportName(
          mission.name ||
          'missao',
        );

      downloadFieldExport({
        content,

        filename:
          `geofogo-missao-${name}-${getFieldExportDateStamp()}.gpx`,

        mimeType:
          'application/gpx+xml',
      });

      setExportMissionId(
        null,
      );

      setActionMessage(
        `Missão “${mission.name}” exportada em GPX.`,
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível exportar a missão em GPX.',
      );
    }
  }

  function toggleMissionExpanded(
    missionId,
  ) {
    setExpandedMissionIds(
      (current) => {
        const next =
          new Set(
            current,
          );

        if (
          next.has(
            missionId,
          )
        ) {
          next.delete(
            missionId,
          );
        } else {
          next.add(
            missionId,
          );
        }

        return next;
      },
    );
  }

  async function handleCreateMission() {
    clearFeedback();

    const normalizedName =
      name.trim();

    if (!normalizedName) {
      setActionError(
        'Informe o nome da missão.',
      );

      return;
    }

    try {
      setBusyMissionId(
        'creating',
      );

      const mission =
        await onCreateMission?.({
          name:
            normalizedName,

          description:
            description.trim(),
        });

      setName(
        '',
      );

      setDescription(
        '',
      );

      setCreateOpen(
        false,
      );

      setActionMessage(
        mission?.name
          ? `Missão “${mission.name}” criada e ativada.`
          : 'Missão criada e ativada.',
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível criar a missão.',
      );
    } finally {
      setBusyMissionId(
        null,
      );
    }
  }

  async function handleActivateMission(
    mission,
  ) {
    if (!mission?.id) {
      return;
    }

    clearFeedback();

    try {
      setBusyMissionId(
        mission.id,
      );

      await onSetActiveMission?.(
        mission.id,
      );

      setActionMessage(
        `Missão “${mission.name}” definida como ativa.`,
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível ativar a missão.',
      );
    } finally {
      setBusyMissionId(
        null,
      );
    }
  }

  async function handleToggleVisibility(
    mission,
  ) {
    if (!mission?.id) {
      return;
    }

    clearFeedback();

    try {
      setBusyMissionId(
        mission.id,
      );

      await onToggleMissionVisibility?.(
        mission.id,
      );

      setActionMessage(
        mission.visible ===
          false
          ? `Missão “${mission.name}” exibida.`
          : `Missão “${mission.name}” ocultada.`,
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível alterar a visibilidade.',
      );
    } finally {
      setBusyMissionId(
        null,
      );
    }
  }

  async function handleToggleTrailVisibility(
    trail,
  ) {
    if (!trail?.id) {
      return;
    }

    clearFeedback();

    try {
      setBusyMissionId(
        `trail:${trail.id}`,
      );

      await onToggleTrailVisibility?.(
        trail.id,
      );

      setActionMessage(
        trail.visible ===
          false
          ? 'Trilho exibido.'
          : 'Trilho ocultado.',
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível alterar a visibilidade do trilho.',
      );
    } finally {
      setBusyMissionId(
        null,
      );
    }
  }

  async function handleTogglePointVisibility(
    point,
  ) {
    if (!point?.id) {
      return;
    }

    clearFeedback();

    try {
      setBusyMissionId(
        `point:${point.id}`,
      );

      await onTogglePointVisibility?.(
        point.id,
      );

      const visible =
        (
          point.visible ??
          point.properties
            ?.visible
        ) !==
        false;

      setActionMessage(
        visible
          ? 'Marcador ocultado.'
          : 'Marcador exibido.',
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível alterar a visibilidade do marcador.',
      );
    } finally {
      setBusyMissionId(
        null,
      );
    }
  }

  async function handleDeleteTrail(
    trail,
  ) {
    if (!trail?.id) {
      return;
    }

    const confirmed =
      window.confirm(
        `Excluir o trilho “${trail.name || 'Trilho sem nome'}”?\n\n` +
          'Os marcadores vinculados serão preservados.',
      );

    if (!confirmed) {
      return;
    }

    clearFeedback();

    try {
      setBusyMissionId(
        `trail:${trail.id}`,
      );

      await onDeleteTrail?.(
        trail.id,
      );

      setActionMessage(
        'Trilho excluído.',
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível excluir o trilho.',
      );
    } finally {
      setBusyMissionId(
        null,
      );
    }
  }

  async function handleDeletePoint(
    point,
  ) {
    if (!point?.id) {
      return;
    }

    const label =
      point.properties
        ?.label ||
      getMarkerCategoryLabel(
        point.properties
          ?.category,
      );

    const confirmed =
      window.confirm(
        `Excluir o marcador “${label || 'Marcador'}”?`,
      );

    if (!confirmed) {
      return;
    }

    clearFeedback();

    try {
      setBusyMissionId(
        `point:${point.id}`,
      );

      await onDeletePoint?.(
        point.id,
      );

      setActionMessage(
        'Marcador excluído.',
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível excluir o marcador.',
      );
    } finally {
      setBusyMissionId(
        null,
      );
    }
  }

  async function handleDeleteMission(
    mission,
  ) {
    if (!mission?.id) {
      return;
    }

    const confirmed =
      window.confirm(
        `Excluir a missão “${mission.name}”?\n\n` +
          'Nesta etapa, os trilhos e marcadores vinculados não serão apagados.',
      );

    if (!confirmed) {
      return;
    }

    clearFeedback();

    try {
      setBusyMissionId(
        mission.id,
      );

      await onDeleteMission?.(
        mission.id,
      );

      setActionMessage(
        `Missão “${mission.name}” excluída.`,
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível excluir a missão.',
      );
    } finally {
      setBusyMissionId(
        null,
      );
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 p-3">
        <div>
          <p className="text-xs font-semibold">
            Missões
          </p>

          <p className="mt-0.5 text-[9px] text-muted-foreground">
            {missions.length ===
            0
              ? 'Nenhuma missão criada'
              : `${visibleMissionsCount} visível(is) de ${missions.length}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            clearFeedback();

            setCreateOpen(
              (current) =>
                !current,
            );
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-[10px] font-semibold text-white transition-colors hover:bg-orange-700"
        >
          <Plus className="h-3.5 w-3.5" />

          Nova missão
        </button>
      </div>

      {createOpen && (
        <div className="space-y-3 border-t border-border p-3">
          <div>
            <label
              htmlFor="field-mission-name"
              className="mb-1.5 block text-[10px] font-semibold text-muted-foreground"
            >
              Nome da missão
            </label>

            <input
              id="field-mission-name"
              type="text"
              value={
                name
              }
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              placeholder="Ex.: Incêndio Serra da Meruoca"
              maxLength={120}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
            />
          </div>

          <div>
            <label
              htmlFor="field-mission-description"
              className="mb-1.5 block text-[10px] font-semibold text-muted-foreground"
            >
              Descrição
            </label>

            <textarea
              id="field-mission-description"
              value={
                description
              }
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              placeholder="Descrição opcional"
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(
                  false,
                );

                setName(
                  '',
                );

                setDescription(
                  '',
                );

                clearFeedback();
              }}
              disabled={
                busyMissionId ===
                'creating'
              }
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={
                handleCreateMission
              }
              disabled={
                busyMissionId ===
                'creating'
              }
              className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {busyMissionId ===
              'creating'
                ? 'Criando...'
                : 'Criar missão'}
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold">
            Missões salvas
          </p>

          <span className="text-[9px] text-muted-foreground">
            {visibleMissionsCount} visível(is) de {missions.length}
          </span>
        </div>

        {missions.length ===
        0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center">
            <Briefcase className="mx-auto h-5 w-5 text-muted-foreground" />

            <p className="mt-2 text-[10px] font-semibold">
              Nenhuma missão criada
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={
                onClearActiveMission
              }
              className={`mb-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                !missionState
                  ?.activeMissionId
                  ? 'border-orange-500 bg-orange-500/5'
                  : 'border-border bg-background hover:bg-accent/30'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  !missionState
                    ?.activeMissionId
                    ? 'border-orange-600 bg-orange-600 text-white'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {!missionState
                  ?.activeMissionId && (
                  <Check className="h-3.5 w-3.5" />
                )}
              </span>

              <span className="min-w-0">
                <span className="block text-[10px] font-semibold">
                  Sem missão ativa
                </span>

                <span className="mt-0.5 block text-[9px] text-muted-foreground">
                  Novos registros serão criados como avulsos.
                </span>
              </span>
            </button>
            {missions.map(
              (mission) => {
                const isActive =
                  mission.id ===
                  missionState
                    ?.activeMissionId;

                const isBusy =
                  busyMissionId ===
                  mission.id;

                const expanded =
                  expandedMissionIds.has(
                    mission.id,
                  );

                const records =
                  getMissionRecords?.(
                    mission.id,
                  ) || {
                    trails: [],
                    points: [],
                  };

                const trails =
                  Array.isArray(
                    records.trails,
                  )
                    ? records.trails
                    : [];

                const points =
                  Array.isArray(
                    records.points,
                  )
                    ? records.points
                    : [];

                return (
                  <article
                    key={
                      mission.id
                    }
                    className={`rounded-lg border p-2.5 ${
                      isActive
                        ? 'border-orange-500 bg-orange-500/5'
                        : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          toggleMissionExpanded(
                            mission.id,
                          )
                        }
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-expanded={
                          expanded
                        }
                        aria-label={
                          expanded
                            ? `Recolher ${mission.name}`
                            : `Expandir ${mission.name}`
                        }
                      >
                        {expanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleActivateMission(
                            mission,
                          )
                        }
                        disabled={
                          isBusy ||
                          isActive
                        }
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          isActive
                            ? 'border-orange-600 bg-orange-600 text-white'
                            : 'border-border text-muted-foreground hover:bg-accent'
                        }`}
                        aria-label={`Ativar missão ${mission.name}`}
                        title={
                          isActive
                            ? 'Missão ativa'
                            : 'Definir como ativa'
                        }
                      >
                        {isActive && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-semibold">
                          {mission.name}
                        </p>

                        <p className="mt-0.5 text-[9px] text-muted-foreground">
                          {formatMissionDate(
                            mission.startedAt,
                          )}
                        </p>

                        <p className="mt-0.5 text-[9px] text-muted-foreground">
                          {trails.length}{' '}
                          {trails.length === 1
                            ? 'trilho'
                            : 'trilhos'}
                          {' · '}
                          {points.length}{' '}
                          {points.length === 1
                            ? 'marcador'
                            : 'marcadores'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          clearFeedback();

                          setExportMissionId(
                            (current) =>
                              current ===
                              mission.id
                                ? null
                                : mission.id,
                          );
                        }}
                        disabled={
                          isBusy
                        }
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-50 ${
                          exportMissionId ===
                          mission.id
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                        aria-label={`Exportar missão ${mission.name}`}
                        title="Exportar missão"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleVisibility(
                            mission,
                          )
                        }
                        disabled={
                          isBusy
                        }
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                        aria-label={
                          mission.visible !==
                          false
                            ? `Ocultar missão ${mission.name}`
                            : `Exibir missão ${mission.name}`
                        }
                        title={
                          mission.visible !==
                          false
                            ? 'Ocultar missão'
                            : 'Exibir missão'
                        }
                      >
                        {mission.visible !==
                        false ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteMission(
                            mission,
                          )
                        }
                        disabled={
                          isBusy
                        }
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        aria-label={`Excluir missão ${mission.name}`}
                        title="Excluir missão"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {mission.description && (
                      <p className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-muted-foreground">
                        {mission.description}
                      </p>
                    )}

                    {exportMissionId ===
                      mission.id && (
                      <div className="mt-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
                        <div className="mb-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Exportar missão
                          </p>

                          <p className="mt-0.5 text-[9px] text-muted-foreground">
                            {trails.length}{' '}
                            {trails.length === 1
                              ? 'trilho'
                              : 'trilhos'}
                            {' · '}
                            {points.length}{' '}
                            {points.length === 1
                              ? 'marcador'
                              : 'marcadores'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleExportMissionGeoJSON(
                                mission,
                              )
                            }
                            disabled={
                              trails.length ===
                                0 &&
                              points.length ===
                                0
                            }
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <FileJson className="h-3.5 w-3.5" />

                            GeoJSON
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleExportMissionGPX(
                                mission,
                              )
                            }
                            disabled={
                              trails.length ===
                                0 &&
                              points.length ===
                                0
                            }
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />

                            GPX
                          </button>
                        </div>
                      </div>
                    )}

                    {expanded && (
                      <div className="mt-2 space-y-3 border-t border-border/70 pt-2">
                        <MissionRecordGroup
                          title="Trilhos"
                          icon={Route}
                          emptyMessage="Nenhum trilho nesta missão."
                        >
                          {trails.map(
                            (trail) => {
                              const selected =
                                selectedTrailId ===
                                trail.id;

                              return (
                                <MissionRecordRow
                                  key={
                                    trail.id
                                  }
                                  label={
                                    trail.name ||
                                    'Trilho sem nome'
                                  }
                                  visible={
                                    trail.visible !==
                                    false
                                  }
                                  busy={
                                    busyMissionId ===
                                    `trail:${trail.id}`
                                  }
                                  expanded={
                                    selected
                                  }
                                  onOpen={() => {
                                    setSelectedPointId(
                                      null,
                                    );

                                    setSelectedTrailId(
                                      selected
                                        ? null
                                        : trail.id,
                                    );
                                  }}
                                  onToggle={() =>
                                    handleToggleTrailVisibility(
                                      trail,
                                    )
                                  }
                                  onDelete={() =>
                                    handleDeleteTrail(
                                      trail,
                                    )
                                  }
                                >
                                  <FieldTrailDetails
                                    trail={
                                      trail
                                    }
                                    embedded
                                  />

                                  <div className="px-3 pb-3">
                                    <MoveRecordToMission
                                      missions={
                                        missions
                                      }
                                      currentMissionId={
                                        mission.id
                                      }
                                      onMove={async (
                                        destinationMissionId,
                                      ) => {
                                        await onMoveTrailToMission?.(
                                          trail.id,
                                          destinationMissionId,
                                        );

                                        setSelectedTrailId(
                                          null,
                                        );
                                      }}
                                    />
                                  </div>
                                </MissionRecordRow>
                              );
                            },
                          )}
                        </MissionRecordGroup>

                        <MissionRecordGroup
                          title="Marcadores"
                          icon={MapPin}
                          emptyMessage="Nenhum marcador nesta missão."
                        >
                          {points.map(
                            (point) => {
                              const properties =
                                point.properties ||
                                {};

                              const label =
                                properties.label ||
                                getMarkerCategoryLabel(
                                  properties.category,
                                );

                              const visible =
                                (
                                  point.visible ??
                                  properties.visible
                                ) !==
                                false;

                              const selected =
                                selectedPointId ===
                                point.id;

                              return (
                                <MissionRecordRow
                                  key={
                                    point.id
                                  }
                                  label={
                                    label ||
                                    'Marcador'
                                  }
                                  visible={
                                    visible
                                  }
                                  busy={
                                    busyMissionId ===
                                    `point:${point.id}`
                                  }
                                  expanded={
                                    selected
                                  }
                                  onOpen={() => {
                                    setSelectedTrailId(
                                      null,
                                    );

                                    setSelectedPointId(
                                      selected
                                        ? null
                                        : point.id,
                                    );
                                  }}
                                  onToggle={() =>
                                    handleTogglePointVisibility(
                                      point,
                                    )
                                  }
                                  onDelete={() =>
                                    handleDeletePoint(
                                      point,
                                    )
                                  }
                                >
                                  <FieldPointDetails
                                    point={
                                      point
                                    }
                                    embedded
                                  />

                                  <div className="px-3 pb-3">
                                    <MoveRecordToMission
                                      missions={
                                        missions
                                      }
                                      currentMissionId={
                                        mission.id
                                      }
                                      onMove={async (
                                        destinationMissionId,
                                      ) => {
                                        await onMovePointToMission?.(
                                          point.id,
                                          destinationMissionId,
                                        );

                                        setSelectedPointId(
                                          null,
                                        );
                                      }}
                                    />
                                  </div>
                                </MissionRecordRow>
                              );
                            },
                          )}
                        </MissionRecordGroup>
                      </div>
                    )}
                  </article>
                );
              },
            )}
          </div>
        )}
      </div>

      {actionMessage && (
        <div className="border-t border-border bg-green-500/10 px-3 py-2 text-[10px] text-green-700 dark:text-green-300">
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="border-t border-border bg-destructive/10 px-3 py-2 text-[10px] text-destructive">
          {actionError}
        </div>
      )}
    </section>
  );
}