/**
 * FieldGpsCard
 *
 * Exibe de forma compacta:
 * - disponibilidade do GPS;
 * - provedor;
 * - precisão;
 * - capacidade de segundo plano;
 * - opção "Seguir", que controla a centralização automática.
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

  const followPosition =
    Boolean(
      fieldState
        ?.followPosition,
    );

  const backgroundSupported =
    Boolean(
      fieldState
        ?.supportsBackgroundTracking,
    );

  function handleToggleFollow() {
    FieldController
      .setFollowPosition(
        !followPosition,
      );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
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

          <p className="mt-0.5 text-[9px] text-muted-foreground">
            Precisão:{' '}
            {formatMeters(
              fieldState
                ?.currentAccuracy,
            )}
            {' · '}
            {fieldState
              ?.locationProvider ||
              'provedor indefinido'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[9px] font-semibold text-muted-foreground">
            Seguir
          </span>

          <button
            type="button"
            role="switch"
            aria-checked={
              followPosition
            }
            aria-label="Centralizar automaticamente na posição atual"
            title="Centralizar automaticamente"
            onClick={
              handleToggleFollow
            }
            className={`relative h-5 w-9 rounded-full transition-colors ${
              followPosition
                ? 'bg-blue-600'
                : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                followPosition
                  ? 'translate-x-[18px]'
                  : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      <p
        className={`mt-2 text-[9px] ${
          backgroundSupported
            ? 'text-green-600'
            : 'text-amber-600'
        }`}
      >
        {backgroundSupported
          ? 'Rastreamento em segundo plano disponível'
          : 'Rastreamento em segundo plano indisponível nesta plataforma'}
      </p>

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