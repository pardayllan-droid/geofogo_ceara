/**
 * FieldGpsCard
 *
 * Exibe o estado do GPS e as opções relacionadas
 * exclusivamente ao acompanhamento da posição.
 */

import {
  Radio,
  Satellite,
} from 'lucide-react';

import {
  FieldController,
} from '../../field/FieldController';

function formatMeters(
  value,
) {
  const numeric =
    Number(
      value,
    );

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

export default function FieldGpsCard({
  fieldState,
}) {
  const available =
    Boolean(
      fieldState
        ?.currentPosition,
    );

  const backgroundSupported =
    Boolean(
      fieldState
        ?.supportsBackgroundTracking,
    );

  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            available
              ? 'bg-green-500/10'
              : 'bg-amber-500/10'
          }`}
        >
          {available ? (
            <Radio className="h-4 w-4 text-green-600" />
          ) : (
            <Satellite className="h-4 w-4 animate-pulse text-amber-600" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            {available
              ? 'GPS disponível'
              : 'Aguardando posição GPS'}
          </p>

          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Provedor:{' '}
            {fieldState
              ?.locationProvider ||
              '—'}
          </p>

          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Precisão atual:{' '}
            {formatMeters(
              fieldState
                ?.currentAccuracy,
            )}
          </p>

          <p
            className={`mt-1 text-[9px] ${
              backgroundSupported
                ? 'text-green-600'
                : 'text-amber-600'
            }`}
          >
            {backgroundSupported
              ? 'Rastreamento em segundo plano disponível'
              : 'Rastreamento em segundo plano indisponível nesta plataforma'}
          </p>
        </div>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-accent/20 px-3 py-2.5">
        <input
          type="checkbox"
          checked={
            Boolean(
              fieldState
                ?.followPosition,
            )
          }
          onChange={(event) => {
            FieldController
              .setFollowPosition(
                event.target
                  .checked,
              );
          }}
          className="mt-0.5"
        />

        <span className="min-w-0">
          <span className="block text-[10px] font-semibold">
            Centralizar automaticamente
          </span>

          <span className="mt-0.5 block text-[9px] leading-relaxed text-muted-foreground">
            Mantém o mapa acompanhando sua posição enquanto o Modo Campo estiver ativo.
          </span>
        </span>
      </label>

      {fieldState
        ?.locationError && (
        <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">
          {
            fieldState
              .locationError
          }
        </p>
      )}
    </section>
  );
}