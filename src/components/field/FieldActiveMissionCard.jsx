/**
 * FieldActiveMissionCard
 *
 * Mostra de forma compacta o destino dos novos
 * registros criados no Modo Campo.
 */

import {
  ArrowLeftRight,
  Briefcase,
  FolderOpen,
  Unlink,
} from 'lucide-react';

export default function FieldActiveMissionCard({
  missionState,

  onOpenMissions,
  onClearActiveMission,
}) {
  const activeMission =
    missionState
      ?.activeMission ||
    null;

  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
          <Briefcase className="h-4 w-4 text-orange-600" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Missão ativa
          </p>

          <p className="mt-0.5 truncate text-xs font-semibold">
            {activeMission
              ?.name ||
              'Sem missão ativa'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={
              onOpenMissions
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={
              activeMission
                ? 'Trocar missão'
                : 'Selecionar ou criar missão'
            }
            aria-label={
              activeMission
                ? 'Trocar missão'
                : 'Selecionar ou criar missão'
            }
          >
            {activeMission ? (
              <ArrowLeftRight className="h-4 w-4" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
          </button>

          {activeMission && (
            <button
              type="button"
              onClick={
                onClearActiveMission
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Ficar sem missão ativa"
              aria-label="Ficar sem missão ativa"
            >
              <Unlink className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}