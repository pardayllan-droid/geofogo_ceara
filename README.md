# 🔥 GeoFogo Ceará

Sistema de monitoramento geoespacial de incêndios florestais para o Estado do Ceará.

O **GeoFogo Ceará** é uma aplicação web (PWA) desenvolvida para apoiar o monitoramento, análise e resposta a ocorrências de fogo em áreas naturais. O sistema integra dados geoespaciais, informações do Painel do Fogo (SIPAM), limites administrativos, Unidades de Conservação e recursos de operação em campo, oferecendo uma plataforma moderna para acompanhamento de eventos em tempo quase real.

---

# Objetivos

* Monitorar eventos de fogo no Estado do Ceará.
* Identificar incêndios próximos às Unidades de Conservação.
* Auxiliar o planejamento operacional do Corpo de Bombeiros e demais órgãos ambientais.
* Disponibilizar uma aplicação utilizável tanto em computadores quanto em dispositivos móveis (PWA).
* Permitir operação em campo com suporte a funcionamento offline.

---

# Principais funcionalidades

* 🗺️ Mapa interativo utilizando MapLibre GL.
* 🔥 Visualização de eventos de fogo provenientes do SIPAM.
* 🌳 Camada de Unidades de Conservação do Ceará.
* 🏙️ Limites municipais do Estado.
* 🚒 Camadas operacionais para apoio ao atendimento.
* 📍 Centralização automática de eventos.
* ⚠️ Geração de alertas por proximidade entre focos de incêndio e Unidades de Conservação.
* 💾 Armazenamento local utilizando IndexedDB.
* 📡 Sincronização inteligente de dados.
* 📱 Instalação como Progressive Web App (PWA).
* 🧭 Modo Campo para utilização em operações externas.

---

# Arquitetura

O projeto foi desenvolvido com arquitetura modular, separando responsabilidades entre sincronização, gerenciamento de camadas, persistência e interface.

```
src
├── alerts
├── components
├── core
├── hooks
├── layers
├── map
├── services
├── storage
├── utils
└── pages
```

Principais módulos:

* **AppCore** — coordena toda a aplicação.
* **SyncEngine** — sincronização dos dados.
* **LayerManager** — gerenciamento das camadas do mapa.
* **MapView** — renderização utilizando MapLibre GL.
* **AlertEngine** — cálculo de alertas por proximidade.
* **IndexedDB** — armazenamento local para funcionamento offline.

---

# Tecnologias utilizadas

* React
* Vite
* MapLibre GL
* Turf.js
* TanStack Query
* IndexedDB
* React Router
* Lucide Icons
* Progressive Web App (PWA)

---

# Fonte dos dados

O sistema utiliza dados públicos provenientes de diferentes fontes geoespaciais, entre elas:

* Painel do Fogo (SIPAM)
* Municípios do Estado do Ceará
* Unidades de Conservação
* Limite oficial do Estado do Ceará

As camadas são sincronizadas automaticamente e armazenadas localmente para melhorar desempenho e disponibilidade offline.

---

# Instalação

Clone o repositório:

```bash
git clone https://github.com/SEU_USUARIO/geofogo-ceara.git
```

Entre na pasta:

```bash
cd geofogo-ceara
```

Instale as dependências:

```bash
npm install
```

Execute em modo de desenvolvimento:

```bash
npm run dev
```

---

# Build de produção

```bash
npm run build
```

Visualizar o build:

```bash
npm run preview
```

---

# Verificações

Executar análise de tipos:

```bash
npm run typecheck
```

Executar lint:

```bash
npm run lint
```

---

# Estrutura de sincronização

Fluxo simplificado de inicialização:

```
Inicialização
      │
      ▼
AppCore
      │
      ▼
MapView
      │
      ▼
LayerManager
      │
      ▼
SyncEngine
      │
      ├── Limite do Ceará
      ├── Municípios
      ├── Unidades de Conservação
      └── Eventos de Fogo
              │
              ▼
AlertEngine
              │
              ▼
Mapa
```

---

# Roadmap

Planejado para as próximas versões:

* Notificações em tempo real.
* Histórico temporal dos eventos.
* Estatísticas operacionais.
* Exportação de relatórios.
* Integração com dados meteorológicos.
* Integração com novas fontes geoespaciais.
* Expansão para outros estados brasileiros.

---

# Licença

Este projeto encontra-se em desenvolvimento.

A definição da licença será realizada após a conclusão da versão estável.

git add .
git commit -m "Remover dependências legadas"
git push

npm run dev