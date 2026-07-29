/**
 * PageNotFound
 *
 * Página exibida quando a rota solicitada
 * não existe no GeoFogo Ceará.
 */

import {
  ArrowLeft,
  Flame,
  Home,
  Map,
} from 'lucide-react';

import {
  Link,
  useLocation,
} from 'react-router-dom';

export default function PageNotFound() {
  const location =
    useLocation();

  return (
    <main
      className="
        flex min-h-screen items-center justify-center
        bg-background px-6 py-12 text-foreground
      "
    >
      <section
        className="
          w-full max-w-lg rounded-2xl
          border border-border bg-card
          p-8 text-center shadow-lg
        "
      >
        <div
          className="
            mx-auto flex h-16 w-16
            items-center justify-center
            rounded-2xl bg-orange-500/10
          "
        >
          <Flame
            className="h-8 w-8 text-orange-500"
            aria-hidden="true"
          />
        </div>

        <p
          className="
            mt-6 text-sm font-semibold
            uppercase tracking-[0.2em]
            text-orange-500
          "
        >
          Erro 404
        </p>

        <h1
          className="
            mt-2 text-2xl font-bold
            tracking-tight
          "
        >
          Página não encontrada
        </h1>

        <p
          className="
            mt-3 text-sm leading-6
            text-muted-foreground
          "
        >
          O endereço solicitado não existe ou não está
          disponível no GeoFogo Ceará.
        </p>

        {location.pathname !== '/' && (
          <div
            className="
              mt-5 rounded-lg border border-border
              bg-muted/50 px-3 py-2
              font-mono text-xs
              text-muted-foreground
              break-all
            "
          >
            {location.pathname}
          </div>
        )}

        <div
          className="
            mt-7 flex flex-col gap-3
            sm:flex-row sm:justify-center
          "
        >
          <Link
            to="/"
            className="
              inline-flex h-10 items-center
              justify-center gap-2 rounded-md
              bg-primary px-4 text-sm
              font-medium text-primary-foreground
              transition-opacity
              hover:opacity-90
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-ring
              focus-visible:ring-offset-2
            "
          >
            <Home
              className="h-4 w-4"
              aria-hidden="true"
            />

            Voltar ao mapa
          </Link>

          <button
            type="button"
            onClick={() =>
              window.history.back()
            }
            className="
              inline-flex h-10 items-center
              justify-center gap-2 rounded-md
              border border-input bg-background
              px-4 text-sm font-medium
              transition-colors hover:bg-accent
              hover:text-accent-foreground
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-ring
              focus-visible:ring-offset-2
            "
          >
            <ArrowLeft
              className="h-4 w-4"
              aria-hidden="true"
            />

            Página anterior
          </button>
        </div>

        <div
          className="
            mt-8 flex items-center
            justify-center gap-2
            border-t border-border
            pt-5 text-xs
            text-muted-foreground
          "
        >
          <Map
            className="h-4 w-4"
            aria-hidden="true"
          />

          GeoFogo Ceará
        </div>
      </section>
    </main>
  );
}