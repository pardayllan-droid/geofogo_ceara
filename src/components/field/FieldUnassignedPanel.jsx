/**
 * FieldUnassignedPanel
 *
 * Gestor dos registros que não pertencem a nenhuma
 * missão operacional.
 */

import {
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
  getUnassignedRecords,

  onToggleTrailVisibility,
  onTogglePointVisibility,

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
              <div
                key={
                  trail.id
                }
              >
                <RecordRow
                  label={
                    trail.name ||
                    'Trilho sem nome'
                  }
                  visible={
                    trail.visible !==
                    false
                  }
                  onOpen={() =>
                    setSelectedTrailId(
                      selected
                        ? null
                        : trail.id,
                    )
                  }
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
                />

                {selected && (
                  <FieldTrailDetails
                    trail={
                      trail
                    }
                    onClose={() =>
                      setSelectedTrailId(
                        null,
                      )
                    }
                  />
                )}
              </div>
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
              <div
                key={
                  point.id
                }
              >
                <RecordRow
                  label={
                    label
                  }
                  visible={
                    visible
                  }
                  onOpen={() =>
                    setSelectedPointId(
                      selected
                        ? null
                        : point.id,
                    )
                  }
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
                />

                {selected && (
                  <FieldPointDetails
                    point={
                      point
                    }
                    onClose={() =>
                      setSelectedPointId(
                        null,
                      )
                    }
                  />
                )}
              </div>
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
  onOpen,
  onToggle,
  onDelete,
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-accent/20 px-2.5 py-2">
      <button
        type="button"
        onClick={
          onOpen
        }
        disabled={
          !onOpen
        }
        className={`min-w-0 flex-1 truncate text-left text-[10px] ${
          visible
            ? 'text-foreground'
            : 'text-muted-foreground'
        } ${
          onOpen
            ? 'cursor-pointer hover:text-blue-600'
            : 'cursor-default'
        }`}
      >
        {label}
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
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
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