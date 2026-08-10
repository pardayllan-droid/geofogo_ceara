/**
 * FieldActiveMissionCard
 *
 * Resumo informativo do destino dos novos registros
 * criados durante a operação de campo.
 *
 * A escolha da missão ativa é realizada exclusivamente
 * na aba Missões.
 */

import {
  Briefcase,
  FolderOpen,
} from 'lucide-react';

export default function FieldActiveMissionCard({
  missionState,
  onOpenMissions,
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
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Missão
          </p>

          <p className="mt-0.5 truncate text-xs font-semibold">
            {activeMission
              ? activeMission.name
              : 'Nenhuma missão ativa'}
          </p>

          <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">
            {activeMission
              ? 'Novos trilhos e marcadores serão vinculados a esta missão.'
              : 'Novos trilhos e marcadores serão salvos em Sem missão.'}
          </p>
        </div>

        <button
          type="button"
          onClick={
            onOpenMissions
          }
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Abrir Missões"
          aria-label="Abrir Missões"
        >
          <FolderOpen className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}