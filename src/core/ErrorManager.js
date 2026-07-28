/**
 * ErrorManager — classificação e tratamento de erros por módulo.
 * Uma falha isolada não derruba a aplicação.
 */
import { EventBus, EVENTS } from './EventBus';

const MESSAGES = {
  map: 'Erro ao renderizar o mapa.',
  sipam: 'Não foi possível atualizar os eventos. Exibindo os últimos dados armazenados.',
  weather: 'Os dados meteorológicos estão desatualizados.',
  layer: 'Uma ou mais camadas estão temporariamente indisponíveis.',
  storage: 'Erro ao acessar o armazenamento local.',
  sync: 'Não foi possível concluir a sincronização de todas as camadas.',
  spatial: 'Erro ao executar cálculos espaciais.',
  field: 'Erro no Modo Campo.',
  conservation: 'Não foi possível carregar as Unidades de Conservação.',
};

class ErrorManagerImpl {
  constructor() {
    this._errors = new Map();
  }

  report(module, error, context = {}) {
    const entry = {
      module,
      message: MESSAGES[module] || error?.message || 'Erro desconhecido.',
      detail: error?.message || String(error),
      context,
      timestamp: Date.now(),
    };
    this._errors.set(module, entry);
    console.warn(`[ErrorManager:${module}]`, error);
    EventBus.emit(EVENTS.ERROR, entry);
    return entry;
  }

  clear(module) {
    this._errors.delete(module);
  }

  get(module) {
    return this._errors.get(module);
  }

  all() {
    return Array.from(this._errors.values());
  }

  has(module) {
    return this._errors.has(module);
  }
}

export const ErrorManager = new ErrorManagerImpl();