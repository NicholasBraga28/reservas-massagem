# reservas-massagem

Agenda de massagens acessível (Pausa), do Desafio de Inovação do Programa de Estágio Semantix 2026: site de reservas do colaborador e API. A explicação completa (contexto, como rodar, frontend, backend, rotas, integração e próximos passos) está no [README.md](README.md).

- `frontend/` — site de reservas (React + Vite), já ligado à API
- `backend/` — API (NestJS + Prisma + PostgreSQL), importada de github.com/A949604/projeto-estagio
- `.github/workflows/` — CI do backend

Rodar: backend em `backend/` (`docker compose up -d`, `npm run prisma:deploy`, `npm run db:seed-demo`, `npm run start:dev`) e frontend em `frontend/` (`npm run dev` → http://localhost:5173). O backend precisa de `SESSION_DURATION_MINUTES=30` e `SLOT_STEP_MINUTES=30` no `backend/.env`.

## _paralelos
_(nenhum ainda)_
