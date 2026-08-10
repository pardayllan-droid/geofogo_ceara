/**
 * FieldUnassignedPanel
 *
 * Gestor dos registros que não pertencem a nenhuma
 * missão operacional.
 */

import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  MapPin,
  Route,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import FieldTrailDetails from './FieldTrailDetails';
import FieldPointDetails from './FieldPointDetails';

export default function FieldUnassignedPanel({
  missionState,
  getUnassignedRecords,
  onToggleTrailVisibility,
  onTogglePointVisibility,
  onMoveTrailToMission,
  onMovePointToMission,
  onDeleteTrail,
  onDeletePoint,
}) {
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
  const records =
    getUnassignedRecords?.() || {
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

  const missions =
    Array.isArray(
      missionState
        ?.missions,
    )
      ? missionState.missions
      : [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold">
          Sem missão
        </h3>

        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Registros criados enquanto nenhuma missão estava ativa.
        </p>
      </div>

      <RecordGroup
        icon={
          Route
        }
        title="Trilhos"
        emptyMessage="Nenhum trilho sem missão."
      >
        {trails.map(
          (trail) => {
            const selected =
              selectedTrailId ===
              trail.id;

            return (
              <RecordRow
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
                  onToggleTrailVisibility?.(
                    trail.id,
                  )
                }
                onDelete={() => {
                  const confirmed =
                    window.confirm(
                      `Excluir definitivamente o trilho “${trail.name || 'Trilho sem nome'}”?`,
                    );

                  if (confirmed) {
                    onDeleteTrail?.(
                      trail.id,
                    );

                    if (selected) {
                      setSelectedTrailId(
                        null,
                      );
                    }
                  }
                }}
              >
                <FieldTrailDetails
                  trail={
                    trail
                  }
                  embedded
                />

                <div className="px-3 pb-3">
                  <MoveToMission
                    missions={
                      missions
                    }
                    onMove={async (
                      missionId,
                    ) => {
                      await onMoveTrailToMission?.(
                        trail.id,
                        missionId,
                      );

                      setSelectedTrailId(
                        null,
                      );
                    }}
                  />
                </div>
              </RecordRow>
            );
          },
        )}
      </RecordGroup>

      <RecordGroup
        icon={
          MapPin
        }
        title="Marcadores"
        emptyMessage="Nenhum marcador sem missão."
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
              <RecordRow
                key={
                  point.id
                }
                label={
                  label
                }
                visible={
                  visible
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
                  onTogglePointVisibility?.(
                    point.id,
                  )
                }
                onDelete={() => {
                  const confirmed =
                    window.confirm(
                      `Excluir definitivamente o marcador “${label}”?`,
                    );

                  if (confirmed) {
                    onDeletePoint?.(
                      point.id,
                    );

                    if (selected) {
                      setSelectedPointId(
                        null,
                      );
                    }
                  }
                }}
              >
                <FieldPointDetails
                  point={
                    point
                  }
                  embedded
                />

                <div className="px-3 pb-3">
                  <MoveToMission
                    missions={
                      missions
                    }
                    onMove={async (
                      missionId,
                    ) => {
                      await onMovePointToMission?.(
                        point.id,
                        missionId,
                      );

                      setSelectedPointId(
                        null,
                      );
                    }}
                  />
                </div>
              </RecordRow>
            );
          },
        )}
      </RecordGroup>
    </div>
  );
}

function RecordGroup({
  icon: Icon,
  title,
  emptyMessage,
  children,
}) {
  const count =
    Array.isArray(
      children,
    )
      ? children.length
      : children
        ? 1
        : 0;

  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>

        <span className="ml-auto text-[9px] text-muted-foreground">
          {count}
        </span>
      </div>

      {count >
      0 ? (
        <div className="space-y-1">
          {children}
        </div>
      ) : (
        <p className="rounded-lg bg-accent/20 px-3 py-3 text-center text-[10px] text-muted-foreground">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

function RecordRow({
  label,
  visible,
  expanded,
  onOpen,
  onToggle,
  onDelete,
  children,
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-background">
      <div className="flex min-w-0 items-center gap-2 px-2.5 py-2">
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
          className={`flex min-w-0 flex-1 items-center gap-2 text-left text-[10px] ${
            visible
              ? 'text-foreground'
              : 'text-muted-foreground'
          } ${
            onOpen
              ? 'cursor-pointer'
              : 'cursor-default'
          }`}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}

          <span
            className={`min-w-0 flex-1 truncate ${
              onOpen
                ? 'transition-colors hover:text-blue-600'
                : ''
            }`}
          >
            {label}
          </span>
        </button>

        <button
          type="button"
          onClick={
            onToggle
          }
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={
            visible
              ? 'Ocultar no mapa'
              : 'Exibir no mapa'
          }
          aria-label={
            visible
              ? `Ocultar ${label}`
              : `Exibir ${label}`
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
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Excluir definitivamente"
          aria-label={`Excluir ${label}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

function MoveToMission({
  missions,
  onMove,
}) {
  const [
    selectedMissionId,
    setSelectedMissionId,
  ] = useState(
    '',
  );

  const [
    moving,
    setMoving,
  ] = useState(
    false,
  );

  if (
    missions.length ===
    0
  ) {
    return null;
  }

  async function handleMove() {
    if (
      !selectedMissionId ||
      moving
    ) {
      return;
    }

    try {
      setMoving(
        true,
      );

      await onMove?.(
        selectedMissionId,
      );

      setSelectedMissionId(
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
        Mover para missão
      </p>

      <div className="flex gap-1.5">
        <select
          value={
            selectedMissionId
          }
          onChange={(
            event,
          ) =>
            setSelectedMissionId(
              event.target
                .value,
            )
          }
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[10px]"
        >
          <option value="">
            Selecione...
          </option>

          {missions.map(
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
            !selectedMissionId ||
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