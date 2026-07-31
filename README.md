# 🔥 GeoFogo Ceará

Sistema de monitoramento geoespacial de incêndios florestais para o Estado do Ceará.

O **GeoFogo Ceará** é uma aplicação web (PWA) desenvolvida para apoiar o monitoramento, análise e resposta a ocorrências de fogo em áreas sensíveis. O sistema integra dados geoespaciais, informações do Painel do Fogo (SIPAM), limites administrativos e recursos de operação em campo, oferecendo uma plataforma moderna para acompanhamento de eventos em tempo quase real.

---

# Objetivos

* Monitorar eventos de fogo no Estado do Ceará.
* Identificar incêndios próximos às áreas sensíveis.
* Auxiliar o planejamento operacional do Corpo de Bombeiros.
* Disponibilizar uma aplicação utilizável tanto em computadores quanto em dispositivos móveis (PWA/APK).
* Permitir operação em campo com suporte a funcionamento offline.

---

# Principais funcionalidades

* Mapa interativo utilizando MapLibre GL.
* Visualização de eventos de fogo provenientes do SIPAM.
* Camada de Unidades de Conservação do Ceará.
* Camadas operacionais para apoio ao atendimento.
* Geração de alertas por proximidade entre Eventos de Fogo e áreassensíveis.
* Armazenamento local utilizando IndexedDB.
* Sincronização inteligente de dados.
* Instalação como Progressive Web App (PWA).
* Modo Campo para utilização em operações externas.

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
* MapLibre GL
* AccuWeather
* IBGE

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

---

# Licença

Este projeto encontra-se em desenvolvimento.

A definição da licença será realizada após a conclusão da versão estável.

# Progresso

Resumo do progresso
Área	                                    Estado
Eventos redundantes do MapView	      Concluído
Timers e retries do MapView	            Concluído
Restauração após troca de estilo	      Revisada
Responsabilidade do MapController	      Confirmada
Simplificação de instalação de camadas	Concluída
Commits e push	                        Concluídos
Teste manual completo	                  Pendente
Auditoria do AppCore	                  Pendente
Auditoria do SyncEngine	                  Pendente
Validação offline/cold start	            Pendente

git add .
git commit -m "PWA"
git push

npm run dev