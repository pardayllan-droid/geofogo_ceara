/**
 * SyncEngine
 *
 * Coordena a execução das tarefas de sincronização.
 *
 * Estados possíveis:
 * - idle
 * - checking
 * - syncing
 * - success
 * - partial
 * - offline
 * - cancelled
 * - error
 *
 * Cada tarefa deve possuir:
 *
 * {
 *   label: 'Nome apresentado ao usuário',
 *   module: 'layer',
 *   fn: async ({ signal }) => dados
 * }
 *
 * A função da tarefa também pode ignorar o argumento recebido.
 * Dessa forma, tarefas antigas continuam compatíveis.
 */

import { EventBus, EVENTS } from '../core/EventBus';
import { ErrorManager } from '../core/ErrorManager';

const DEFAULT_TASK_TIMEOUT_MS = 45000;

class SyncEngineImpl {
  constructor() {
    this.state = 'idle';
    this.progress = {};

    this._syncing = false;
    this._abortController = null;
    this._currentPromise = null;
  }

  /**
   * Informa se uma sincronização está em andamento.
   */
  get syncing() {
    return this._syncing;
  }

  /**
   * Verifica a conexão informada pelo navegador.
   *
   * navigator.onLine não garante acesso à internet, mas permite
   * evitar tentativas desnecessárias quando o navegador já sabe
   * que está offline.
   */
  isOnline() {
    if (typeof navigator === 'undefined') {
      return true;
    }

    return navigator.onLine !== false;
  }

  /**
   * Atualiza o estado interno e comunica a interface.
   */
  _setState(state, progress = {}) {
    this.state = state;

    this.progress = {
      ...this.progress,
      ...progress,
      state,
    };

    EventBus.emit(EVENTS.SYNC_PROGRESS, {
      ...this.progress,
      state,
    });
  }

  /**
   * Cria um erro padronizado de cancelamento.
   */
  _createAbortError(message = 'Sincronização cancelada.') {
    try {
      return new DOMException(message, 'AbortError');
    } catch {
      const error = new Error(message);
      error.name = 'AbortError';
      return error;
    }
  }

  /**
   * Verifica se um erro foi provocado por cancelamento.
   */
  _isAbortError(error) {
    return (
      error?.name === 'AbortError' ||
      error?.code === 20 ||
      /abort|cancelad/i.test(error?.message || '')
    );
  }

  /**
   * Verifica se o resultado de uma tarefa é utilizável.
   *
   * Por padrão:
   * - null e undefined são inválidos;
   * - FeatureCollection vazia é inválida;
   * - tarefa pode permitir vazio com allowEmpty: true;
   * - tarefa pode fornecer uma função validate personalizada.
   */
  _validateTaskResult(key, task, data) {
    if (typeof task.validate === 'function') {
      const validationResult = task.validate(data);

      if (validationResult === false) {
        throw new Error(
          `A tarefa "${task.label || key}" retornou dados inválidos.`,
        );
      }

      if (typeof validationResult === 'string') {
        throw new Error(validationResult);
      }
    }

    if (data === null || data === undefined) {
      throw new Error(
        `A tarefa "${task.label || key}" não retornou dados.`,
      );
    }

    if (
      data?.type === 'FeatureCollection' &&
      !Array.isArray(data.features)
    ) {
      throw new Error(
        `A tarefa "${task.label || key}" retornou um GeoJSON inválido.`,
      );
    }

    if (
      data?.type === 'FeatureCollection' &&
      data.features.length === 0 &&
      task.allowEmpty !== true
    ) {
      throw new Error(
        `A tarefa "${task.label || key}" retornou uma coleção vazia.`,
      );
    }

    return data;
  }

  /**
   * Executa uma tarefa com timeout e cancelamento.
   */
  async _runTask(key, task, parentSignal) {
    if (!task || typeof task.fn !== 'function') {
      throw new Error(
        `A tarefa "${key}" não possui uma função válida.`,
      );
    }

    const timeoutMs =
      Number.isFinite(task.timeoutMs) && task.timeoutMs > 0
        ? task.timeoutMs
        : DEFAULT_TASK_TIMEOUT_MS;

    const taskController = new AbortController();

    const abortFromParent = () => {
      if (!taskController.signal.aborted) {
        taskController.abort(
          parentSignal?.reason ||
            this._createAbortError(),
        );
      }
    };

    if (parentSignal?.aborted) {
      abortFromParent();
    } else {
      parentSignal?.addEventListener(
        'abort',
        abortFromParent,
        { once: true },
      );
    }

    let timeoutId = null;

    try {
      const taskPromise = Promise.resolve().then(() =>
        task.fn({
          signal: taskController.signal,
          taskKey: key,
          timeoutMs,
        }),
      );

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          const timeoutError = new Error(
            `Tempo limite excedido ao atualizar: ${task.label || key}.`,
          );

          timeoutError.name = 'TimeoutError';

          if (!taskController.signal.aborted) {
            taskController.abort(timeoutError);
          }

          reject(timeoutError);
        }, timeoutMs);
      });

      const data = await Promise.race([
        taskPromise,
        timeoutPromise,
      ]);

      if (taskController.signal.aborted) {
        throw (
          taskController.signal.reason ||
          this._createAbortError()
        );
      }

      return this._validateTaskResult(
        key,
        task,
        data,
      );
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      parentSignal?.removeEventListener(
        'abort',
        abortFromParent,
      );
    }
  }

  /**
   * Executa as tarefas sequencialmente.
   *
   * A execução sequencial foi mantida para não sobrecarregar APIs
   * externas e para respeitar tarefas que dependem de resultados
   * carregados anteriormente.
   */
  async sync(tasks = {}) {
    if (this._syncing && this._currentPromise) {
      return this._currentPromise;
    }

    const taskEntries = Object.entries(tasks || {});

    if (taskEntries.length === 0) {
      const emptyResult = {
        status: 'success',
        success: true,
        partial: false,
        results: {},
        errors: {},
        completed: [],
        failed: [],
      };

      this._setState('success', {
        message: 'Nenhuma atualização necessária.',
        current: null,
        completed: [],
        failed: [],
        results: {},
        errors: {},
      });

      EventBus.emit(
        EVENTS.SYNC_COMPLETED,
        emptyResult,
      );

      return emptyResult;
    }

    this._syncing = true;
    this._abortController = new AbortController();

    const synchronizationPromise = this._executeSync(
      taskEntries,
      this._abortController.signal,
    );

    this._currentPromise = synchronizationPromise;

    try {
      return await synchronizationPromise;
    } finally {
      this._syncing = false;
      this._currentPromise = null;
      this._abortController = null;
    }
  }

  /**
   * Implementação interna da sincronização.
   */
  async _executeSync(taskEntries, signal) {
    const results = {};
    const errors = {};
    const completed = [];
    const failed = [];

    this.progress = {
      total: taskEntries.length,
      completed: [],
      failed: [],
      results: {},
      errors: {},
      current: null,
    };

    try {
      this._setState('checking', {
        message: 'Verificando conexão...',
      });

      if (!this.isOnline()) {
        const offlineResult = {
          status: 'offline',
          success: false,
          partial: false,
          offline: true,
          results,
          errors,
          completed,
          failed,
        };

        this._setState('offline', {
          message:
            'Sem conexão. Exibindo dados armazenados.',
          current: null,
        });

        EventBus.emit(
          EVENTS.SYNC_FAILED,
          offlineResult,
        );

        return offlineResult;
      }

      EventBus.emit(EVENTS.SYNC_STARTED, {
        total: taskEntries.length,
      });

      this._setState('syncing', {
        message: 'Iniciando atualização...',
        current: null,
      });

      for (
        let index = 0;
        index < taskEntries.length;
        index += 1
      ) {
        const [key, task] = taskEntries[index];

        if (signal.aborted) {
          throw (
            signal.reason ||
            this._createAbortError()
          );
        }

        const label = task?.label || key;

        this._setState('syncing', {
          message: `Atualizando: ${label}...`,
          current: key,
          currentLabel: label,
          currentIndex: index + 1,
          total: taskEntries.length,
          completed: [...completed],
          failed: [...failed],
        });

        try {
          const data = await this._runTask(
            key,
            task,
            signal,
          );

          results[key] = data;
          completed.push(key);

          this._setState('syncing', {
            message: `${label} atualizado.`,
            current: key,
            currentLabel: label,
            currentIndex: index + 1,
            total: taskEntries.length,
            completed: [...completed],
            failed: [...failed],
            results: { ...results },
          });
        } catch (error) {
          if (
            signal.aborted ||
            this._isAbortError(error)
          ) {
            throw error;
          }

          console.error(
            `[SyncEngine] A tarefa "${key}" falhou:`,
            error,
          );

          const serializedError = {
            name: error?.name || 'Error',
            message:
              error?.message ||
              String(error),
          };

          errors[key] = serializedError;
          failed.push(key);

          ErrorManager.report(
            task?.module || 'sync',
            error,
            {
              task: key,
              label,
            },
          );

          this._setState('syncing', {
            message: `Falha ao atualizar: ${label}.`,
            current: key,
            currentLabel: label,
            currentIndex: index + 1,
            total: taskEntries.length,
            completed: [...completed],
            failed: [...failed],
            results: { ...results },
            errors: { ...errors },
          });
        }
      }

      const hasSuccess = completed.length > 0;
      const hasError = failed.length > 0;

      if (hasSuccess && hasError) {
        const partialResult = {
          status: 'partial',
          success: true,
          partial: true,
          results,
          errors,
          completed,
          failed,
        };

        this._setState('partial', {
          message:
            'Sincronização concluída parcialmente.',
          current: null,
          completed: [...completed],
          failed: [...failed],
          results: { ...results },
          errors: { ...errors },
        });

        EventBus.emit(
          EVENTS.SYNC_FAILED,
          partialResult,
        );

        return partialResult;
      }

      if (hasSuccess) {
        const successResult = {
          status: 'success',
          success: true,
          partial: false,
          results,
          errors,
          completed,
          failed,
        };

        this._setState('success', {
          message: 'Sincronização concluída.',
          current: null,
          completed: [...completed],
          failed: [],
          results: { ...results },
          errors: {},
        });

        EventBus.emit(
          EVENTS.SYNC_COMPLETED,
          successResult,
        );

        return successResult;
      }

      const errorResult = {
        status: 'error',
        success: false,
        partial: false,
        results,
        errors,
        completed,
        failed,
      };

      this._setState('error', {
        message:
          'Nenhuma camada pôde ser atualizada.',
        current: null,
        completed: [],
        failed: [...failed],
        results: {},
        errors: { ...errors },
      });

      EventBus.emit(
        EVENTS.SYNC_FAILED,
        errorResult,
      );

      return errorResult;
    } catch (error) {
      if (
        signal.aborted ||
        this._isAbortError(error)
      ) {
        const cancelledResult = {
          status: 'cancelled',
          success: false,
          partial: completed.length > 0,
          cancelled: true,
          results,
          errors,
          completed,
          failed,
        };

        this._setState('cancelled', {
          message: 'Sincronização cancelada.',
          current: null,
          completed: [...completed],
          failed: [...failed],
          results: { ...results },
          errors: { ...errors },
        });

        EventBus.emit(
          EVENTS.SYNC_FAILED,
          cancelledResult,
        );

        return cancelledResult;
      }

      console.error(
        '[SyncEngine] Erro inesperado:',
        error,
      );

      ErrorManager.report('sync', error, {
        operation: 'sync',
      });

      const unexpectedResult = {
        status: 'error',
        success: false,
        partial: completed.length > 0,
        error:
          error?.message || String(error),
        results,
        errors,
        completed,
        failed,
      };

      this._setState('error', {
        message:
          error?.message ||
          'Erro inesperado durante a sincronização.',
        current: null,
        completed: [...completed],
        failed: [...failed],
        results: { ...results },
        errors: { ...errors },
      });

      EventBus.emit(
        EVENTS.SYNC_FAILED,
        unexpectedResult,
      );

      return unexpectedResult;
    }
  }

  /**
   * Cancela a sincronização atual.
   */
  cancel() {
    if (!this._abortController) {
      return false;
    }

    if (!this._abortController.signal.aborted) {
      this._abortController.abort(
        this._createAbortError(),
      );
    }

    return true;
  }

  /**
   * Retorna o estado atual.
   */
  getState() {
    return {
      state: this.state,
      syncing: this._syncing,
      progress: { ...this.progress },
    };
  }
}

export const SyncEngine = new SyncEngineImpl();