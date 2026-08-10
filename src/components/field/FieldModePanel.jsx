/**
 * FieldModePanel
 *
 * Área operacional de campo organizada em três abas:
 *
 * - Campo:
 *   GPS, missão ativa, gravação e criação de marcadores.
 *
 * - Missões:
 *   gestor dos registros organizados por missão.
 *
 * - Sem missão:
 *   gestor dos registros avulsos.
 */

import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Crosshair,
  FolderOpen,
  Navigation,
  Pause,
  Play,
  Satellite,
  Square,
} from 'lucide-react';

import {
  useState,
} from 'react';

import FieldActiveMissionCard from './FieldActiveMissionCard';
import FieldGpsCard from './FieldGpsCard';
import FieldMarkerForm from './FieldMarkerForm';
import FieldMissionPanel from './FieldMissionPanel';
import FieldTrailStartForm from './FieldTrailStartForm';
import FieldUnassignedPanel from './FieldUnassignedPanel';

export default function FieldModePanel({
  fieldState,
  missionState,

  getMissionRecords,
  getUnassignedRecords,

  onStart,
  onStop,

  onToggleRecord,
  onFinishTrail,

  onAddPoint,
  onAddPointAtCoordinates,

  onToggleTrailVisibility,
  onTogglePointVisibility,

  onMoveTrailToMission,
  onMovePointToMission,

  onDeleteTrail,
  onDeletePoint,

  onCreateMission,
  onSetActiveMission,
  onClearActiveMission,
  onToggleMissionVisibility,
  onDeleteMission,
}) {
  const [
    activeTab,
    setActiveTab,
  ] = useState(
    'field',
  );

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

  const trailExists =
    Boolean(
      fieldState
        ?.currentTrail,
    );

  const trailCompleted =
    fieldState
      ?.trailStatus ===
    'completed';

  const trailOpen =
    trailExists &&
    !trailCompleted;

  const hasCurrentPosition =
    Boolean(
      fieldState
        ?.currentPosition,
    );

  const missionsCount =
    Array.isArray(
      missionState
        ?.missions,
    )
      ? missionState
          .missions
          .length
      : 0;

  const unassignedRecords =
    getUnassignedRecords?.() || {
      trails: [],
      points: [],
    };

  const unassignedCount =
    (
      unassignedRecords
        .trails
        ?.length ||
      0
    ) +
    (
      unassignedRecords
        .points
        ?.length ||
      0
    );

  function clearFeedback() {
    setActionError(
      null,
    );

    setActionMessage(
      null,
    );
  }

  async function handleStartFieldMode() {
    clearFeedback();

    try {
      await onStart?.();
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível ativar o Modo Campo.',
      );
    }
  }

  async function handleStopFieldMode() {
    clearFeedback();

    try {
      await onStop?.();
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível encerrar o Modo Campo.',
      );
    }
  }

  async function handleToggleTrail(
    options =
      {},
  ) {
    clearFeedback();

    try {
      await onToggleRecord?.(
        options,
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível alterar o estado do trilho.',
      );
    }
  }

  async function handleFinishTrail() {
    clearFeedback();

    try {
      await onFinishTrail?.();

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

  return (
    <div className="flex min-h-full flex-col">
      <PanelHeader
        recording={
          fieldState
            ?.recording
        }
        activeTab={
          activeTab
        }
        missionsCount={
          missionsCount
        }
        unassignedCount={
          unassignedCount
        }
        onSelectTab={
          setActiveTab
        }
        onStop={
          fieldState
            ?.active
            ? handleStopFieldMode
            : null
        }
      />
      <div className="space-y-3 p-3">
        {activeTab ===
          'field' && (
          <>
            {!fieldState
              ?.active ? (
              <FieldActivation
                error={
                  actionError
                }
                onStart={
                  handleStartFieldMode
                }
              />
            ) : (
              <>
                <FieldGpsCard
                  fieldState={
                    fieldState
                  }
                />

                <FieldActiveMissionCard
                  missionState={
                    missionState
                  }
                  onOpenMissions={() =>
                    setActiveTab(
                      'missions',
                    )
                  }
                />

                {trailOpen ? (
                  <TrailControls
                    fieldState={
                      fieldState
                    }
                    onToggle={
                      handleToggleTrail
                    }
                    onFinish={
                      handleFinishTrail
                    }
                  />
                ) : (
                  <FieldTrailStartForm
                    onStartTrail={
                      handleToggleTrail
                    }
                  />
                )}

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
                  onCreateAtCoordinates={
                    onAddPointAtCoordinates
                  }
                />
              </>
            )}
          </>
        )}

        {activeTab ===
          'missions' && (
          <FieldMissionPanel
            missionState={
              missionState
            }
            getMissionRecords={
              getMissionRecords
            }
            onCreateMission={
              onCreateMission
            }
            onSetActiveMission={
              onSetActiveMission
            }
            onClearActiveMission={
              onClearActiveMission
            }
            onToggleMissionVisibility={
              onToggleMissionVisibility
            }
            onToggleTrailVisibility={
              onToggleTrailVisibility
            }
            onTogglePointVisibility={
              onTogglePointVisibility
            }
            onMoveTrailToMission={
              onMoveTrailToMission
            }
            onMovePointToMission={
              onMovePointToMission
            }
            onDeleteTrail={
              onDeleteTrail
            }
            onDeletePoint={
              onDeletePoint
            }
            onDeleteMission={
              onDeleteMission
            }
          />
        )}

        {activeTab ===
          'unassigned' && (
          <FieldUnassignedPanel
            getUnassignedRecords={
              getUnassignedRecords
            }
            onToggleTrailVisibility={
              onToggleTrailVisibility
            }
            onTogglePointVisibility={
              onTogglePointVisibility
            }
            missionState={
              missionState
            }
            onMoveTrailToMission={
              onMoveTrailToMission
            }
            onMovePointToMission={
              onMovePointToMission
            }
            onDeleteTrail={
              onDeleteTrail
            }
            onDeletePoint={
              onDeletePoint
            }
          />
        )}

        {actionMessage && (
          <FeedbackMessage
            type="success"
            message={
              actionMessage
            }
          />
        )}

        {actionError &&
          fieldState
            ?.active && (
          <FeedbackMessage
            type="error"
            message={
              actionError
            }
          />
        )}
      </div>
    </div>
  );
}

function FieldActivation({
  error,
  onStart,
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
        <Navigation className="h-7 w-7 text-blue-500" />
      </div>

      <h3 className="text-sm font-semibold">
        Coleta de campo
      </h3>

      <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Ative o GPS para registrar trilhos, criar marcadores e acompanhar sua
        posição durante uma operação.
      </p>

      <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-muted-foreground">
        Missões e registros armazenados podem ser
        gerenciados mesmo com o GPS desligado.
      </p>

      {error && (
        <FeedbackMessage
          type="error"
          message={
            error
          }
        />
      )}

      <button
        type="button"
        onClick={
          onStart
        }
        className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
      >
        <Satellite className="h-4 w-4" />

        Ativar Modo Campo
      </button>
    </div>
  );
}

function TrailControls({
  fieldState,
  onToggle,
  onFinish,
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Trilho atual
        </p>

        <p className="mt-1 truncate text-xs font-semibold">
          {fieldState
            ?.currentTrail
            ?.name ||
            'Trilho sem nome'}
        </p>

        <p className="mt-0.5 text-[9px] text-muted-foreground">
          {fieldState
            ?.recording
            ? 'Gravando'
            : 'Pausado'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={
            onToggle
          }
          className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
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
            ? 'Pausar'
            : 'Retomar'}
        </button>

        <button
          type="button"
          onClick={
            onFinish
          }
          className="flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/15"
        >
          <Square className="h-3.5 w-3.5" />

          Finalizar
        </button>
      </div>
    </section>
  );
}

function PanelHeader({
  recording = false,
  activeTab = 'field',
  missionsCount = 0,
  unassignedCount = 0,
  onSelectTab = null,
  onStop = null,
}) {
  return (
    <div className="flex flex-shrink-0 items-center border-b border-border bg-card/95 px-2 py-2">
      {/*
       * Metade esquerda:
       * Encerrar primeiro, conforme definido,
       * seguido da identidade visual do módulo Campo.
       */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {onStop ? (
          <button
            type="button"
            onClick={
              onStop
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
            title="Encerrar Modo Campo e desligar GPS"
            aria-label="Encerrar Modo Campo"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span
            className="h-8 w-8 shrink-0"
            aria-hidden="true"
          />
        )}

        <div
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white-500/10"
          title="Modo Campo"
          aria-label="Modo Campo"
        >
          <Navigation className="h-4 w-4 text-blue-500" /> 
          
          {recording && (
            <span
              className="absolute right-0.5 top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"
              title="Gravando trilho"
            />
          )}
        </div>
      </div>

      {/*
       * Metade direita:
       * navegação interna do módulo Campo.
       */}
      <nav
        className="grid min-w-0 flex-1 grid-cols-3 gap-1"
        aria-label="Seções do Modo Campo"
      >
        <HeaderTabButton
          active={
            activeTab ===
            'field'
          }
          icon={
            Crosshair
          }
          label="Campo"
          onClick={() =>
            onSelectTab?.(
              'field',
            )
          }
        />

        <HeaderTabButton
          active={
            activeTab ===
            'missions'
          }
          icon={
            Briefcase
          }
          label="Missões"
          badge={
            missionsCount
          }
          onClick={() =>
            onSelectTab?.(
              'missions',
            )
          }
        />

        <HeaderTabButton
          active={
            activeTab ===
            'unassigned'
          }
          icon={
            FolderOpen
          }
          label="Sem missão"
          badge={
            unassignedCount
          }
          onClick={() =>
            onSelectTab?.(
              'unassigned',
            )
          }
        />
      </nav>
    </div>
  );
}

function HeaderTabButton({
  active,
  icon: Icon,
  label,
  badge = 0,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      title={
        label
      }
      aria-label={
        badge > 0
          ? `${label}: ${badge}`
          : label
      }
      aria-current={
        active
          ? 'page'
          : undefined
      }
      className={`relative flex h-8 min-w-0 items-center justify-center rounded-lg transition-colors ${
        active
          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />

      {badge > 0 && (
        <span className="absolute right-0.5 top-0.5 flex min-h-3.5 min-w-3.5 items-center justify-center rounded-full bg-muted px-0.5 text-[7px] font-bold leading-none text-muted-foreground">
          {badge > 99
            ? '99+'
            : badge}
        </span>
      )}
    </button>
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