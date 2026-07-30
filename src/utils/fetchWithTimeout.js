/**
 * fetchWithTimeout — wrapper de fetch com timeout e AbortSignal externo.
 * Garante que nenhuma requisição externa bloqueie a sincronização
 * indefinidamente e respeita cancelamentos do chamador.
 */
export async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 20000,
) {
  const controller = new AbortController();
  const externalSignal = options.signal;

  const abortFromExternalSignal = () => {
    if (!controller.signal.aborted) {
      controller.abort(
        externalSignal?.reason ||
          new DOMException(
            'Requisição cancelada.',
            'AbortError',
          ),
      );
    }
  };

  if (externalSignal?.aborted) {
    abortFromExternalSignal();
  } else {
    externalSignal?.addEventListener(
      'abort',
      abortFromExternalSignal,
      { once: true },
    );
  }

  const timeoutId = setTimeout(() => {
    if (!controller.signal.aborted) {
      const timeoutError = new Error(
        `Tempo limite de ${timeoutMs} ms excedido.`,
      );

      timeoutError.name = 'TimeoutError';
      controller.abort(timeoutError);
    }
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw controller.signal.reason || error;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);

    externalSignal?.removeEventListener(
      'abort',
      abortFromExternalSignal,
    );
  }
}
