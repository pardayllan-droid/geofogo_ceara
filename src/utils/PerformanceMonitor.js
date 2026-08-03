/**
 * PerformanceMonitor
 *
 * Mede o tempo das principais etapas de inicialização
 * e sincronização do GeoFogo Ceará.
 *
 * Uso:
 *
 * Perf.reset();
 * Perf.start('Etapa');
 * Perf.end('Etapa');
 * Perf.report();
 */

function now() {
  if (
    typeof performance !==
      'undefined' &&
    typeof performance.now ===
      'function'
  ) {
    return performance.now();
  }

  return Date.now();
}

class PerformanceMonitor {
  constructor() {
    this.enabled =
      true;

    this.reset();
  }

  reset() {
    this.startedAt =
      now();

    this.steps =
      [];

    this.activeSteps =
      new Map();
  }

  start(
    name,
  ) {
    if (
      !this.enabled ||
      !name
    ) {
      return;
    }

    /**
     * Permite repetir uma etapa em sincronizações futuras,
     * mas evita iniciar duas medições simultâneas com o
     * mesmo nome.
     */
    if (
      this.activeSteps.has(
        name,
      )
    ) {
      return;
    }

    this.activeSteps.set(
      name,
      now(),
    );
  }

  end(
    name,
    metadata =
      null,
  ) {
    if (
      !this.enabled ||
      !name
    ) {
      return null;
    }

    const start =
      this.activeSteps.get(
        name,
      );

    if (
      start === undefined
    ) {
      return null;
    }

    const endedAt =
      now();

    const elapsedMs =
      Math.max(
        0,
        endedAt -
          start,
      );

    this.activeSteps.delete(
      name,
    );

    const step = {
      name,
      elapsedMs,
      metadata,
    };

    this.steps.push(
      step,
    );

    return step;
  }

  cancel(
    name,
  ) {
    this.activeSteps.delete(
      name,
    );
  }

  getSteps() {
    return this.steps.map(
      (step) => ({
        ...step,
      }),
    );
  }

  getElapsedMs() {
    return Math.max(
      0,
      now() -
        this.startedAt,
    );
  }

  report() {
    if (!this.enabled) {
      return;
    }

    const totalElapsedMs =
      this.getElapsedMs();

    console.group(
      '[PERF] GeoFogo Ceará',
    );

    console.log(
      `Tempo total decorrido: ${(
        totalElapsedMs /
        1000
      ).toFixed(2)} s`,
    );

    if (
      this.steps.length ===
      0
    ) {
      console.log(
        'Nenhuma etapa foi registrada.',
      );

      console.groupEnd();

      return;
    }

    const rows =
      this.steps.map(
        (step) => ({
          Etapa:
            step.name,

          'Tempo (s)':
            Number(
              (
                step.elapsedMs /
                1000
              ).toFixed(
                3,
              ),
            ),

          'Tempo (ms)':
            Math.round(
              step.elapsedMs,
            ),

          Detalhes:
            step.metadata
              ? JSON.stringify(
                  step.metadata,
                )
              : '',
        }),
      );

    console.table(
      rows,
    );

    console.groupEnd();
  }
}

export const Perf =
  new PerformanceMonitor();