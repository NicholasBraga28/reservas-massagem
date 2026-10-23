# EP-03 — Cadastros do RH

Status: ⬜ Planejada (especificação do épico)  
Marco: M2 / M4  
Épico: EP-03 · Roadmap: `docs/roadmap.md`  
Triage: `ready-for-review`  
Tickets: TK-03.01 a TK-03.08  
Requisitos: RF-17, RF-20, RF-23, RF-24, RF-25, RF-26, RF-27, RN-05, RN-08, RNF-01, RNF-04, RNF-05  
Decisões relacionadas: D-01, D-02 (decidida em 2026-10-20), D-04 (decidida em 2026-10-20)  

Criada em 2026-10-20. Fonte de verdade: `docs/requisitos.md`. Onde esta spec e o `requisitos.md` divergirem, vale o `requisitos.md`.

---

## Problem Statement

No protótipo legado herdado das primeiras versões:
- Os cadastros administrativos (salas, terapeutas, períodos de agenda) vivem concentrados num módulo genérico `admin/`, acoplado ao modelo antigo e sem alinhamento com a nova arquitetura do NestJS.
- O controle de acesso ainda não aproveita os papéis `HR` e `ADMIN` com a hierarquia estabelecida no EP-02 (`ADMIN ⊃ HR`).
- A agenda diária dos massoterapeutas (`ScheduleSlot`) é a base da qual dependem os horários disponíveis (`EP-04`) e a agenda acessível (`EP-06`). Porém, hoje não há validação estrita de horários de funcionamento (RN-08), nem bloqueio contra sobreposição de turnos do mesmo massoterapeuta ou da mesma sala (RN-08).
- Não há proteção contra o RH alterar ou remover um período da agenda que já possua atendimentos marcados (`TK-03.04`), o que geraria atendimentos órfãos ou inconsistência no cálculo de disponibilidade.
- As salas possuem tokens fixos para check-in via QR Code, sem mecanismo de regeneração em caso de perda ou vazamento (`RF-24`).
- A geração de códigos de pareamento da Alexa (`RF-17`, `TK-01.05`) ainda não possui rota para que o RH gere o código de 6 dígitos para o massoterapeuta.
- Os parâmetros de regras de negócio (`BusinessRule`, criados no `TK-01.06`) ainda não possuem endpoint administrativo de alteração com auditoria (`RF-27`).

Sem este épico, o RH não consegue operar o sistema de forma confiável e os agendamentos do colaborador (`EP-04`) ficam sem a base de turnos (`ScheduleSlot`).

---

## Solution

Ao término do EP-03:

1. **Separação por Feature Modules:**
   - `users/` (ou `employees/` e `therapists/`): Gestão de usuários, vínculo de massoterapeutas e ativação/desativação.
   - `rooms/`: Gestão de unidades e salas com regeneração de `checkInToken`.
   - `schedules/`: Criação, consulta, edição e remoção de períodos diários da agenda (`ScheduleSlot`).
   - `schedule-blocks/`: Bloqueios de turno pontuais pelo RH (`ScheduleBlock`).
   - `business-rules/`: Endpoints protegidos para edição dos parâmetros pelo RH.
2. **Autorização Centralizada:**
   - Todas as rotas do RH são protegidas globalmente e exigem papel `@Roles(UserRole.HR, UserRole.ADMIN)`.
3. **Consistência da Agenda Diária (`ScheduleSlot`):**
   - Um período deve respeitar o horário de funcionamento da empresa (`RN-08`).
   - **Garantia de não-sobreposição:** É rejeitado qualquer período que coincida com outro período do mesmo massoterapeuta ou da mesma sala.
   - **Garantia contra órfãos:** É proibido editar o horário ou remover um período de agenda se já existirem atendimentos agendados (`BOOKED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`) naquele intervalo (`TK-03.04`).
4. **Regeneração de Token de Sala (QR Code):**
   - Rota `POST /rooms/:id/regenerate-token` gera um novo UUID para `checkInToken`, invalidando imediatamente o QR Code anterior impresso na porta da sala.
5. **Emissão de Código de Pareamento Alexa:**
   - Rota `POST /therapists/:id/alexa-pairing-code` gera código numérico de 6 dígitos válido por 60 minutos (D-18).
6. **Auditoria Completa:**
   - Toda criação, alteração ou exclusão de dados administrativos gera um `AuditEvent` imutável vinculado ao `actorId` da sessão.

---

## Fora de Escopo

- Telas em React / frontend do RH (pertencem ao `EP-12`).
- Algoritmo de cálculo de horários disponíveis para agendamento do colaborador (pertence ao `EP-04`).
- Consumo por voz do código de pareamento na Alexa (pertence ao `EP-07`).
- Envio de notificações automáticas aos colaboradores ao cancelar/alterar agendas (lembretes/e-mails estão fora do MVP).

---

## Modelo de Dados Afetado

Todas as tabelas necessárias já foram criadas nas migrações do `EP-01`:
- `User` e `Therapist` (com status `ACTIVE` / `INACTIVE`).
- `Location` e `Room` (campo `checkInToken`).
- `ScheduleSlot` (`therapistId`, `roomId`, `startsAt`, `endsAt`).
- `ScheduleBlock` (`therapistId`, `startsAt`, `endsAt`, `reason`, `createdById`).
- `BusinessRule` (`key`, `value`, `description`, `updatedById`).
- `AlexaPairingCode` (`code`, `therapistId`, `expiresAt`, `consumedAt`, `createdById`).
- `AuditEvent` (`actorId`, `action`, `entityType`, `entityId`, `data`).

Nenhuma migração nova de schema é necessária para este épico.

---

## Contrato da API

Todas as rotas exigem identificação de usuário autenticado (`x-user-id` no protótipo) e permissão de `HR` ou `ADMIN`.

### 1. Gestão de Usuários e Massoterapeutas (TK-03.01)

#### `GET /users`
* Query params: `role` (opcional: `EMPLOYEE`, `THERAPIST`, `HR`, `ADMIN`), `status` (opcional: `ACTIVE`, `INACTIVE`), `search` (opcional).
* Resposta `200 OK`: Lista de usuários.
```json
[
  {
    "id": "uuid",
    "email": "ana.silva@empresa.com",
    "name": "Ana Silva",
    "role": "THERAPIST",
    "status": "ACTIVE",
    "therapistId": "uuid-do-therapist",
    "createdAt": "2026-10-20T12:00:00.000Z"
  }
]
```

#### `POST /users`
* Body:
```json
{
  "email": "marina.costa@empresa.com",
  "name": "Marina Costa",
  "role": "THERAPIST"
}
```
* Validações: e-mail válido e único; nome preenchido; papel válido.
* Se `role === 'THERAPIST'`, cria automaticamente o registro na tabela `Therapist`.
* Resposta `201 Created`.

#### `PATCH /users/:id/status`
* Body:
```json
{
  "status": "INACTIVE"
}
```
* Resposta `200 OK`. Registra `AuditEvent` (`USER_DEACTIVATED` / `USER_ACTIVATED`).

---

### 2. Gestão de Salas e QR Code (TK-03.02)

#### `GET /rooms`
* Query params: `locationCode` (opcional: `SAO_PAULO`, `LONDRINA`), `active` (opcional: boolean).
* Resposta `200 OK`:
```json
[
  {
    "id": "uuid-sala",
    "name": "Sala 1 - Bela Vista",
    "locationId": "uuid-loc",
    "locationCode": "SAO_PAULO",
    "active": true,
    "checkInToken": "token-uuid-atual"
  }
]
```

#### `POST /rooms`
* Body:
```json
{
  "name": "Sala 3",
  "locationId": "uuid-loc"
}
```
* Resposta `201 Created`. Gera automaticamente um `checkInToken` único.

#### `POST /rooms/:id/regenerate-token`
* Resposta `200 OK`:
```json
{
  "id": "uuid-sala",
  "name": "Sala 1",
  "checkInToken": "novo-uuid-gerado",
  "updatedAt": "2026-10-20T15:00:00.000Z"
}
```
* Efeito: Qualquer tentativa de check-in com o token anterior falhará com erro `invalidCheckIn`. Registra `AuditEvent` (`ROOM_TOKEN_REGENERATED`).

---

### 3. Agenda Diária do Massoterapeuta — `schedules/` (TK-03.03 e TK-03.04)

#### `POST /schedules`
Cria um período de atendimento na grade de um massoterapeuta.
* Body:
```json
{
  "therapistId": "uuid-terapeuta",
  "roomId": "uuid-sala",
  "startsAt": "2026-10-25T09:00:00.000Z",
  "endsAt": "2026-10-25T18:00:00.000Z"
}
```
* Validações de Negócio:
  1. `endsAt` > `startsAt`.
  2. Data/hora devem pertencer ao mesmo dia civil no fuso da unidade (`America/Sao_Paulo`). Sem recorrência.
  3. `therapistId` deve corresponder a massoterapeuta ativo.
  4. `roomId` deve corresponder a sala ativa.
  5. **RN-08 (Horário de funcionamento):** O turno deve estar dentro da faixa configurada (ex.: 09h às 18h).
  6. **RN-08 (Sobreposição de turnos):**
     - O massoterapeuta não pode ter outro `ScheduleSlot` coincidente no tempo.
     - A sala não pode ter outro `ScheduleSlot` coincidente no tempo.
* Resposta `201 Created`:
```json
{
  "id": "uuid-slot",
  "therapistId": "uuid-terapeuta",
  "roomId": "uuid-sala",
  "startsAt": "2026-10-25T09:00:00.000Z",
  "endsAt": "2026-10-25T18:00:00.000Z",
  "createdAt": "2026-10-20T16:00:00.000Z"
}
```
* Erro `409 Conflict`: Mensagem de catálogo `scheduleConflict` se houver choque de horário para o terapeuta ou sala.

#### `GET /schedules`
Consulta os períodos da agenda cadastrados.
* Query params:
  - `date`: `YYYY-MM-DD` (obrigatório ou filtro de intervalo `startDate` / `endDate`)
  - `therapistId` (opcional)
  - `roomId` (opcional)
  - `locationCode` (opcional)
* Resposta `200 OK`: Lista ordenada cronologicamente por `startsAt`.

#### `PATCH /schedules/:id`
Altera horário ou sala de um período.
* Validação crítica (`TK-03.04`): Se existirem atendimentos com status ativos (`BOOKED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`) que ficariam fora do novo intervalo ou conflitantes, a requisição é recusada com erro `409 Conflict` e a lista dos atendimentos impactados.

#### `DELETE /schedules/:id`
Remove um período da agenda.
* Validação crítica (`TK-03.04`): Se existirem atendimentos ativos associados ao período, a remoção é recusada com erro `409 Conflict` e a lista dos atendimentos impactados. Registra `AuditEvent` em caso de sucesso.

---

### 4. Cópia de Agenda Diária (TK-03.05 — 🔒 Decisão D-02)

#### `POST /schedules/copy`
* Body:
```json
{
  "sourceDate": "2026-10-25",
  "targetDates": ["2026-10-26", "2026-10-27", "2026-10-28"],
  "therapistId": "uuid-opcional"
}
```
* Comportamento: Replica os `ScheduleSlot` do dia de origem para os dias de destino mantendo os horários locais de início e fim, validando feriados/finais de semana e sobreposições.

---

### 5. Bloqueios de Horário pelo RH (TK-03.06 — 🔒 Decisão D-04)

#### `POST /schedule-blocks`
* Body:
```json
{
  "therapistId": "uuid-terapeuta",
  "startsAt": "2026-10-25T14:00:00.000Z",
  "endsAt": "2026-10-25T15:00:00.000Z",
  "reason": "Reunião de alinhamento com RH"
}
```
* Comportamento (Decisão D-04): Se houver atendimentos marcados no período do bloqueio, a API recusa com `409 Conflict` e devolve a lista dos agendamentos concorrentes.

---

### 6. Parâmetros de Regras de Negócio (TK-03.07)

#### `GET /business-rules`
* Retorna a lista de todas as regras ativas, suas chaves, valores atuais, tipos e descrições.

#### `PATCH /business-rules/:key`
* Body:
```json
{
  "value": "25"
}
```
* Validações: Verifica limites mínimos/máximos aceitáveis para a chave específica (ex.: `SESSION_DURATION_MINUTES` entre 10 e 120; `BOOKING_HORIZON_DAYS` entre 1 e 90).
* Registra `AuditEvent` com valor anterior e novo valor.

---

### 7. Emissão de Pareamento Alexa (TK-03.08)

#### `POST /therapists/:id/alexa-pairing-code`
* Resposta `201 Created`:
```json
{
  "code": "842915",
  "therapistId": "uuid-terapeuta",
  "expiresAt": "2026-10-20T16:15:00.000Z"
}
```
* Gera código numérico de 6 dígitos único e não consumido, válido por 60 minutos (constante técnica, D-18). Gerar um código novo expira os anteriores não usados do mesmo massoterapeuta.

---

## Catálogo de Mensagens (Novas Mensagens a Adicionar)

Em `src/messages/catalog.ts`:
```typescript
errors: {
  // ... existentes ...
  userEmailAlreadyExists: "Já existe um usuário cadastrado com este e-mail.",
  therapistInactive: "O massoterapeuta selecionado está inativo.",
  roomInactive: "A sala selecionada está inativa.",
  scheduleConflictTherapist: "O massoterapeuta já possui outro período de trabalho neste mesmo horário.",
  scheduleConflictRoom: "A sala selecionada já está ocupada por outro período neste mesmo horário.",
  scheduleHasAppointments: "Não é possível alterar ou remover este período pois já existem atendimentos agendados nele.",
  scheduleBlockConflictAppointments: "Não é possível criar o bloqueio pois existem atendimentos agendados neste intervalo.",
  invalidBusinessRuleValue: "O valor informado para esta regra de negócio é inválido ou fora dos limites permitidos.",
}
```

---

## Critérios de Aceite em BDD (Dado / Quando / Então)

### TK-03.01 — CRUD de Usuários e Massoterapeutas
- **Cenário 1: Cadastro de novo massoterapeuta com sucesso**
  - **Dado** que o RH está autenticado;
  - **Quando** envia `POST /users` com dados válidos e `role = THERAPIST`;
  - **Então** o usuário é criado com status `ACTIVE`, o registro em `Therapist` é gerado automaticamente e um `AuditEvent` de criação é persistido.
- **Cenário 2: Desativação de usuário**
  - **Dado** que um usuário colaborador existe e está `ACTIVE`;
  - **Quando** o RH envia `PATCH /users/:id/status` com `status = INACTIVE`;
  - **Então** o usuário passa para `INACTIVE`, deixa de aparecer na lista de login de demonstração e não pode autenticar.

### TK-03.02 — Unidades, Salas e Regeneração de Token de Check-in
- **Cenário 1: Regeneração de token de sala**
  - **Dado** que a Sala 1 possui um token `T1`;
  - **Quando** o RH chama `POST /rooms/:id/regenerate-token`;
  - **Então** a sala recebe um novo token `T2` e requisições de check-in que utilizarem `T1` passam a ser rejeitadas com erro de token inválido.

### TK-03.03 — Módulo `schedules/`: Criação e Consulta de Períodos
- **Cenário 1: Criação de período sem conflito**
  - **Dado** que o massoterapeuta e a sala estão ativos e livres das 09h às 17h no dia 25/10/2026;
  - **Quando** o RH cria um `ScheduleSlot` para esse intervalo;
  - **Então** o período é gravado com sucesso e retornado em `GET /schedules?date=2026-10-25`.
- **Cenário 2: Conflito de agenda do massoterapeuta**
  - **Dado** que o massoterapeuta já tem um período das 09h às 13h na Sala A;
  - **Quando** o RH tenta criar outro período para o mesmo massoterapeuta das 11h às 15h na Sala B;
  - **Então** a requisição é recusada com status `409 Conflict` e mensagem `scheduleConflictTherapist`.
- **Cenário 3: Conflito de ocupação da sala**
  - **Dado** que o Terapeuta 1 atende na Sala A das 09h às 14h;
  - **Quando** o RH tenta alocar o Terapeuta 2 na Sala A das 13h às 18h no mesmo dia;
  - **Então** a requisição é recusada com status `409 Conflict` e mensagem `scheduleConflictRoom`.

### TK-03.04 — Proteção contra Remoção/Edição de Agenda com Atendimentos
- **Cenário 1: Tentativa de excluir período com atendimentos**
  - **Dado** que existe um `ScheduleSlot` com atendimentos no status `CONFIRMED`;
  - **Quando** o RH tenta executar `DELETE /schedules/:id`;
  - **Então** a exclusão é abortada com status `409 Conflict` e mensagem informando os atendimentos existentes.

### TK-03.05 — Facilitar Montagem da Agenda (🔒 D-02)
- **Cenário 1: Cópia de agenda de um dia para intervalo de datas**
  - **Dado** uma agenda modelo configurada para a segunda-feira;
  - **Quando** o RH solicita cópia para as terças, quartas e quintas do mês;
  - **Então** os períodos equivalentes são criados para cada dia alvo onde não houver conflitos prévios.

### TK-03.06 — Bloqueios de Horário pelo RH (🔒 D-04)
- **Cenário 1: Bloqueio sem atendimentos concorrentes**
  - **Dado** que o massoterapeuta tem agenda aberta mas nenhuma reserva no intervalo das 15h às 16h;
  - **Quando** o RH cadastra um `ScheduleBlock`;
  - **Então** o bloqueio é criado e o intervalo fica indisponível para novos agendamentos.
- **Cenário 2: Bloqueio com atendimento já existente (D-04)**
  - **Dado** que existe uma reserva às 15h20;
  - **Quando** o RH tenta bloquear das 15h às 16h;
  - **Então** a criação é recusada informando a reserva existente.

### TK-03.07 — Edição dos Parâmetros de Regras de Negócio
- **Cenário 1: Atualização de duração da sessão**
  - **Dado** que a regra `SESSION_DURATION_MINUTES` vale 20;
  - **Quando** o RH envia `PATCH /business-rules/SESSION_DURATION_MINUTES` com valor `30`;
  - **Então** o valor é atualizado no banco, um `AuditEvent` é gerado e as próximas consultas ao `BusinessRulesService` passam a refletir 30.

### TK-03.08 — Geração de Código de Pareamento Alexa
- **Cenário 1: Geração com sucesso**
  - **Dado** um massoterapeuta ativo;
  - **Quando** o RH chama `POST /therapists/:id/alexa-pairing-code`;
  - **Então** um código de 6 dígitos é gerado com expiração de 60 minutos (D-18), persistido na tabela `AlexaPairingCode`.

---

## Acessibilidade, Fusos e Regras

1. **Fuso Horário (`RNF-05`):** Todos os cálculos de início e fim de dia consideram `America/Sao_Paulo`.
2. **Ordens e Respostas:**
   - Listagens de usuários e salas vêm sempre ordenadas alfabeticamente por nome.
   - Listagens de períodos e horários vêm sempre em ordem estritamente cronológica (`startsAt ASC`).
3. **Privacidade e Auditoria (`RNF-04`):**
   - Dados de auditoria contêm identificadores e metadados, sem exposição de informações sensíveis desnecessárias.

---

## Decisões Registradas e Perguntas em Aberto

1. **Decisão D-02 (Decidida em 2026-10-20 — Desbloqueia TK-03.05):**
   * *Decisão:* O RH poderá copiar a agenda de uma data modelo para uma lista de datas futuras através do endpoint `POST /schedules/copy`, gerando registros concretos `ScheduleSlot` com validação atômica de conflitos.
2. **Decisão D-04 (Decidida em 2026-10-20 — Desbloqueia TK-03.06):**
   * *Decisão:* Bloqueios de horário (`ScheduleBlock`) que colidirem com atendimentos já marcados serão estritamente recusados com `409 Conflict`, devolvendo a lista de atendimentos conflitantes para ação consciente do RH.
3. **Decisão D-01 (Validação de Parâmetros com RH):**
   * *Questão:* A duração da sessão é 20 min? O horário de funcionamento é 09h às 18h com almoço das 12h às 13h em ambas as unidades?
   * *Situação:* No código atual esses valores são os defaults, aguardando validação final na EP-14.

---

## Revisão do Guilherme (2026-10-21)

Pontos encontrados ao alinhar os tickets do EP-03 a esta spec, depois do merge. Nenhum foi alterado no texto acima; cada um precisa de uma decisão da Mariana (líder do épico). Os tickets afetados citam o ponto na seção "Comentários".

| # | Ponto | Onde | Proposta |
| --- | --- | --- | --- |
| 1 | **A sobreposição de períodos só é conferida no service.** Duas criações simultâneas e conflitantes podem passar as duas, porque a checagem e a gravação não são atômicas. As reservas (`appointments`) já têm restrição de exclusão no banco; os períodos não. | TK-03.03 (✅) | Migração com duas restrições de exclusão em `schedule_slots` (por massoterapeuta e por sala, intervalo `[)`; o `btree_gist` já está habilitado) e tradução do erro do banco para o 409 atual. Contradiz "Nenhuma migração nova", mas é a mesma garantia que o EP-04 deu às reservas. Teste com duas criações em `Promise.all`. |
| 2 | **A auditoria é gravada fora da transação e sem detalhe.** Se o evento falhar, a mudança fica sem rastro; `SCHEDULE_SLOT_UPDATED` não diz o que mudou. | TK-03.03 e seguintes | Gravar o evento na mesma transação, com antes e depois dos campos alterados. As ações viram uma lista fechada (tipo enumerado), para o filtro da auditoria (TK-08.03). |
| 3 | **O formato do código de pareamento é contraditório**: a "Solution" fala em "6 dígitos alfanuméricos" e o contrato em "numérico de 6 dígitos"; a validade aqui é 15 minutos, e a sugestão da D-18 era 60. | TK-03.08 | Numérico, porque o slot da Alexa reconhece dígitos. Validade: decidir a D-18, já que o RH pode gerar o código longe da sala. **Decidido em 2026-10-22 (D-18):** numérico, 6 dígitos, 60 minutos, um código ativo por massoterapeuta. |
| 4 | **O modelo dos parâmetros não bate com o schema**: a spec descreve `BusinessRule (key, value, description, updatedById)`, mas o TK-01.06 gravou uma linha única com uma coluna por parâmetro. | TK-03.07 | Manter o schema e tratar `:key` como o nome do parâmetro, sem migração. Definir os limites de todas as chaves (a spec dá dois exemplos). |
| 5 | **"Atendimentos ativos" no TK-03.04 deixa de fora `POSSIBLE_NO_SHOW`**, que ainda pode virar `IN_PROGRESS`. | TK-03.04 | Incluir `POSSIBLE_NO_SHOW`. |
| 6 | **O horário de funcionamento diverge**: esta spec usa 09h às 18h como exemplo, o `requisitos.md` (RN-08) confirmou 8h às 18h em 2026-10-21, e o `.env.example` ainda tem `WORK_START=09:00`. | TK-03.03, TK-03.07, D-01 | Atualizar o valor inicial do ambiente e o banco de demonstração para 08:00, ou registrar que 09:00 continua valendo. |
| 7 | **Regras de usuário que faltam**: o RH consegue criar um usuário `ADMIN` (e se dar acesso de suporte, contra a história 24 do EP-02); pode desativar o próprio usuário; pode desativar quem tem atendimentos futuros, deixando atendimentos órfãos. | TK-03.01 | Só o `ADMIN` cria ou altera `ADMIN` (403 para o `HR`); ninguém desativa a si mesmo; desativar com atendimentos futuros responde 409 com a lista (mesma linha da D-04). |
| 8 | **Uma sala não tem como ser desativada**: o filtro `active` existe e o TK-03.03 recusa sala inativa, mas nenhuma rota muda `active`. | TK-03.02 | Rota de desativar e reativar, recusando a desativação quando houver períodos futuros na sala. |
| 9 | **A rota `/schedules` não está na matriz de permissões** do EP-02 (`test/permissions.e2e-spec.ts`). | TK-03.03 (✅) | Acrescentar a linha (`HR`/`ADMIN` com acesso, os demais 403, anônimo 401). Cada rota nova do EP-03 entra na matriz no mesmo PR. |
| 10 | **Os títulos das seções 4 e 5 ainda dizem 🔒** (D-02, D-04), embora as duas tenham sido decididas em 2026-10-20. | Seções 4 e 5 | Tirar o 🔒 dos títulos. |
