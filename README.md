# 🔥 GeoFogo Ceará

<p align="center">
  <img src="docs/images/logo.png" alt="GeoFogo Ceará" width="180"/>
</p>

<p align="center">

Sistema Inteligente para Monitoramento de Incêndios Florestais do Estado do Ceará

</p>

<p align="center">

Monitoramento • Alertas • Operação em Campo • Funcionamento Offline • PWA

</p>

---

## 📖 Sobre o Projeto

O **GeoFogo Ceará** é um sistema de monitoramento geoespacial desenvolvido para apoiar ações de prevenção, monitoramento e resposta a incêndios florestais no Estado do Ceará.

A aplicação integra informações geográficas provenientes de diferentes fontes oficiais, permitindo visualizar em um único mapa:

- eventos ativos de fogo;
- frentes de propagação;
- unidades de conservação;
- municípios;
- companhias do Corpo de Bombeiros Militar do Ceará;
- condições meteorológicas;
- alertas automáticos por proximidade.

O projeto foi concebido para funcionar tanto em ambiente operacional quanto em campo, permitindo sua utilização mesmo em locais sem acesso contínuo à internet.

---

# 🎯 Objetivos

O GeoFogo Ceará possui cinco objetivos principais:

- fornecer uma visão operacional unificada dos eventos de fogo;
- reduzir o tempo necessário para identificar áreas prioritárias;
- aumentar a consciência situacional das equipes em campo;
- funcionar mesmo em ambientes com conectividade limitada;
- servir como plataforma aberta para evolução futura.

---

# ✨ Principais funcionalidades

## 🛰️ Monitoramento em tempo real

Visualização automática dos eventos de fogo disponibilizados pelo SIPAM.

---

## 🔥 Frentes de fogo

Exibição das frentes detectadas pelos satélites.

---

## 🏞️ Unidades de Conservação

Visualização das UCs estaduais e federais.

---

## 🗺️ Municípios

Limites municipais do Estado do Ceará.

---

## 🚒 Companhias do Corpo de Bombeiros

Localização das unidades operacionais.

---

## ⚠ Alertas automáticos

Identificação automática de eventos de fogo próximos às Unidades de Conservação.

A distância de alerta pode ser configurada pelo usuário.

---

## 🌦 Informações meteorológicas

Exibição das condições atuais de tempo.

---

## 📍 Modo Campo

Registro de:

- trilhas
- pontos
- observações

diretamente pelo dispositivo móvel.

---

## 💾 Funcionamento Offline

O sistema armazena localmente:

- limite do Ceará;
- municípios;
- unidades de conservação;
- eventos sincronizados;
- configurações.

---

## 📊 Diagnóstico Integrado

Painel interno para inspeção do estado da aplicação.

Permite verificar:

- sincronização;
- renderização;
- camadas;
- fontes de dados;
- erros registrados;
- funcionamento do mapa.

---

# 🏗 Arquitetura Geral

O GeoFogo Ceará foi desenvolvido utilizando uma arquitetura modular.

```text
                 AppCore
                     │
      ┌──────────────┼──────────────┐
      │              │              │
 SyncEngine     LayerManager   AlertEngine
      │              │              │
      │              │              │
 IndexedDB      MapLibre GL     Notifications
      │
      │
 Serviços Externos
      │
 ┌────┴──────────────────────────────────┐
 │                                       │
 SIPAM                            OpenWeather
```

Cada módulo possui responsabilidades bem definidas, facilitando manutenção e evolução do projeto.

---

# 🚀 Fluxo de Inicialização

Durante uma inicialização completa ("Cold Start"), o sistema executa as seguintes etapas:

```text
Inicialização

        │

        ▼

AppCore

        │

        ▼

MapLibre

        │

        ▼

LayerRegistry

        │

        ▼

Boundary do Ceará

        │

        ▼

Municípios

        │

        ▼

Unidades de Conservação

        │

        ▼

Eventos do SIPAM

        │

        ▼

Frentes de fogo

        │

        ▼

Alertas

        │

        ▼

Renderização

        │

        ▼

Aplicação pronta
```

---

# 🧩 Tecnologias Utilizadas

| Tecnologia | Finalidade |
|------------|------------|
| React | Interface da aplicação |
| Vite | Build e desenvolvimento |
| JavaScript ES2023 | Linguagem principal |
| MapLibre GL JS | Motor cartográfico |
| Tailwind CSS | Interface |
| Lucide Icons | Ícones |
| IndexedDB | Persistência Offline |
| Service Worker | Cache Offline |
| PWA | Instalação no dispositivo |
| Capacitor | Empacotamento Android |
| Git | Controle de versão |
| GitHub | Repositório |

---

# 🌐 Fontes Oficiais dos Dados

O GeoFogo Ceará utiliza exclusivamente dados provenientes de fontes oficiais ou amplamente reconhecidas pela comunidade geoespacial.

## 🛰 SIPAM — Sistema de Proteção da Amazônia

Utilizado para obtenção de:

- Eventos de fogo
- Frentes de fogo

Tecnologia utilizada:

- OGC Web Feature Service (WFS)

Camadas atualmente utilizadas:

```text
painel_do_fogo:mv_evento_filtro

painel_do_fogo:mv_frente_deteccao
```

Referências:

- Painel do Fogo – SIPAM
- Serviços OGC/WFS disponibilizados pelo SIPAM

---

## 🌦 OpenWeather

Utilizado para:

- temperatura;
- umidade;
- velocidade do vento;
- condições meteorológicas;
- previsão.

API utilizada:

Current Weather API

Documentação oficial:

https://openweathermap.org/api

---

## 🗺 Instituto Brasileiro de Geografia e Estatística (IBGE)

Utilizado para:

- limites municipais;
- divisão administrativa.

Referências:

https://www.ibge.gov.br/

https://www.ibge.gov.br/geociencias

---

## 🌳 ICMBio

Utilizado para:

- Unidades de Conservação Federais.

Referência:

https://www.gov.br/icmbio

---

## 🌿 SEMA Ceará

Utilizado para:

- Unidades de Conservação Estaduais.

Referência:

https://www.sema.ce.gov.br/

---

## 🗺 OpenStreetMap

Utilizado como mapa base.

Licença:

Open Database License (ODbL)

https://www.openstreetmap.org

---

## 🗺 MapLibre

Motor cartográfico utilizado pela aplicação.

https://maplibre.org/

---

## 📦 Capacitor

Responsável pela geração da aplicação Android.

https://capacitorjs.com/

---

## 💾 IndexedDB

Persistência local dos dados sincronizados.

Padrão implementado pelos navegadores modernos.
