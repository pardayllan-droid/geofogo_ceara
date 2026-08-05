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
  useEffect,
  useState,
} from 'react';

import {
  FIELD_POINT_CATEGORY,
} from '../../field/FieldPointModel';

import {
  FIELD_MARKER_ICON,
  FIELD_MARKER_SIZE,
  getMarkerStylePreset,
  normalizeMarkerStyle,
} from '../../field/FieldStyles';

import {
  EventBus,
  EVENTS,
} from '../../core/EventBus';

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

const MARKER_ICON_OPTIONS = [
  {
    value:
      FIELD_MARKER_ICON.FLAME,

    label:
      'Chama',
  },
  {
    value:
      FIELD_MARKER_ICON.VEHICLE,

    label:
      'Viatura',
  },
  {
    value:
      FIELD_MARKER_ICON.WATER,

    label:
      'Ponto d’água',
  },
  {
    value:
      FIELD_MARKER_ICON.BLOCKAGE,

    label:
      'Bloqueio',
  },
  {
    value:
      FIELD_MARKER_ICON.RISK,

    label:
      'Área de risco',
  },
  {
    value:
      FIELD_MARKER_ICON.SERVICE,

    label:
      'Atendimento',
  },
  {
    value:
      FIELD_MARKER_ICON.OBSERVATION,

    label:
      'Observação',
  },
];

const MARKER_SIZE_OPTIONS = [
  {
    value:
      FIELD_MARKER_SIZE.SMALL,

    label:
      'Pequeno',
  },
  {
    value:
      FIELD_MARKER_SIZE.MEDIUM,

    label:
      'Médio',
  },
  {
    value:
      FIELD_MARKER_SIZE.LARGE,

    label:
      'Grande',
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

  onCreateAtCoordinates,
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
    useDefaultStyle,
    setUseDefaultStyle,
  ] = useState(
    true,
  );

  const [
    markerStyle,
    setMarkerStyle,
  ] = useState(
    () =>
      getMarkerStylePreset(
        FIELD_POINT_CATEGORY.OBSERVATION,
      ),
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

  const [
    decimalLatitude,
    setDecimalLatitude,
  ] = useState('');

  const [
    decimalLongitude,
    setDecimalLongitude,
  ] = useState('');

  const [
    locatedCoordinate,
    setLocatedCoordinate,
  ] = useState(null);

  /**
   * Enquanto o usuário estiver usando o padrão do tipo,
   * a aparência acompanha automaticamente a categoria.
   */
  useEffect(
    () => {
      if (
        !useDefaultStyle
      ) {
        return;
      }

      setMarkerStyle(
        getMarkerStylePreset(
          category,
        ),
      );
    },
    [
      category,
      useDefaultStyle,
    ],
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

  function handleDefaultStyleChange(
    enabled,
  ) {
    resetFeedback();

    setUseDefaultStyle(
      enabled,
    );

    if (enabled) {
      setMarkerStyle(
        getMarkerStylePreset(
          category,
        ),
      );
    }
  }

  function updateMarkerStyle(
    key,
    value,
  ) {
    resetFeedback();

    setMarkerStyle(
      (current) => ({
        ...current,

        /**
         * Um estilo modificado deixa de representar
         * exclusivamente o preset original.
         */
        preset:
          'custom',

        [key]:
          value,
      }),
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

          style:
            normalizeMarkerStyle(
              useDefaultStyle
                ? getMarkerStylePreset(
                    category,
                  )
                : markerStyle,
              category,
            ),

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

  function parseCoordinateNumber(
    value,
  ) {
    const normalized =
      String(
        value ??
        '',
      )
        .trim()
        .replace(
          ',',
          '.',
        );

    const numeric =
      Number(
        normalized,
      );

    return Number.isFinite(
      numeric,
    )
      ? numeric
      : null;
  }

  function handleLocateDecimalCoordinate() {
    resetFeedback();

    const latitude =
      parseCoordinateNumber(
        decimalLatitude,
      );

    const longitude =
      parseCoordinateNumber(
        decimalLongitude,
      );

    if (
      latitude ===
        null ||
      longitude ===
        null
    ) {
      setActionError(
        'Informe latitude e longitude válidas.',
      );

      return;
    }

    if (
      latitude <
        -90 ||
      latitude >
        90
    ) {
      setActionError(
        'A latitude deve estar entre -90 e 90.',
      );

      return;
    }

    if (
      longitude <
        -180 ||
      longitude >
        180
    ) {
      setActionError(
        'A longitude deve estar entre -180 e 180.',
      );

      return;
    }

    const coordinate = {
      latitude,
      longitude,
    };

    setLocatedCoordinate(
      coordinate,
    );

    EventBus.emit(
      EVENTS.MAP_PREVIEW_FIELD_MARKER,
      coordinate,
    );

    setActionMessage(
      'Coordenada localizada. Confira a posição no mapa antes de criar.',
    );
  }

  function handleCancelLocatedCoordinate() {
    setLocatedCoordinate(
      null,
    );

    setActionMessage(
      null,
    );

    EventBus.emit(
      EVENTS.MAP_CLEAR_FIELD_MARKER_PREVIEW,
    );
  }

  function handleCreateLocatedCoordinate() {
    resetFeedback();

    if (!locatedCoordinate) {
      setActionError(
        'Localize a coordenada antes de criar o marcador.',
      );

      return;
    }

    try {
      const trailId =
        linkToActiveTrail &&
        trailOpen
          ? null
          : null;

      onCreateAtCoordinates?.({
        longitude:
          locatedCoordinate.longitude,

        latitude:
          locatedCoordinate.latitude,

        label,
        observation,
        category,

        /**
         * Use estas propriedades caso a personalização
         * visual já tenha sido aplicada no seu arquivo.
         */
        style:
          typeof normalizeMarkerStyle ===
            'function'
            ? normalizeMarkerStyle(
                useDefaultStyle
                  ? getMarkerStylePreset(
                      category,
                    )
                  : markerStyle,
                category,
              )
            : undefined,

        originalCoordinateFormat:
          COORDINATE_FORMAT.DECIMAL,

        trailId,
      });

      EventBus.emit(
        EVENTS.MAP_CLEAR_FIELD_MARKER_PREVIEW,
      );

      setLocatedCoordinate(
        null,
      );

      setDecimalLatitude(
        '',
      );

      setDecimalLongitude(
        '',
      );

      setLabel(
        '',
      );

      setObservation(
        '',
      );

      setActionMessage(
        'Marcador criado na coordenada informada.',
      );
    } catch (error) {
      setActionError(
        error?.message ||
          'Não foi possível criar o marcador.',
      );
    }
  }

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

          <MarkerStyleEditor
            category={
              category
            }
            useDefaultStyle={
              useDefaultStyle
            }
            markerStyle={
              markerStyle
            }
            onDefaultStyleChange={
              handleDefaultStyleChange
            }
            onStyleChange={
              updateMarkerStyle
            }
          />

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

              {coordinateFormat ===
                COORDINATE_FORMAT.DECIMAL ? (
                <DecimalCoordinateFields
                  latitude={
                    decimalLatitude
                  }
                  longitude={
                    decimalLongitude
                  }
                  locatedCoordinate={
                    locatedCoordinate
                  }
                  onLatitudeChange={
                    setDecimalLatitude
                  }
                  onLongitudeChange={
                    setDecimalLongitude
                  }
                  onLocate={
                    handleLocateDecimalCoordinate
                  }
                  onCreate={
                    handleCreateLocatedCoordinate
                  }
                  onCancel={
                    handleCancelLocatedCoordinate
                  }
                />
              ) : (
                <ManualCoordinatePlaceholder
                  coordinateFormat={
                    coordinateFormat
                  }
                />
              )}
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

function MarkerStyleEditor({
  category,
  useDefaultStyle,
  markerStyle,
  onDefaultStyleChange,
  onStyleChange,
}) {
  const effectiveStyle =
    useDefaultStyle
      ? getMarkerStylePreset(
          category,
        )
      : markerStyle;

  const selectedIcon =
    MARKER_ICON_OPTIONS.find(
      (option) =>
        option.value ===
        effectiveStyle.iconId,
    );

  const selectedSize =
    MARKER_SIZE_OPTIONS.find(
      (option) =>
        option.value ===
        effectiveStyle.size,
    );

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-white text-[9px] font-bold text-white shadow-sm"
          style={{
            backgroundColor:
              effectiveStyle.color,
          }}
          title={
            selectedIcon?.label ||
            'Marcador'
          }
        >
          {getIconAbbreviation(
            effectiveStyle.iconId,
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold">
            Aparência
          </p>

          <p className="mt-0.5 text-[9px] text-muted-foreground">
            {selectedIcon?.label ||
              'Ícone padrão'}
            {' · '}
            {selectedSize?.label ||
              'Médio'}
          </p>
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={
            useDefaultStyle
          }
          onChange={(event) =>
            onDefaultStyleChange(
              event.target.checked,
            )
          }
        />

        <span className="text-[10px]">
          Usar aparência padrão do tipo
        </span>
      </label>

      {!useDefaultStyle && (
        <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
          <div>
            <label
              htmlFor="field-marker-icon"
              className="mb-1 block text-[9px] font-semibold text-muted-foreground"
            >
              Ícone
            </label>

            <select
              id="field-marker-icon"
              value={
                markerStyle.iconId
              }
              onChange={(event) =>
                onStyleChange(
                  'iconId',
                  event.target.value,
                )
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
            >
              {MARKER_ICON_OPTIONS.map(
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

          <div>
            <label
              htmlFor="field-marker-color"
              className="mb-1 block text-[9px] font-semibold text-muted-foreground"
            >
              Cor
            </label>

            <div className="flex items-center gap-2">
              <input
                id="field-marker-color"
                type="color"
                value={
                  markerStyle.color
                }
                onChange={(event) =>
                  onStyleChange(
                    'color',
                    event.target.value,
                  )
                }
                className="h-9 w-12 cursor-pointer rounded-md border border-border bg-background p-1"
              />

              <input
                type="text"
                value={
                  markerStyle.color
                }
                onChange={(event) =>
                  onStyleChange(
                    'color',
                    event.target.value,
                  )
                }
                maxLength={7}
                placeholder="#dc2626"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs uppercase"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="field-marker-size"
              className="mb-1 block text-[9px] font-semibold text-muted-foreground"
            >
              Tamanho
            </label>

            <select
              id="field-marker-size"
              value={
                markerStyle.size
              }
              onChange={(event) =>
                onStyleChange(
                  'size',
                  event.target.value,
                )
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
            >
              {MARKER_SIZE_OPTIONS.map(
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
        </div>
      )}
    </div>
  );
}

function getIconAbbreviation(
  iconId,
) {
  switch (iconId) {
    case FIELD_MARKER_ICON.FLAME:
      return 'FOGO';

    case FIELD_MARKER_ICON.VEHICLE:
      return 'VTR';

    case FIELD_MARKER_ICON.WATER:
      return 'ÁGUA';

    case FIELD_MARKER_ICON.BLOCKAGE:
      return 'BLQ';

    case FIELD_MARKER_ICON.RISK:
      return 'RISCO';

    case FIELD_MARKER_ICON.SERVICE:
      return 'ATD';

    case FIELD_MARKER_ICON.OBSERVATION:
    default:
      return 'OBS';
  }
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

function DecimalCoordinateFields({
  latitude,
  longitude,
  locatedCoordinate,
  onLatitudeChange,
  onLongitudeChange,
  onLocate,
  onCreate,
  onCancel,
}) {
  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="field-marker-decimal-latitude"
          className="mb-1.5 block text-[10px] font-semibold text-muted-foreground"
        >
          Latitude
        </label>

        <input
          id="field-marker-decimal-latitude"
          type="text"
          inputMode="decimal"
          value={
            latitude
          }
          onChange={(event) =>
            onLatitudeChange(
              event.target.value,
            )
          }
          placeholder="-5.12653"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
        />
      </div>

      <div>
        <label
          htmlFor="field-marker-decimal-longitude"
          className="mb-1.5 block text-[10px] font-semibold text-muted-foreground"
        >
          Longitude
        </label>

        <input
          id="field-marker-decimal-longitude"
          type="text"
          inputMode="decimal"
          value={
            longitude
          }
          onChange={(event) =>
            onLongitudeChange(
              event.target.value,
            )
          }
          placeholder="-39.28416"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
        />
      </div>

      {!locatedCoordinate ? (
        <button
          type="button"
          onClick={
            onLocate
          }
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Search className="h-4 w-4" />

          Procurar
        </button>
      ) : (
        <div className="space-y-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <p className="text-[10px] font-semibold text-green-700 dark:text-green-300">
            Coordenada localizada
          </p>

          <p className="text-[10px] text-muted-foreground">
            Latitude:{' '}
            {locatedCoordinate.latitude.toFixed(
              6,
            )}
          </p>

          <p className="text-[10px] text-muted-foreground">
            Longitude:{' '}
            {locatedCoordinate.longitude.toFixed(
              6,
            )}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={
                onCancel
              }
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={
                onCreate
              }
              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700"
            >
              Criar marcador
            </button>
          </div>
        </div>
      )}
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