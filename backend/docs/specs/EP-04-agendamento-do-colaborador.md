# EP-04 — Agendamento do colaborador

Status: ⬜ Planejada  
Marco: M2  
Épico: EP-04 · Roadmap: `docs/roadmap.md`  
Tickets: TK-04.01 a TK-04.08  
Requisitos: RF-01, RF-02, RF-03, RF-04, RF-07, RF-08, RF-09, RN-01, RN-05, RN-06, RN-07, RN-08, RN-10, RN-12, RNF-01, RNF-04, RNF-05

Fonte de verdade: `docs/requisitos.md`. Onde esta spec e `docs/requisitos.md` divergirem, vale `docs/requisitos.md`.

## Objetivo

Permitir que o colaborador consulte horários disponíveis, faça e cancele reservas, consulte seus próprios agendamentos, entre ou saia da lista de espera e receba uma oferta de vaga dentro do sistema.

O backend continua sendo a fonte da verdade para disponibilidade, concorrência, prazos, limites de reservas, auditoria e transições de estado. A reserva nasce `CONFIRMED` no protótipo. O `RF-08` permanece rastreável, mas está fora do MVP: para trocar de horário, o colaborador cancela a sessão atual e faz uma nova reserva.

## Fora de escopo

- Reagendamento atômico; para o MVP, cancelar e reservar novamente (`RF-08`, decisão D-03).
- Envio de e-mail, SMS, WhatsApp ou Telegram para confirmação ou oferta de vaga.
- Login Google; a identificação continua sendo feita por `x-user-id` no protótipo.
- Tela React do colaborador, pertencente ao EP-10.
- Check-in por QR Code, pertencente ao EP-05.
- Lembrete falado da Alexa, pertencente ao EP-07.
- Feedback, Google Calendar e notificações externas.

## Contrato comum

As rotas abaixo usam o prefixo global `/api`.

Todas as rotas exigem identificação por `x-user-id` e papel `EMPLOYEE`, salvo quando indicado. O colaborador só pode consultar ou alterar seus próprios agendamentos e entradas na fila.

Formato de data de entrada: ISO 8601 com timezone. Datas são persistidas em UTC. A interpretação de dia civil e horário de funcionamento usa o timezone da unidade, atualmente `America/Sao_Paulo`.

Erros seguem o formato global do NestJS e usam mensagens de `src/messages/catalog.ts`:

```json
{
  "statusCode": 409,
  "message": "O horário não está disponível.",
  "path": "/api/booking/appointments"
}
```

Mensagens mínimas necessárias:

- `bookingNotice`: antecedência mínima não respeitada.
- `outsideBookingHorizon`: horário fora da janela de agendamento.
- `activeBookingLimit`: limite de reservas futuras atingido.
- `outsideAvailability`: horário fora da agenda do massoterapeuta.
- `unavailable`: horário indisponível ou disputa de concorrência.
- `appointmentNotFound`: agendamento não encontrado para o colaborador.
- `appointmentCannotCancel`: agendamento não pode mais ser cancelado.
- `invalidPeriod`: período inválido.
- `invalidDuration`: duração inválida.
- `waitlistEntryNotFound`: entrada da lista de espera não encontrada.
- `waitlistAlreadyJoined`: colaborador já está na lista para esse horário.
- `waitlistOfferExpired`: oferta da vaga expirou.
- `waitlistOfferUnavailable`: a vaga já foi aceita por outra pessoa.

## Contrato da API

### TK-04.01 — Horários disponíveis

#### `GET /booking/availability`

Query params:

- `from`: início do intervalo ISO 8601, obrigatório;
- `to`: fim do intervalo ISO 8601, obrigatório;
- `locationCode`: `SAO_PAULO` ou `LONDRINA`, opcional;
- `therapistId`: UUID do massoterapeuta, opcional.

Resposta `200 OK`:

```json
{
  "therapists": [
    { "id": "uuid", "name": "Ana Souza" }
  ],
  "slots": [
    {
      "therapistId": "uuid",
      "therapistName": "Ana Souza",
      "roomId": "uuid",
      "roomName": "Sala 1",
      "locationCode": "SAO_PAULO",
      "startsAt": "2026-10-21T12:00:00.000Z",
      "endsAt": "2026-10-21T12:20:00.000Z"
    }
  ],
  "spokenText": "Há 1 horário disponível. Quarta-feira, às 9h, com Ana Souza."
}
```

Os horários devem ser derivados de `ScheduleSlot`, removendo sessões, bloqueios e conflitos existentes. A lista vem em ordem cronológica por `startsAt ASC`, e os filtros são aplicados no backend.

Erros: `400` para período, duração ou datas inválidas; `404` para unidade ou massoterapeuta inexistente; `401` sem identificação.

### TK-04.02 — Reservar horário

#### `POST /booking/appointments`

Body `CreateAppointmentDto`:

```json
{
  "therapistId": "uuid",
  "roomId": "uuid",
  "startsAt": "2026-10-21T12:00:00.000Z",
  "endsAt": "2026-10-21T12:20:00.000Z"
}
```

Resposta `201 Created`: o `Appointment` criado, com `status: "CONFIRMED"`, `employeeId` igual ao usuário identificado e dados do terapeuta, sala e unidade necessários à interface.

Validações: antecedência mínima, janela máxima, duração configurada, agenda, horário de funcionamento, ausência de bloqueio, limite de reservas ativas e sobreposição. A operação precisa ser serializável ou usar outra proteção equivalente para que duas reservas simultâneas não ocupem o mesmo horário.

Emite `appointment.booked`, cria auditoria e cria as notificações internas previstas para a reserva.

Erros: `400` para regra temporal ou horário fora da disponibilidade; `409` para limite de reservas ou conflito de concorrência.

### TK-04.03 — Cancelar reserva

#### `DELETE /booking/appointments/:id`

Sem body. O ator é o colaborador identificado pelo cabeçalho.

Resposta `200 OK` ou `204 No Content`, conforme o padrão adotado pelo controller, sem expor dados de outro colaborador. A sessão passa a `CANCELLED`, registra `cancelledAt` e `cancelledById`, emite `appointment.cancelled` e cria a auditoria.

O cancelamento respeita a antecedência mínima configurada em `CANCELLATION_MIN_NOTICE_MINUTES`.

Erros: `404` para sessão inexistente ou pertencente a outro usuário; `400` para prazo excedido; `409` para disputa de atualização.

### TK-04.04 — Meus agendamentos

#### `GET /booking/appointments`

Query params opcionais:

- `status`: status de sessão;
- `from` e `to`: intervalo ISO 8601;
- `includePast`: booleano, padrão `true` para o histórico e `false` para a visão de próximos.

Resposta `200 OK`:

```json
{
  "upcoming": [],
  "past": [],
  "spokenText": "Você tem 1 próximo agendamento. Quarta-feira, às 9h, com Ana Souza, na Sala 1."
}
```

Os dados pertencem exclusivamente ao colaborador identificado. Ambas as listas são ordenadas cronologicamente por `startsAt ASC`; o frontend não precisa reorganizar a resposta.

### TK-04.05 — Próxima sessão

#### `GET /booking/appointments/next`

Resposta `200 OK`:

```json
{
  "appointment": {
    "id": "uuid",
    "startsAt": "2026-10-21T12:00:00.000Z",
    "endsAt": "2026-10-21T12:20:00.000Z",
    "therapistName": "Ana Souza",
    "roomName": "Sala 1",
    "locationCode": "SAO_PAULO",
    "status": "CONFIRMED"
  },
  "spokenText": "Sua próxima sessão é quarta-feira, às 9h, com Ana Souza, na Sala 1."
}
```

Sem próxima sessão, retorna `200 OK` com `appointment: null` e `spokenText` curto informando que não há sessão próxima.

### TK-04.06 — Lista de espera

#### `POST /booking/waitlist`

Body `JoinWaitlistDto`:

```json
{
  "therapistId": "uuid",
  "desiredStartsAt": "2026-10-21T12:00:00.000Z",
  "desiredEndsAt": "2026-10-21T12:20:00.000Z"
}
```

Resposta `201 Created`: `WaitlistEntry` com status `WAITING`.

#### `DELETE /booking/waitlist/:id`

Remove a entrada própria ainda não convertida. Resposta `204 No Content`.

Quando uma sessão é cancelada, o backend oferece a vaga ao primeiro `WAITING` compatível por ordem de `createdAt ASC`. A oferta é representada por uma notificação interna e expira após `WAITLIST_ACCEPTANCE_MINUTES`. O colaborador recebe o card com a mensagem `MSG-03`:

> “Uma vaga ficou disponível para você em {data}, às {hora}. Acesse a página inicial para aceitar ou recusar.”

#### `POST /booking/waitlist/:id/accept`

Sem body. Aceita somente uma oferta própria, dentro do prazo e enquanto o horário estiver livre. Cria um `Appointment` `CONFIRMED`, marca a entrada como `CONVERTED` e registra auditoria.

O job de expiração marca a oferta como expirada/cancelada e oferece a vaga ao próximo candidato sem duplicar notificações ou reservas.

Erros: `404` para entrada inexistente; `409` para duplicidade ou vaga indisponível; `410` para oferta expirada.

### TK-04.07 — Reagendamento

Não haverá rota de reagendamento no MVP. O `RF-08` tem prioridade `W` e o fluxo oficial é cancelar a sessão atual e criar uma nova reserva. Uma futura implementação de reagendamento deverá definir uma operação atômica, auditoria, concorrência, notificações e efeito sobre a lista de espera antes de alterar esta decisão.

### TK-04.08 — Auditoria de eventos de agendamento

Não cria rota nova neste ticket. Listeners de `appointment.booked` e `appointment.cancelled` persistem `AuditEvent` com:

- `actorId`;
- ação (`APPOINTMENT_CREATED` ou `APPOINTMENT_CANCELLED`);
- `entityType: "Appointment"`;
- `entityId`;
- dados mínimos antes/depois, sem dados sensíveis.

## Mudanças no modelo de dados

O modelo atual já contém `ScheduleSlot`, `Appointment`, `Notification`, `WaitlistEntry` e `AuditEvent`. Para concluir o EP-04, são necessárias as seguintes mudanças:

- adicionar à `WaitlistEntry` os campos de oferta (`offeredAt`, `offerExpiresAt`) e um estado explícito para oferta expirada, ou equivalente auditável ao estado atual;
- garantir índices para busca de fila por `status`, `desiredStartsAt`, `desiredEndsAt` e `createdAt`;
- adicionar unicidade lógica ou transação serializável que impeça duas reservas ativas no mesmo terapeuta/sala e intervalo;
- manter `Appointment.status = CONFIRMED` como estado inicial do protótipo;
- usar `Notification` para a oferta interna da fila, vinculada ao colaborador e, quando aplicável, ao agendamento;
- não armazenar dados de saúde na reserva, na notificação ou na auditoria.

As alterações de schema devem ser feitas em migração Prisma própria do épico. O contrato de eventos pode ser implementado como eventos internos do NestJS, sem tabela adicional.

## Critérios de aceite

### TK-04.01 — Horários disponíveis

- **Dado** que existem períodos de agenda, bloqueios e reservas em uma unidade;
- **Quando** o colaborador consulta disponibilidade filtrando por unidade ou massoterapeuta;
- **Então** recebe somente horários livres, em ordem cronológica, com terapeuta, sala e unidade.

### TK-04.02 — Reserva e concorrência

- **Dado** que uma tentativa concorrente sofre um deadlock transitório do PostgreSQL (`40P01`);
- **Quando** a reserva é processada;
- **Então** o serviço repete a transação uma vez e retorna o resultado correto: uma reserva criada e a concorrente com `409 Conflict`, sem expor erro interno.

- **Dado** que existe um horário livre e o colaborador está dentro das regras de antecedência e limite;
- **Quando** envia uma reserva válida;
- **Então** uma sessão `CONFIRMED` é criada, o evento `appointment.booked` é emitido e a auditoria é persistida.

- **Dado** que duas requisições tentam reservar simultaneamente o mesmo horário;
- **Quando** ambas são processadas;
- **Então** exatamente uma reserva é criada e a outra recebe `409 Conflict` com mensagem de horário indisponível.

### TK-04.03 — Cancelamento

- **Dado** que o colaborador possui uma sessão futura dentro do prazo permitido;
- **Quando** cancela essa sessão;
- **Então** ela passa a `CANCELLED`, o evento `appointment.cancelled` é emitido, a auditoria é criada e a vaga pode iniciar o fluxo da fila.

### TK-04.04 — Meus agendamentos

- **Dado** que o colaborador possui sessões futuras e anteriores;
- **Quando** consulta seus agendamentos;
- **Então** recebe somente suas sessões, separadas por período e ordenadas cronologicamente.

### TK-04.05 — Próxima sessão

- **Dado** que o colaborador possui uma sessão futura confirmada;
- **Quando** consulta a próxima sessão;
- **Então** recebe os dados do card e um `spokenText` curto com data, hora, terapeuta e sala.

### TK-04.06 — Lista de espera

- **Dado** que um horário está ocupado;
- **Quando** o colaborador entra na lista de espera;
- **Então** sua entrada é criada como `WAITING` e a posição respeita a ordem de entrada.

- **Dado** que uma sessão é cancelada e existe uma fila compatível;
- **Quando** o evento `appointment.cancelled` é processado;
- **Então** a oferta é criada para o primeiro da fila e aparece como notificação/card interno.

- **Dado** que o colaborador recebeu uma oferta ainda válida;
- **Quando** aceita a vaga;
- **Então** uma sessão `CONFIRMED` é criada para ele e a entrada passa a `CONVERTED`.

- **Dado** que o prazo de aceite expirou;
- **Quando** o job de expiração roda;
- **Então** a oferta não pode mais ser aceita e a vaga é oferecida ao próximo candidato.

### TK-04.07 — Reagendamento fora do MVP

- **Dado** que o colaborador quer outro horário;
- **Quando** segue o fluxo do MVP;
- **Então** cancela o agendamento atual e cria uma nova reserva, sem rota de reagendamento atômico.

### TK-04.08 — Auditoria

- **Dado** que uma reserva é criada ou cancelada;
- **Quando** o evento correspondente é emitido;
- **Então** um `AuditEvent` imutável é persistido com ator, ação, entidade e metadados mínimos.

## Acessibilidade, ordem e fuso

- Respostas consumidas pela interface do colaborador devem incluir `spokenText` quando houver uma mensagem para leitura.
- `spokenText` começa pela informação principal: disponibilidade, confirmação, cancelamento ou oferta.
- Horários falados usam `pt-BR` e `America/Sao_Paulo`, por exemplo “quarta-feira, às 9h”.
- Disponibilidade, agendamentos e fila são ordenados pelo backend; a interface não depende de cor, posição ou ícone.
- Cards de lembrete e oferta devem ser anunciáveis por leitor de tela, com foco gerenciado e ações textuais de aceitar, recusar ou cancelar.
- Mensagens usam somente o primeiro nome quando mencionarem pessoas e não expõem dados sensíveis.
- Datas persistidas e comparações de concorrência usam UTC; conversão para apresentação ocorre na borda da API.

## Perguntas em aberto

- Qual prioridade final deve ser atribuída a `RF-04`, `RF-06` e `RF-09`, ainda sem escolha MoSCoW registrada em D-14?
- O RH confirma o valor inicial de 30 minutos da `RN-10` antes da demonstração?
- O card de oferta deve ter ação explícita de recusar ou apenas expirar quando não for aceito?
- A API deve retornar `200 OK` ou `204 No Content` para cancelamento, mantendo consistência com os demais endpoints?
- Quais campos exatos devem aparecer no histórico de agendamentos além de data, hora, terapeuta, sala e status?

