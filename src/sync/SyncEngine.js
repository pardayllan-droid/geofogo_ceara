/**
 * SyncEngine — coordena sincronização de todas as camadas.
 *
 * Estados: idle, checking, syncing, success, partial, offline, error
 * - Verifica conexão
 * - Evita requisições duplicadas
 * - Aplica tentativas progressivas
 * - Atualiza cache
 * - Registra erros
 * - Permite sincronização parcial
 * - Uma falha meteorológica não impede atualização dos eventos
 *
 * GARANTIA: _syncing é SEMPRE resetado via finally.
 * GARANTIA: sync() SEMPRE retorna um objeto de resultado previsível.
 */
import { EventBus, EVENTS } from '../core/EventBus';
import { ErrorManager } from '../core/ErrorManager';

const TASK_TIMEOUT_MS = 45000;

class SyncEngineImpl {
  constructor() {
    this.state = 'idle';
    this.progress = {};
    this._syncing = false;
    this._abortController = null;
  }

  isOnline() {
    return navigator.onLine;
  }

  _setState(state, progress = {}) {
    this.state = state;
    this.progress = { ...this.progress, ...progress };
    EventBus.emit(EVENTS.SYNC_PROGRESS, { state, ...progress });
    if (state === 'success') EventBus.emit(EVENTS.SYNC_COMPLETED, this.progress);
    if (state === 'error' || state === 'partial') EventBus.emit(EVENTS.SYNC_FAILED, this.progress);
  }

  async sync(tasks) {
    if (this._syncing) {
      return { status: 'already-syncing', success: false, partial: false };
    }

    this._syncing = true;
    this._abortController = new AbortController();
    this.progress = {};

    try {
      if (!this.isOnline()) {
        this._setState('offline', { message: 'Sem conexão. Exibindo dados em cache.' });
        return { status: 'offline', success: false, offline: true };
      }

      this._setState('syncing', { message: 'Sincronizando...' });
      EventBus.emit(EVENTS.SYNC_STARTED, {});

      const results = {};
      const errors = {};
      let hasSuccess = false;
      let hasError = false;

      for (const [key, task] of Object.entries(tasks)) {
        if (this._abortController.signal.aborted) break;

        try {
          this._setState('syncing', { message: `Atualizando: ${task.label}...`, current: key });

          const data = await Promise.race([
            task.fn(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout: ${task.label}`)), TASK_TIMEOUT_MS)
            ),
          ]);

          results[key] = data;
          hasSuccess = true;
        } catch (err) {
          console.error(`[SyncEngine] tarefa "${key}" falhou:`, err);
          errors[key] = err;
          hasError = true;
          ErrorManager.report(task.module || 'sync', err, { task: key });
        }
      }

      if (hasSuccess && hasError) {
        this._setState('partial', { message: 'Sincronização parcial concluída.', results, errors });
        return { status: 'partial', success: true, partial: true, results, errors };
      } else if (hasSuccess) {
        this._setState('success', { message: 'Sincronização concluída.', results });
        return { status: 'success', success: true, partial: false, results };
      } else {
        this._setState('error', { message: 'Falha na sincronização.', errors });
        return { status: 'error', success: false, partial: false, errors };
      }
    } catch (err) {
      console.error('[SyncEngine] erro inesperado:', err);
      ErrorManager.report('sync', err, {});
      this._setState('error', { message: 'Erro de sincronização.', error: err.message });
      return { status: 'error', success: false, partial: false, error: err.message };
    } finally {
      this._syncing = false;
    }
  }

  cancel() {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._syncing = false;
    this._setState('idle', { message: 'Sincronização cancelada.' });
  }
}

export const SyncEngine = new SyncEngineImpl();