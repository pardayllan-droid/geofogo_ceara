/**
 * LayerRegistry — registro central de definições de camadas.
 * Permite adicionar camadas sem alterar o componente principal do mapa.
 */
import { LAYER_DEFINITIONS, BASE_MAPS } from './LayerDefinitions';

class LayerRegistryImpl {
  constructor() {
    this._definitions = [];
    this._baseMaps = new Map();
  }

  initialize() {
    this._baseMaps.clear();
    this._definitions = [...LAYER_DEFINITIONS];

    Object.values(BASE_MAPS).forEach((baseMap) => {
      this._baseMaps.set(baseMap.id, baseMap);
    });
  }

  getBaseMaps() {
    return Array.from(this._baseMaps.values());
  }

  getDefinitions() {
    return [...this._definitions];
  }

}

export const LayerRegistry = new LayerRegistryImpl();