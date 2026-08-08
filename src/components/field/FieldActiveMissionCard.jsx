/**
 * FieldActiveMissionCard
 *
 * Resumo do destino dos novos registros criados
 * durante a operação de campo.
 */

import {
  Briefcase,
  FolderOpen,
  X,
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
      <div className="flex items-start gap-3">
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

              <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">
                Novos trilhos e marcadores serão vinculados a esta missão.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs font-semibold">
                Sem missão ativa
              </p>

              <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">
                Novos trilhos e marcadores serão salvos na aba Sem missão.
              </p>
            </>
          )}
        </div>
      </div>

      <div
        className={`mt-3 grid gap-2 ${
          activeMission
            ? 'grid-cols-2'
            : 'grid-cols-1'
        }`}
      >
        <button
          type="button"
          onClick={
            onOpenMissions
          }
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent"
        >
          <FolderOpen className="h-3.5 w-3.5" />

          {activeMission
            ? 'Trocar missão'
            : 'Selecionar ou criar missão'}
        </button>

        {activeMission && (
          <button
            type="button"
            onClick={
              onClearActiveMission
            }
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" />

            Sem missão
          </button>
        )}
      </div>
    </section>
  );
}