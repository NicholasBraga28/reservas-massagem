# reservas-massagem

Aplicação de reservas de massagens para a empresa.

- `frontend/` — React + Vite + Tailwind v4 + Motion + React Aria Components (controles acessíveis: grupos de rádio, formulário com validação por campo, botões). Hero em tela cheia com a logo em 3D ao fundo (traço com linhas internas animadas, three.js), barra fixa com contorno sólido e CTA que digita o próximo horário livre. Um único seletor de tema (Auto / Claro / Escuro / Alto contraste) na barra muda o site inteiro. Transição em degradê do hero para a agenda; etapas, dias e horários esmaecem em cascata conforme a página é rolada. Agenda com visual baseado na referência Calendly (Refero) com paleta roxa #5A179A / #A07BF6 / #CBBAFF / #DED6FF / #FFFFFF. Tipografia: Open Sans (fonte da empresa) em todo o site, com títulos em negrito semicondensado; exceção: o título principal do hero fica em Instrument Serif. Terapeutas, horários livres e reservas vêm do backend (`/api`).
  - `src/Hero.jsx` — hero: navbar, título, CTA animado
  - `src/Diamond.jsx` — diamante lapidado em WebGL (GUARDADO: fora do hero, pronto para reusar)
  - `src/ThemeSwitch.jsx` — seletor de tema único (fica na barra)
  - `src/LogoWire.jsx` — logo da Pausa em 3D (contorno + linhas internas que deslizam), atrás do texto do hero
  - `src/three-canvas.js` — base comum das cenas 3D (three carregado sob demanda, pausa fora da tela, reduzir movimento)
  - `src/App.jsx` — agenda e componentes do agendamento (React Aria + animações com Motion)
  - `src/index.css` — Tailwind e a fonte Open Sans (variável)
  - `src/api.js` — cliente da API (colaboradores, horários livres, reserva; identificação por `x-user-id`)
  - `src/agenda.js` — serviço, sessão de 30 min, expediente e leitura dos horários vindos do backend
  - `src/agenda.check.js` — checagem da leitura dos horários (`npm run check`)
  - `src/styles.css` — tokens de cor/tipo de todos os temas e estilos da barra, do hero e da agenda (camada `components` do Tailwind)
- `backend/` — API em NestJS + Prisma + PostgreSQL (importada de github.com/A949604/projeto-estagio). Módulos de usuários, salas, agendas, reservas, lista de espera, presença (check-in e jobs), notificações, relatórios, auditoria, regras de negócio e pareamento com Alexa.
  - `src/` — módulos da API · `prisma/` — schema, migrações e seeds · `test/` — testes e2e · `docs/` — requisitos, specs dos épicos e tickets
  - Configuração em `.env` (modelo em `.env.example`); banco local via `docker-compose.yml`
- `.github/workflows/backend-ci.yml` — CI do backend (lint, formatação, testes, build e e2e) a cada push na main e em PRs

Rodar o frontend: `cd frontend && npm install && npm run dev` → http://localhost:5173 (o Vite repassa `/api` para o backend em http://localhost:3000)
Rodar o backend: `cd backend && npm install && docker compose up -d && npm run prisma:migrate && npm run start:dev` (outros scripts, como seeds e testes, em `backend/package.json`)

Integração front ↔ back:
- O backend precisa rodar com `SESSION_DURATION_MINUTES=30` e `SLOT_STEP_MINUTES=30` no `backend/.env` (o `.env.example` vem com 20). Essas regras são gravadas no banco na primeira subida; depois, só o RH muda pela API.
- Identificação em modo de demonstração (`AUTH_MODE=header`): o campo "Nome" lista os colaboradores cadastrados (`npm run db:seed-demo` cria alguns) e a reserva é feita em nome do escolhido.
- O expediente da barra do dia segue o padrão do backend (seg–sex, 9h–18h); se o RH mudar, ajustar `frontend/src/agenda.js`.

## _paralelos
_(nenhum ainda)_
