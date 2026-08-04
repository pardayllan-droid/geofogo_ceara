/**
 * FieldMarkerForm
 *
 * Formulário de criação de marcadores do módulo Campo.
 *
 * Um marcador pode:
 * - utilizar a posição GPS atual;
 * - utilizar uma coordenada informada manualmente;
 * - existir independentemente de um trilho;
 * - ser opcionalmente vinculado ao trilho atual.
 *
 * Nesta primeira etapa:
 * - posição atual está funcional;
 * - formatos manuais já estão organizados na interface;
 * - conversão e pré-visualização manual entram na próxima etapa.
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Crosshair,
  MapPin,
  Plus,
  Search,
} from 'lucide-react';

import {
  useState,
} from 'react';

import {
  FIELD_POINT_CATEGORY,
} from '../../field/FieldPointModel';

const LOCATION_MODE = {
  CURRENT:
    'current-position',

  MANUAL:
    'manual-coordinate',
};

const COORDINATE_FORMAT = {
  DECIMAL:
    'decimal-degrees',

  AUTO:
    'auto-detect',

  DMS:
    'degrees-minutes-seconds',

  UTM:
    'utm',
};

const CATEGORY_OPTIONS = [
  {
    value:
      FIELD_POINT_CATEGORY.ACTIVE_FIRE,

    label:
      'Foco ativo',
  },
  {
    value:
      FIELD_POINT_CATEGORY.VEHICLE,

    label:
      'Viatura',
  },
  {
    value:
      FIELD_POINT_CATEGORY.WATER_SOURCE,

    label:
      'Ponto d’água',
  },
  {
    value:
      FIELD_POINT_CATEGORY.BLOCKAGE,

    label:
      'Bloqueio',
  },
  {
    value:
      FIELD_POINT_CATEGORY.RISK,

    label:
      'Área de risco',
  },
  {
    value:
      FIELD_POINT_CATEGORY.SERVICE,

    label:
      'Atendimento',
  },
  {
    value:
      FIELD_POINT_CATEGORY.OBSERVATION,

    label:
      'Observação',
  },
];

const COORDINATE_FORMAT_OPTIONS = [
  {
    value:
      COORDINATE_FORMAT.DECIMAL,

    label:
      'Graus decimais',

    example:
      '-5.12653, -39.28416',
  },
  {
    value:
      COORDINATE_FORMAT.AUTO,

    label:
      'Copiar e colar',

    example:
      'Detecção automática de DD, GMS ou UTM',
  },
  {
    value:
      COORDINATE_FORMAT.DMS,

    label:
      'Graus, minutos e segundos — GMS',

    example:
      '5°07’35”S, 39°17’03”W',
  },
  {
    value:
      COORDINATE_FORMAT.UTM,

    label:
      'UTM',

    example:
      '24S 468250 9423100',
  },
];

export default function FieldMarkerForm({
  currentPositionAvailable =
    false,

  trailOpen =
    false,

  onCreateCurrentPosition,
}) {
  const [
    open,
    setOpen,
  ] = useState(
    false,
  );

  const [
    category,
    setCategory,
  ] = useState(
    FIELD_POINT_CATEGORY.OBSERVATION,
  );

  const [
    locationMode,
    setLocationMode,
  ] = useState(
    LOCATION_MODE.CURRENT,
  );

  const [
    coordinateFormat,
    setCoordinateFormat,
  ] = useState(
    COORDINATE_FORMAT.DECIMAL,
  );

  const [
    label,
    setLabel,
  ] = useState(
    '',
  );

  const [
    observation,
    setObservation,
  ] = useState(
    '',
  );

  const [
    linkToActiveTrail,
    setLinkToActiveTrail,
  ] = useState(
    false,
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

  function resetFeedback() {
    setActionError(
      null,
    );

    setActionMessage(
      null,
    );
  }

  function handleToggle() {
    resetFeedback();

    setOpen(
      (current) =>
        !current,
    );
  }

  function handleLocationModeChange(
    nextMode,
  ) {
    resetFeedback();

    setLocationMode(
      nextMode,
    );
  }

  function handleCreateCurrentPosition() {
    resetFeedback();

    if (
      !currentPositionAvailable
    ) {
      setActionError(
        'A posição GPS atual ainda não está disponível.',
      );

      return;
    }

    try {
      onCreateCurrentPosition?.(
        label,
        observation,
        {
          category,

          linkToActiveTrail:
            linkToActiveTrail &&
            trailOpen,
        },
      );

      setLabel(
        '',
      );

      setObservation(
        '',
      );

      setActionMessage(
        linkToActiveTrail &&
          trailOpen
          ? 'Marcador criado e vinculado ao trilho.'
          : 'Marcador independente criado.',
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível criar o marcador.',
      );
    }
  }

  const selectedFormat =
    COORDINATE_FORMAT_OPTIONS.find(
      (option) =>
        option.value ===
        coordinateFormat,
    );

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={
          handleToggle
        }
        aria-expanded={
          open
        }
        className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-accent/30"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
          <Plus className="h-4 w-4 text-blue-600" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            Novo marcador
          </p>

          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Criar pela posição atual ou informar coordenadas
          </p>
        </div>

        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div>
            <label
              htmlFor="field-marker-category"
              className="mb-1.5 block text-[10px] font-semibold text-muted-foreground"
            >
              Tipo
            </label>

            <select
              id="field-marker-category"
              value={
                category
              }
              onChange={(event) => {
                resetFeedback();

                setCategory(
                  event.target.value,
                );
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
            >
              {CATEGORY_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-[10px] font-semibold text-muted-foreground">
              Localização
            </legend>

            <div className="grid grid-cols-2 gap-2">
              <LocationModeButton
                active={
                  locationMode ===
                  LOCATION_MODE.CURRENT
                }
                icon={
                  Crosshair
                }
                label="Posição atual"
                onClick={() =>
                  handleLocationModeChange(
                    LOCATION_MODE.CURRENT,
                  )
                }
              />

              <LocationModeButton
                active={
                  locationMode ===
                  LOCATION_MODE.MANUAL
                }
                icon={
                  Search
                }
                label="Procurar um lugar"
                onClick={() =>
                  handleLocationModeChange(
                    LOCATION_MODE.MANUAL,
                  )
                }
              />
            </div>
          </fieldset>

          {locationMode ===
            LOCATION_MODE.CURRENT && (
            <CurrentPositionFields
              label={
                label
              }
              observation={
                observation
              }
              setLabel={
                setLabel
              }
              setObservation={
                setObservation
              }
              currentPositionAvailable={
                currentPositionAvailable
              }
              trailOpen={
                trailOpen
              }
              linkToActiveTrail={
                linkToActiveTrail
              }
              setLinkToActiveTrail={
                setLinkToActiveTrail
              }
              onCreate={
                handleCreateCurrentPosition
              }
            />
          )}

          {locationMode ===
            LOCATION_MODE.MANUAL && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="field-marker-coordinate-format"
                  className="mb-1.5 block text-[10px] font-semibold text-muted-foreground"
                >
                  Formato da coordenada
                </label>

                <select
                  id="field-marker-coordinate-format"
                  value={
                    coordinateFormat
                  }
                  onChange={(event) => {
                    resetFeedback();

                    setCoordinateFormat(
                      event.target.value,
                    );
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
                >
                  {COORDINATE_FORMAT_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>

                <p className="mt-1 text-[9px] text-muted-foreground">
                  Exemplo: {selectedFormat?.example}
                </p>
              </div>

              <ManualCoordinatePlaceholder
                coordinateFormat={
                  coordinateFormat
                }
              />
            </div>
          )}

          {actionMessage && (
            <div className="rounded-lg bg-green-500/10 px-3 py-2 text-[10px] text-green-700 dark:text-green-300">
              {actionMessage}
            </div>
          )}

          {actionError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-[10px] text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

              <span>
                {actionError}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LocationModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-center transition-colors ${
        active
          ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
          : 'border-border bg-background text-muted-foreground hover:bg-accent'
      }`}
    >
      <Icon className="h-4 w-4" />

      <span className="text-[10px] font-semibold">
        {label}
      </span>
    </button>
  );
}

function CurrentPositionFields({
  label,
  observation,
  setLabel,
  setObservation,
  currentPositionAvailable,
  trailOpen,
  linkToActiveTrail,
  setLinkToActiveTrail,
  onCreate,
}) {
  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] ${
          currentPositionAvailable
            ? 'bg-green-500/10 text-green-700 dark:text-green-300'
            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
        }`}
      >
        <Crosshair className="h-3.5 w-3.5 shrink-0" />

        {currentPositionAvailable
          ? 'Posição GPS disponível'
          : 'Aguardando posição GPS'}
      </div>

      <input
        type="text"
        value={
          label
        }
        onChange={(event) =>
          setLabel(
            event.target.value,
          )
        }
        placeholder="Nome do marcador (opcional)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
      />

      <textarea
        value={
          observation
        }
        onChange={(event) =>
          setObservation(
            event.target.value,
          )
        }
        placeholder="Descrição (opcional)"
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
      />

      <label className="flex items-start gap-2 rounded-lg bg-accent/30 px-2.5 py-2">
        <input
          type="checkbox"
          checked={
            linkToActiveTrail
          }
          disabled={
            !trailOpen
          }
          onChange={(event) =>
            setLinkToActiveTrail(
              event.target.checked,
            )
          }
          className="mt-0.5"
        />

        <span className="text-[10px] leading-relaxed">
          Vincular ao trilho atual

          {!trailOpen && (
            <span className="block text-muted-foreground">
              Nenhum trilho aberto
            </span>
          )}
        </span>
      </label>

      <button
        type="button"
        onClick={
          onCreate
        }
        disabled={
          !currentPositionAvailable
        }
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MapPin className="h-4 w-4" />

        Criar marcador
      </button>
    </div>
  );
}

function ManualCoordinatePlaceholder({
  coordinateFormat,
}) {
  const pasteMode =
    coordinateFormat ===
    COORDINATE_FORMAT.AUTO;

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center">
      {pasteMode ? (
        <ClipboardPaste className="mx-auto h-5 w-5 text-muted-foreground" />
      ) : (
        <MapPin className="mx-auto h-5 w-5 text-muted-foreground" />
      )}

      <p className="mt-2 text-[10px] font-semibold">
        Entrada manual preparada
      </p>

      <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
        Os campos, a conversão, a validação e a pré-visualização no mapa serão
        adicionados na próxima etapa.
      </p>
    </div>
  );
}