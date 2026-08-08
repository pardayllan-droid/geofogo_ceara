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
  ChevronUp,
  Eye,
  EyeOff,
  MapPin,
  Plus,
  Route,
  Trash2,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

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
  switch (category) {
    case 'fire':
      return 'Foco';
    case 'water':
      return 'Água';
    case 'base':
      return 'Base';
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
  onToggle,
  onDelete,
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-background px-2.5 py-2">
      <p className="min-w-0 flex-1 truncate text-[9px] font-medium">
        {label}
      </p>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
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
          onClick={onDelete}
          disabled={busy}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          aria-label={`Excluir ${label}`}
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
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
  onDeleteTrail,
  onDeletePoint,
  onDeleteMission,
}) {
  const [
    createOpen,
    setCreateOpen,
  ] = useState(false);

  const [
    managerOpen,
    setManagerOpen,
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

  const missions =
    Array.isArray(
      missionState
        ?.missions,
    )
      ? missionState.missions
      : [];

  const activeMission =
    missionState
      ?.activeMission ||
    null;

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
      <div className="flex items-start gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
          <Briefcase className="h-4 w-4 text-orange-600" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Missão ativa
          </p>

          {activeMission ? (
            <>
              <p className="mt-1 truncate text-xs font-semibold">
                {activeMission.name}
              </p>

              <p className="mt-0.5 text-[9px] text-muted-foreground">
                Iniciada em{' '}
                {formatMissionDate(
                  activeMission.startedAt,
                )}
              </p>

              {activeMission.description && (
                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                  {activeMission.description}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-xs font-semibold">
                Nenhuma missão ativa
              </p>

              <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">
                Trilhos e marcadores novos serão criados como registros
                avulsos.
              </p>
            </>
          )}
        </div>

        {activeMission && (
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${
              activeMission.visible !==
              false
                ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {activeMission.visible !==
            false
              ? 'Visível'
              : 'Oculta'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
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

        <button
          type="button"
          onClick={() => {
            clearFeedback();

            setManagerOpen(
              (current) =>
                !current,
            );
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent"
        >
          Gerenciar

          {managerOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
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

      {managerOpen && (
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

                      {expanded && (
                        <div className="mt-2 space-y-3 border-t border-border/70 pt-2">
                          <MissionRecordGroup
                            title="Trilhos"
                            icon={Route}
                            emptyMessage="Nenhum trilho nesta missão."
                          >
                            {trails.map((trail) => (
                              <MissionRecordRow
                                key={trail.id}
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
                              />
                            ))}
                          </MissionRecordGroup>

                          <MissionRecordGroup
                            title="Marcadores"
                            icon={MapPin}
                            emptyMessage="Nenhum marcador nesta missão."
                          >
                            {points.map((point) => {
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

                              return (
                                <MissionRecordRow
                                  key={point.id}
                                  label={
                                    label ||
                                    'Marcador'
                                  }
                                  visible={visible}
                                  busy={
                                    busyMissionId ===
                                    `point:${point.id}`
                                  }
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
                                />
                              );
                            })}
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
      )}

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