# reservas-massagem

Aplicação de reservas de massagens para a empresa.

- `frontend/` — React + Vite + Tailwind v4 + Motion + React Aria Components (controles acessíveis: grupos de rádio, formulário com validação por campo, botões). Hero em tela cheia com a logo em 3D ao fundo (traço com linhas internas animadas, three.js), barra fixa com contorno sólido e CTA que digita o próximo horário livre. Um único seletor de tema (Auto / Claro / Escuro / Alto contraste) na barra muda o site inteiro. Transição em degradê do hero para a agenda; etapas, dias e horários esmaecem em cascata conforme a página é rolada. Agenda com visual baseado na referência Calendly (Refero) com paleta roxa #5A179A / #A07BF6 / #CBBAFF / #DED6FF / #FFFFFF. Tipografia: Open Sans (fonte da empresa) em todo o site, com títulos em negrito semicondensado; exceção: o título principal do hero fica em Instrument Serif. Agenda e reservas ainda simuladas no navegador.
  - `src/Hero.jsx` — hero: navbar, título, CTA animado
  - `src/Diamond.jsx` — diamante lapidado em WebGL (GUARDADO: fora do hero, pronto para reusar)
  - `src/ThemeSwitch.jsx` — seletor de tema único (fica na barra)
  - `src/LogoWire.jsx` — logo da Pausa em 3D (contorno + linhas internas que deslizam), atrás do texto do hero
  - `src/three-canvas.js` — base comum das cenas 3D (three carregado sob demanda, pausa fora da tela, reduzir movimento)
  - `src/App.jsx` — agenda e componentes do agendamento (React Aria + animações com Motion)
  - `src/index.css` — Tailwind e a fonte Open Sans (variável)
  - `src/agenda.js` — serviço, sessão de 30 min, terapeutas, horários e regras de disponibilidade (vira API no backend)
  - `src/agenda.check.js` — checagem das regras (`npm run check`)
  - `src/styles.css` — tokens de cor/tipo de todos os temas e estilos da barra, do hero e da agenda (camada `components` do Tailwind)
- `backend/` — API em NestJS + Prisma + PostgreSQL (importada de github.com/A949604/projeto-estagio). Módulos de usuários, salas, agendas, reservas, lista de espera, presença (check-in e jobs), notificações, relatórios, auditoria, regras de negócio e pareamento com Alexa.
  - `src/` — módulos da API · `prisma/` — schema, migrações e seeds · `test/` — testes e2e · `docs/` — requisitos, specs dos épicos e tickets
  - Configuração em `.env` (modelo em `.env.example`); banco local via `docker-compose.yml`
- `.github/workflows/backend-ci.yml` — CI do backend (lint, formatação, testes, build e e2e) a cada push na main e em PRs

Rodar o frontend: `cd frontend && npm install && npm run dev` → http://localhost:5173
Rodar o backend: `cd backend && npm install && docker compose up -d && npm run prisma:migrate && npm run start:dev` (outros scripts, como seeds e testes, em `backend/package.json`)

## _paralelos
_(nenhum ainda)_
