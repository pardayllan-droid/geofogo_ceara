/**
 * FieldModePanel
 *
 * Orquestrador visual do módulo Campo.
 *
 * Responsabilidades:
 * - ativar/encerrar o Modo Campo;
 * - organizar os cartões operacionais;
 * - encaminhar ações para os componentes especializados.
 *
 * Regras de GPS, trilhos, missões, marcadores e
 * exportações ficam fora deste componente.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Satellite,
  Square,
} from 'lucide-react';

import {
  useState,
} from 'react';

import FieldExportCard from './FieldExportCard';
import FieldGpsCard from './FieldGpsCard';
import FieldMarkerForm from './FieldMarkerForm';
import FieldMissionPanel from './FieldMissionPanel';
import FieldTrailCard from './FieldTrailCard';
import FieldTrailStartForm from './FieldTrailStartForm';

export default function FieldModePanel({
  fieldState,
  missionState,
  getMissionRecords,

  onStart,
  onStop,

  onToggleRecord,
  onFinishTrail,

  onAddPoint,
  onAddPointAtCoordinates,

  onCreateMission,
  onSetActiveMission,
  onToggleMissionVisibility,
  onDeleteMission,
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
            Ative o GPS para registrar trilhos, criar marcadores e acompanhar
            sua posição durante uma operação.
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
          fieldState
            .recording
        }
        onStop={
          handleStopFieldMode
        }
      />

      <div className="space-y-3 p-3">
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
          onToggleMissionVisibility={
            onToggleMissionVisibility
          }
          onDeleteMission={
            onDeleteMission
          }
        />

        <FieldGpsCard
          fieldState={
            fieldState
          }
        />

        <FieldTrailCard
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

        {!trailOpen && (
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

        <FieldExportCard
          onError={
            setActionError
          }
        />

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