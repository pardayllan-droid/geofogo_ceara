import {
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

/**
 * ExpandableSection
 *
 * Padrão visual compartilhado para blocos expansíveis
 * do GeoFogo.
 *
 * Baseado no AccordionSection originalmente utilizado
 * no painel Diagnóstico.
 *
 * O estado é controlado pelo componente pai para permitir:
 * - integração com seleções já existentes;
 * - fechamento ao selecionar registros;
 * - reutilização em Resumo, Campo e Missões;
 * - nenhuma duplicação de estados internos.
 */
export default function ExpandableSection({
  title,
  icon: Icon,
  expanded,
  onToggle,
  children,
  subtitle = null,
  badge = null,
  accent = 'amber',
  className = '',
  contentClassName = '',
  disabled = false,
}) {
  const accentClasses =
    getAccentClasses(
      accent,
    );

  return (
    <section
      className={`overflow-hidden rounded-xl border border-border bg-card shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={
          onToggle
        }
        disabled={
          disabled ||
          typeof onToggle !==
            'function'
        }
        aria-expanded={
          Boolean(
            expanded,
          )
        }
        className="
          flex w-full
          items-center
          justify-between
          gap-3
          px-3 py-3
          text-left
          transition-colors
          hover:bg-accent/50
          disabled:cursor-default
          disabled:hover:bg-transparent
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-inset
          focus-visible:ring-ring
        "
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && (
            <Icon
              className={`h-4 w-4 shrink-0 ${accentClasses.icon}`}
            />
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xs font-semibold uppercase tracking-wide">
              {title}
            </h3>

            {subtitle && (
              <p className="mt-0.5 truncate text-[9px] normal-case tracking-normal text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {badge !==
            null &&
            badge !==
              undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${accentClasses.badge}`}
              >
                {badge}
              </span>
            )}

          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div
          className={`border-t border-border px-3 py-3 ${contentClassName}`}
        >
          {children}
        </div>
      )}
    </section>
  );
}

function getAccentClasses(
  accent,
) {
  switch (accent) {
    case 'red':
      return {
        icon:
          'text-red-500',

        badge:
          'bg-red-500/10 text-red-700 dark:text-red-300',
      };

    case 'blue':
      return {
        icon:
          'text-blue-500',

        badge:
          'bg-blue-500/10 text-blue-700 dark:text-blue-300',
      };

    case 'purple':
      return {
        icon:
          'text-purple-500',

        badge:
          'bg-purple-500/10 text-purple-700 dark:text-purple-300',
      };

    case 'green':
      return {
        icon:
          'text-green-500',

        badge:
          'bg-green-500/10 text-green-700 dark:text-green-300',
      };

    case 'orange':
      return {
        icon:
          'text-orange-500',

        badge:
          'bg-orange-500/10 text-orange-700 dark:text-orange-300',
      };

    case 'amber':
    default:
      return {
        icon:
          'text-amber-500',

        badge:
          'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      };
  }
}