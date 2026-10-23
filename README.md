# Pausa — agenda de massagens

Sistema de agenda acessível para o programa de bem-estar corporativo da Semantix, cujas sessões de massoterapia são atendidas por massoterapeutas com deficiência visual. Desenvolvido no **Desafio de Inovação do Programa de Estágio Semantix 2026**.

Os colaboradores reservam sessões de massagem clássica de 30 minutos: escolhem o terapeuta (ou deixam sem preferência), o dia e um horário livre, e confirmam. Terapeutas, RH e suporte têm suas próprias funções na API: agenda do terapeuta (também por voz, pela Alexa), cadastro de salas e usuários, regras de negócio, relatórios e auditoria.

O repositório tem duas partes:

- **`frontend/`**: site em React, onde o colaborador faz a reserva.
- **`backend/`**: API em NestJS com PostgreSQL, que guarda usuários, agendas, reservas e regras.

> **Estado atual:** protótipo. O frontend já usa a API de verdade, mas no **modo de demonstração** de identificação (o colaborador é escolhido numa lista em vez de fazer login). Veja [Integração](#integração-frontend--backend) e [Próximos passos](#próximos-passos).

## Sumário

- [Contexto](#contexto)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como rodar](#como-rodar)
- [Frontend](#frontend)
- [Backend](#backend)
- [Integração frontend ↔ backend](#integração-frontend--backend)
- [Testes e CI](#testes-e-ci)
- [Próximos passos](#próximos-passos)
- [Origem do backend](#origem-do-backend)

## Contexto

O desafio: como a tecnologia pode promover inclusão profissional e autonomia para massoterapeutas com deficiência visual, eliminando o atrito operacional e elevando o bem-estar corporativo?

Nas entrevistas, os terapeutas contaram que não sabem quem é o próximo atendimento, ficam parados quando alguém atrasa ou cancela sem avisar, e dependem da secretária para qualquer informação da agenda. Do lado dos colaboradores, as dores eram falta de visibilidade, dificuldade para agendar, fila de espera e falta de retorno. A causa é a mesma: a informação da agenda fica concentrada numa pessoa e circula por canais visuais.

Princípios que guiam o projeto:

- **A barreira está no processo, não na pessoa:** o sistema corrige o fluxo de informação.
- **Paridade de informação:** o terapeuta sabe o mesmo que quem organiza a agenda, no mesmo momento.
- **Terapeuta protagonista:** ele consulta e age sobre a própria agenda, pela web com leitor de tela ou por voz.
- **Nada sobre nós sem nós:** as decisões de interação são validadas com os terapeutas.

Métrica principal: o terapeuta consegue passar um dia inteiro de trabalho sem pedir informação a ninguém. Mais detalhes em [`backend/CONTEXT.md`](backend/CONTEXT.md) e nos requisitos em [`backend/docs/requisitos.md`](backend/docs/requisitos.md).

Este repositório traz o **site de reservas do colaborador** e a **API**. A interface do terapeuta (tela dedicada, pensada para leitor de tela) e o painel do RH ainda não fazem parte dele.

## Estrutura do repositório

```
reservas-massagem/
├─ frontend/                 Site de reservas (React + Vite)
│  ├─ src/                   Componentes, estilos e cliente da API
│  ├─ index.html
│  └─ vite.config.js         Inclui o repasse de /api para o backend
├─ backend/                  API (NestJS + Prisma + PostgreSQL)
│  ├─ src/                   Módulos da API
│  ├─ prisma/                Schema do banco, migrações e seeds
│  ├─ test/                  Testes ponta a ponta (e2e)
│  ├─ docs/                  Requisitos, roadmap, specs dos épicos e tickets
│  ├─ .env.example           Modelo de configuração
│  └─ docker-compose.yml     PostgreSQL local (dev e testes)
├─ .github/workflows/        CI do backend
├─ README.md                 Este arquivo
└─ LEIAME.md                 Resumo curto do projeto
```

## Como rodar

### Requisitos

- **Node.js 22** (o CI usa a 22; o Vite 7 precisa de 20.19 ou mais recente).
- **PostgreSQL 17**. O jeito mais simples é pelo Docker (`docker compose`), que já vem configurado no backend. Também serve um PostgreSQL instalado na máquina, ajustando o `DATABASE_URL`.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Abra o `backend/.env` e ajuste a duração das sessões para 30 minutos, que é o que o frontend usa (o modelo vem com 20):

```
SESSION_DURATION_MINUTES=30
SLOT_STEP_MINUTES=30
```

Depois suba o banco, crie as tabelas, carregue os dados de demonstração e inicie a API:

```bash
docker compose up -d
npm run prisma:deploy
npm run db:seed-demo
npm run start:dev
```

(`prisma:deploy` aplica as migrações existentes; use `prisma:migrate` só quando for criar uma migração nova.)

A API fica em `http://localhost:3000/api`. Para conferir se está no ar: `http://localhost:3000/api/health`.

> As regras de negócio (duração, intervalo, expediente…) são gravadas no banco **na primeira vez** que a API sobe, a partir do `.env`. Se você subiu antes com 20 minutos, mude pela rota `PATCH /api/business-rules/:key` (perfil RH) ou recrie o banco.

### 2. Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Abra `http://localhost:5173`. Em desenvolvimento, o Vite repassa tudo que começa com `/api` para `http://localhost:3000`, então não é preciso configurar CORS nem endereço da API.

### 3. Fazer uma reserva

1. Na primeira tela, clique em **Reservar uma sessão** (ou role até a agenda).
2. Escolha o terapeuta, o dia e o horário.
3. Em **Seus dados**, escolha o colaborador no campo **Nome** (são os usuários de demonstração, por exemplo Beatriz Lima ou Rafael Pires), preencha e-mail e telefone e confirme.

Usuários criados pelo `db:seed-demo`:

| Nome | Papel |
|---|---|
| Beatriz Lima, Rafael Pires, Camila Duarte | Colaborador (EMPLOYEE) |
| Marina Castro, Felipe Nogueira | Terapeuta (THERAPIST) |
| Juliana Ramos | RH (HR) |
| Eduardo Santos | Administrador (ADMIN) |

## Frontend

**Tecnologias:** React 19, Vite 7, Tailwind CSS 4, [Motion](https://motion.dev) (animações), [React Aria Components](https://react-spectrum.adobe.com/react-aria/) (controles acessíveis), three.js (elementos 3D) e lucide-react (ícones).

### Telas e fluxo

- **Primeira tela (hero):** título, botão **Reservar uma sessão** e uma setinha que leva à agenda. Ao clicar no botão, ele vira uma pílula que digita o próximo horário livre; a seta leva à agenda com esse horário já escolhido. Ao fundo, a logo da Pausa em 3D (contorno e linhas internas que deslizam).
- **Agenda**, em etapas numeradas:
  1. **Terapeuta**: um terapeuta específico ou "Sem preferência".
  2. **Dia**: os próximos 21 dias, com a quantidade de horários livres; dias sem expediente aparecem como fechados.
  3. **Horário**: uma barra do dia (ocupado, livre e a sessão escolhida) e os horários separados por manhã, tarde e noite.
  4. **Seus dados**: resumo da reserva, nome, e-mail e número de telefone, e o botão de confirmar. Em telas largas fica ao lado e acompanha a rolagem.
- **Confirmação**: código da reserva, data, horário e terapeuta.

### Temas, acessibilidade e animações

- **Temas:** Automático (segue o sistema), Claro, Escuro e Alto contraste, num único seletor na barra do topo, que muda o site inteiro. A escolha fica salva no navegador.
- **Acessibilidade:** os seletores (terapeuta, dia, horário e tema) são grupos de rádio do React Aria, navegáveis pelo teclado (Tab e setas) e anunciados por leitores de tela. O formulário mostra o erro de cada campo e leva o foco ao primeiro inválido. Quem ativa "reduzir movimento" no sistema vê a página sem deslocamentos, e as cenas 3D ficam paradas.
- **Animações:** as etapas, os dias e os horários esmaecem em cascata conforme a página é rolada; a marcação da opção escolhida desliza entre as opções.

### Identidade visual

- **Tipografia:** Open Sans (fonte da empresa) em todo o site; títulos em negrito semicondensado. Exceção: o título principal da primeira tela usa Instrument Serif.
- **Paleta:** `#5A179A`, `#A07BF6`, `#CBBAFF`, `#DED6FF` e `#FFFFFF`. Todas as cores ficam como variáveis CSS em `src/styles.css`, com valores próprios para cada tema.

### Arquivos

| Arquivo | O que faz |
|---|---|
| `src/main.jsx` | Ponto de entrada |
| `src/App.jsx` | Agenda: carrega dados da API, etapas, horários, formulário e confirmação |
| `src/Hero.jsx` | Barra do topo e primeira tela |
| `src/ThemeSwitch.jsx` | Seletor de tema |
| `src/LogoWire.jsx` | Logo em 3D ao fundo da primeira tela |
| `src/Diamond.jsx` | Diamante lapidado em 3D (guardado para uso futuro, fora da página) |
| `src/three-canvas.js` | Base das cenas 3D: carrega o three.js sob demanda, pausa fora da tela, respeita "reduzir movimento" |
| `src/api.js` | Cliente da API: colaboradores, horários livres e reserva |
| `src/agenda.js` | Serviço, duração (30 min), expediente e leitura dos horários vindos da API |
| `src/agenda.check.js` | Checagem da leitura dos horários (`npm run check`) |
| `src/index.css` | Tailwind e fontes |
| `src/styles.css` | Cores e tipografia dos temas e estilos da barra, da primeira tela e da agenda |

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:5173` |
| `npm run build` | Gera a versão de produção em `dist/` |
| `npm run preview` | Serve a versão de produção localmente |
| `npm run check` | Roda a checagem da leitura dos horários |

Em produção, se o frontend e a API não estiverem no mesmo endereço, defina `VITE_API_URL` (por exemplo `https://api.exemplo.com/api`) antes do `npm run build`.

## Backend

**Tecnologias:** NestJS 11, Prisma (ORM), PostgreSQL 17, class-validator (validação das requisições), helmet, Jest (testes) e Docker.

### Papéis

| Papel | O que pode fazer |
|---|---|
| **EMPLOYEE** (colaborador) | Ver horários livres, reservar, cancelar, ver as próprias reservas, lista de espera, check-in |
| **THERAPIST** (terapeuta) | Ver a própria agenda, bloquear horários, iniciar e finalizar atendimentos |
| **HR** (RH) | Cadastrar usuários e salas, montar as agendas, editar regras de negócio, relatórios e auditoria |
| **ADMIN** | Tudo o que o RH faz (herda o papel de RH) |

### Identificação

Definida por `AUTH_MODE` no `.env`:

- **`header`** (padrão, protótipo): quem faz a requisição é identificado pelo UUID do usuário no cabeçalho `x-user-id`; o backend não guarda sessão. A rota pública `GET /api/auth/demo-users` lista os usuários ativos para escolher (decisão D-12 do projeto, a tela "Entrar como…"). É o modo que o frontend usa hoje, pelo campo **Nome**.
- **`google`** (previsto no roadmap): login com conta Google Workspace (`GOOGLE_CLIENT_ID` e `GOOGLE_WORKSPACE_DOMAIN`).

### Módulos

| Módulo | Responsabilidade |
|---|---|
| `auth` | Identificação, papéis, `GET /me` e usuários de demonstração |
| `users` | Cadastro de usuários pelo RH (listar, criar, ativar e desativar) |
| `rooms` | Salas e token de check-in |
| `schedules` | Agendas dos terapeutas por sala; impede alterar um período que já tem atendimentos |
| `booking` | Horários livres, reservar, cancelar, minhas reservas, próxima sessão e check-in |
| `waitlist` | Lista de espera e aceite de vaga liberada |
| `appointments` | Status do atendimento e transições permitidas |
| `attendance` | Rotinas automáticas: tolerância de atraso e conclusão de atendimentos |
| `therapist` | Agenda do terapeuta, bloqueios, início e fim do atendimento |
| `notifications` | Canal de notificações (banco, memória ou webhook) |
| `business-rules` | Parâmetros de negócio guardados no banco, editáveis pelo RH |
| `reports` | Indicadores (KPIs) |
| `audit` | Registro e consulta de eventos de auditoria |
| `alexa` | Integração com a skill da Alexa e código de pareamento por terapeuta |
| `admin` | Bloqueios, disponibilidade, auditoria e KPIs para o RH |
| `common`, `config`, `domain`, `prisma`, `messages` | Base: relógio, validação do `.env`, políticas, acesso ao banco e textos das mensagens |

### Status de um atendimento

`BOOKED` → `CONFIRMED` → `CHECKED_IN` → `IN_PROGRESS` → `COMPLETED`, além de `POSSIBLE_NO_SHOW`, `NO_SHOW`, `CANCELLED` e `RELEASED`. As transições permitidas ficam em `src/appointments/appointment-status.ts`.

### Regras de negócio

Configuradas no `.env` e gravadas no banco na primeira subida da API. Depois disso, o RH altera por `PATCH /api/business-rules/:key`.

| Variável | Padrão no `.env.example` | Significado |
|---|---|---|
| `SESSION_DURATION_MINUTES` | 20 (**use 30** com este frontend) | Duração da sessão |
| `SLOT_STEP_MINUTES` | 20 (**use 30** com este frontend) | Intervalo entre horários |
| `BOOKING_HORIZON_DAYS` | 21 | Até quantos dias à frente se pode reservar |
| `BOOKING_MIN_NOTICE_MINUTES` | 60 | Antecedência mínima para reservar |
| `CANCELLATION_MIN_NOTICE_MINUTES` | 120 | Antecedência mínima para cancelar |
| `MAX_ACTIVE_BOOKINGS_PER_EMPLOYEE` | 1 | Reservas ativas por colaborador |
| `LATE_ARRIVAL_TOLERANCE_MINUTES` | 10 | Tolerância de atraso |
| `CHECK_IN_EARLY_MINUTES` | 15 | Quanto antes é possível fazer check-in |
| `REMINDER_LEAD_MINUTES` | 1440 | Antecedência do lembrete |
| `REMINDER_CONFIRMATION_TOLERANCE_MINUTES` | 720 | Prazo para confirmar após o lembrete |
| `WAITLIST_ACCEPTANCE_MINUTES` | 30 | Prazo para aceitar uma vaga da lista de espera |
| `WORK_DAYS` | 1,2,3,4,5 | Dias de expediente (1 = segunda) |
| `WORK_START` / `WORK_END` | 09:00 / 18:00 | Início e fim do expediente |
| `LUNCH_START` / `LUNCH_END` | 12:00 / 13:00 | Intervalo de almoço |

Outras variáveis: `DATABASE_URL`, `PORT` (3000), `CORS_ORIGINS` (`http://localhost:5173`), `AUTH_MODE`, `NOTIFICATION_WEBHOOK_URL`, `ALEXA_SKILL_ID`, `ALEXA_USER_MAP`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_NAME`.

### Rotas da API

Todas começam com `/api`.

| Perfil | Rotas |
|---|---|
| Público | `GET /health`, `GET /health/ready`, `GET /auth/demo-users` (só no modo header), `POST /alexa` |
| Qualquer usuário identificado | `GET /me` |
| Colaborador | `GET /booking/availability`, `GET /booking/slots`, `GET /booking/appointments`, `GET /booking/appointments/next`, `POST /booking/appointments`, `DELETE /booking/appointments/:id`, `POST /booking/waitlist`, `DELETE /booking/waitlist/:id`, `POST /booking/waitlist/:id/accept`, `POST /booking/check-in/:token` |
| Colaborador e terapeuta | `GET /notifications` |
| Terapeuta | `GET /therapist/agenda`, `GET /therapist/next`, `DELETE /therapist/appointments/:id`, `POST /therapist/blocks`, `POST /therapist/appointments/:id/start`, `POST /therapist/appointments/:id/finish` |
| RH | `GET /users`, `POST /users`, `PATCH /users/:id/status`, `GET /rooms`, `POST /rooms`, `POST /rooms/:id/regenerate-token`, `GET /business-rules`, `PATCH /business-rules/:key`, `POST /therapists/:id/alexa-pairing-code`, `POST /admin/blocks`, `POST /admin/therapists/:id/availability`, `GET /admin/audit`, `GET /admin/kpis` |
| RH e admin | `GET /schedules`, `POST /schedules`, `PATCH /schedules/:id`, `DELETE /schedules/:id`, `GET /reports/kpis`, `GET /audit-events` |

Os detalhes de cada rota (parâmetros, respostas e erros) estão nas specs em `backend/docs/specs/`.

### Banco de dados

- **Schema:** `prisma/schema.prisma`.
- **Migrações:** `prisma/migrations/` (`npm run prisma:migrate` em desenvolvimento, `npm run prisma:deploy` em produção).
- **Seeds:**
  - `npm run db:bootstrap` cria o primeiro administrador a partir de `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_NAME`.
  - `npm run db:seed-demo` cria os usuários de demonstração, sedes (São Paulo e Londrina), salas e agendas.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run start:dev` | API em modo de desenvolvimento (reinicia a cada alteração) |
| `npm run build` / `npm run start` | Compila / roda a versão compilada |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes ponta a ponta (sobe o banco de testes na porta 5433 pelo Docker) |
| `npm run lint` / `npm run format` | Verificação e formatação do código |
| `npm run prisma:generate` | Gera o cliente do Prisma |

### Documentação

Em `backend/docs/`: requisitos com IDs (`requisitos.md`, o contrato do projeto), roadmap (`roadmap.md`), specs dos épicos (EP-01 modelo de dados, EP-02 identificação e papéis, EP-03 cadastros do RH, EP-04 agendamento do colaborador, EP-05 presença e jobs, EP-08 relatórios e auditoria), tickets de cada épico e o roadmap da Alexa. `backend/CONTEXT.md` traz o domínio, as decisões tomadas e a máquina de estados.

### Convenções do backend

Quem trabalha no backend (pessoas ou agentes de IA) segue o [`backend/AGENTS.md`](backend/AGENTS.md): código em inglês com o glossário do domínio, textos ao usuário em português, Conventional Commits citando ticket e requisito, TDD nas regras de negócio, sem comentários no código e foco em acessibilidade para o terapeuta. O código está sendo reorganizado aos poucos para essa estrutura (por exemplo, `booking/` vai virar `appointments/`, `schedules/`, `waitlist/` e `attendance/`).

## Integração frontend ↔ backend

O que o frontend faz ao abrir a agenda:

1. `GET /api/auth/demo-users`: carrega os usuários e mantém só os colaboradores, que aparecem no campo **Nome**.
2. `GET /api/booking/availability?from=…&to=…&durationMinutes=30`, com `x-user-id` de um colaborador: traz os terapeutas e os horários livres dos próximos 21 dias.
3. Ao confirmar, `POST /api/booking/appointments` com `startsAt`, `endsAt`, `therapistId` e `roomId`, e o `x-user-id` do colaborador escolhido. Depois, os horários livres são recarregados.

Erros da API (horário já tomado, limite de reservas, antecedência mínima…) aparecem no formulário. Se a API estiver fora do ar, a agenda mostra um aviso com o botão **Tentar de novo**.

Pontos de atenção:

- **Duração:** o frontend pede sessões de 30 minutos. A API precisa estar configurada com `SESSION_DURATION_MINUTES=30` e `SLOT_STEP_MINUTES=30`; com outro valor, ela recusa a consulta de horários.
- **Expediente da barra do dia:** fica fixo no frontend (segunda a sexta, 9h às 18h), igual ao padrão do backend, porque a API não informa as regras ao colaborador. Se o RH mudar o expediente, ajuste `frontend/src/agenda.js`.
- **E-mail e telefone:** são pedidos no formulário, mas a rota de reserva não recebe esses campos, então não são enviados nem guardados.

## Testes e CI

- **Frontend:** `npm run check` (leitura dos horários) e `npm run build`.
- **Backend:** `npm test` (unitários) e `npm run test:e2e` (ponta a ponta, com PostgreSQL).
- **CI:** `.github/workflows/backend-ci.yml` roda, a cada push na `main` e em pull requests, lint, formatação, testes unitários, build e testes e2e do backend (com um PostgreSQL de testes).

## Próximos passos

- Login com Google no frontend (`AUTH_MODE=google`), substituindo a escolha do colaborador na lista.
- Telas para o que a API já oferece e o site ainda não usa: minhas reservas, cancelamento, lista de espera, check-in, área do terapeuta e área do RH.
- Guardar e-mail e telefone do colaborador, se forem necessários (exige mudança no backend).
- Expor ao frontend as regras de expediente, para a barra do dia acompanhar mudanças feitas pelo RH.

## Origem do backend

O backend foi importado de [A949604/projeto-estagio](https://github.com/A949604/projeto-estagio) (branch `main`, commit `578f95a`), incluindo a documentação, os testes e o workflow de CI.
