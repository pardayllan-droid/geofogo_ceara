/**
 * FieldTrailStartForm
 *
 * Configuração visual e identificação de um novo trilho.
 *
 * Permite definir:
 * - nome opcional;
 * - cor;
 * - espessura;
 * - opacidade;
 * - padrão contínuo ou tracejado.
 */

import {
  ChevronDown,
  ChevronUp,
  Route,
} from 'lucide-react';

import {
  useState,
} from 'react';

import {
  DEFAULT_TRAIL_STYLE,
  FIELD_TRAIL_PATTERN,
  normalizeTrailStyle,
} from '../../field/FieldStyles';

const TRAIL_COLOR_OPTIONS = [
  {
    label: 'Verde',
    value: '#16a34a',
  },
  {
    label: 'Azul',
    value: '#2563eb',
  },
  {
    label: 'Vermelho',
    value: '#dc2626',
  },
  {
    label: 'Laranja',
    value: '#f97316',
  },
  {
    label: 'Amarelo',
    value: '#eab308',
  },
  {
    label: 'Roxo',
    value: '#7c3aed',
  },
  {
    label: 'Cinza',
    value: '#64748b',
  },
];

const TRAIL_WIDTH_OPTIONS = [
  {
    label: 'Fino',
    value: 2,
  },
  {
    label: 'Médio',
    value: 4,
  },
  {
    label: 'Grosso',
    value: 7,
  },
];

export default function FieldTrailStartForm({
  onStartTrail,
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    name,
    setName,
  ] = useState('');

  const [
    style,
    setStyle,
  ] = useState({
    ...DEFAULT_TRAIL_STYLE,
  });

  const [
    error,
    setError,
  ] = useState(null);

  function updateStyle(
    property,
    value,
  ) {
    setError(null);

    setStyle(
      (current) => ({
        ...current,
        [property]: value,
      }),
    );
  }

  function handleStart() {
    setError(null);

    try {
      const normalizedStyle =
        normalizeTrailStyle(
          style,
        );

      onStartTrail?.({
        name:
          name.trim() ||
          null,

        style:
          normalizedStyle,
      });

      setOpen(false);
      setName('');

      setStyle({
        ...DEFAULT_TRAIL_STYLE,
      });
    } catch (caughtError) {
      setError(
        caughtError?.message ||
          'Não foi possível iniciar o trilho.',
      );
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() =>
          setOpen(true)
        }
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
      >
        <Route className="h-4 w-4" />

        Iniciar trilho

        <ChevronDown className="ml-auto h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() =>
          setOpen(false)
        }
        aria-expanded="true"
        className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-accent/30"
      >
        <Route className="h-4 w-4 text-green-600" />

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            Novo trilho
          </p>

          <p className="text-[10px] text-muted-foreground">
            Defina o nome e a aparência
          </p>
        </div>

        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="space-y-3 border-t border-border px-3 py-3">
        <div>
          <label
            htmlFor="field-trail-name"
            className="mb-1.5 block text-[10px] font-semibold text-muted-foreground"
          >
            Nome
          </label>

          <input
            id="field-trail-name"
            type="text"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value,
              )
            }
            placeholder="Nome do trilho (opcional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
          />
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold text-muted-foreground">
            Cor
          </p>

          <div className="grid grid-cols-7 gap-1.5">
            {TRAIL_COLOR_OPTIONS.map(
              (option) => {
                const selected =
                  style.color ===
                  option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updateStyle(
                        'color',
                        option.value,
                      )
                    }
                    aria-label={`Usar cor ${option.label}`}
                    title={option.label}
                    className={`h-8 rounded-md border-2 transition-transform ${
                      selected
                        ? 'scale-110 border-foreground'
                        : 'border-white/80'
                    }`}
                    style={{
                      backgroundColor:
                        option.value,
                    }}
                  />
                );
              },
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={style.color}
              onChange={(event) =>
                updateStyle(
                  'color',
                  event.target.value,
                )
              }
              aria-label="Selecionar outra cor"
              className="h-9 w-12 cursor-pointer rounded-md border border-border bg-background p-1"
            />

            <input
              type="text"
              value={style.color}
              maxLength={7}
              onChange={(event) =>
                updateStyle(
                  'color',
                  event.target.value,
                )
              }
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs uppercase"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="field-trail-width"
            className="mb-1.5 block text-[10px] font-semibold text-muted-foreground"
          >
            Espessura
          </label>

          <select
            id="field-trail-width"
            value={style.width}
            onChange={(event) =>
              updateStyle(
                'width',
                Number(
                  event.target.value,
                ),
              )
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
          >
            {TRAIL_WIDTH_OPTIONS.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label
              htmlFor="field-trail-opacity"
              className="text-[10px] font-semibold text-muted-foreground"
            >
              Opacidade
            </label>

            <span className="text-[10px] text-muted-foreground">
              {Math.round(
                style.opacity *
                  100,
              )}
              %
            </span>
          </div>

          <input
            id="field-trail-opacity"
            type="range"
            min="0.3"
            max="1"
            step="0.05"
            value={style.opacity}
            onChange={(event) =>
              updateStyle(
                'opacity',
                Number(
                  event.target.value,
                ),
              )
            }
            className="w-full"
          />
        </div>

        <div>
          <label
            htmlFor="field-trail-pattern"
            className="mb-1.5 block text-[10px] font-semibold text-muted-foreground"
          >
            Tipo de linha
          </label>

          <select
            id="field-trail-pattern"
            value={style.linePattern}
            onChange={(event) =>
              updateStyle(
                'linePattern',
                event.target.value,
              )
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-xs"
          >
            <option
              value={
                FIELD_TRAIL_PATTERN.SOLID
              }
            >
              Contínua
            </option>

            <option
              value={
                FIELD_TRAIL_PATTERN.DASHED
              }
            >
              Tracejada
            </option>
          </select>
        </div>

        <div className="rounded-lg bg-accent/30 p-3">
          <p className="mb-2 text-[9px] text-muted-foreground">
            Prévia
          </p>

          <div
            className="w-full rounded-full"
            style={{
              height:
                `${style.width}px`,

              opacity:
                style.opacity,

              background:
                style.linePattern ===
                FIELD_TRAIL_PATTERN.DASHED
                  ? `repeating-linear-gradient(
                      to right,
                      ${style.color} 0,
                      ${style.color} 12px,
                      transparent 12px,
                      transparent 20px
                    )`
                  : style.color,
            }}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[10px] text-destructive">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleStart}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
        >
          <Route className="h-4 w-4" />

          Iniciar trilho
        </button>
      </div>
    </div>
  );
}