# EP-05 — Presença e jobs

Status: ⬜ Planejada  
Marco: M2  
Épico: EP-05 · Roadmap: `docs/roadmap.md`  
Tickets: TK-05.01 a TK-05.05  
Requisitos: RF-06, RF-31, RN-02, RN-09, RN-16, RNF-01, RNF-05

Fonte de verdade: `docs/requisitos.md`. Onde esta spec e `docs/requisitos.md` divergirem, vale `docs/requisitos.md`.

## Objetivo

Registrar a presença do colaborador por QR Code, avisar o massoterapeuta por um canal substituível e executar jobs idempotentes que transformam sessões não atendidas ou não finalizadas nos estados definidos pela máquina de estados.

O fluxo usa o `Clock` injetado para todas as comparações de tempo, persiste instantes em UTC e apresenta horários em `America/Sao_Paulo`. Repetir um job ou receber uma segunda tentativa de check-in não pode criar efeitos duplicados.

## Fora de escopo

- Interface web do colaborador ou do massoterapeuta; o backend apenas fornece respostas e notificações.
- Alexa, intents, pareamento e lembretes falados; pertencem aos EP-06 e EP-07.
- E-mail, SMS, WhatsApp, Web Push ou qualquer canal externo de notificação.
- Login Google; a identificação continua sendo feita pelo `x-user-id` no protótipo.
- Marcação manual de `NO_SHOW` pelo massoterapeuta; pertence ao EP-06.
- Alteração dos valores de negócio pelo RH; o `BusinessRulesService` fornece os valores vigentes.
- Novas regras de agenda, reserva, cancelamento ou lista de espera; pertencem aos EP-03 e EP-04.

## Contrato comum

As rotas usam o prefixo global `/api`. Toda rota exige identificação por `x-user-id` e o papel indicado. Datas recebidas e devolvidas são ISO 8601 com timezone; o banco persiste `timestamptz` em UTC.

Respostas consumidas pela interface do massoterapeuta incluem `spokenText`, com a informação principal no início. O texto é curto, em pt-BR, não contém dados sensíveis e usa somente o primeiro nome quando mencionar uma pessoa.

Erros seguem o formato global da API:

```json
{
  "statusCode": 409,
  "message": "Check-in indisponível para este agendamento.",
  "path": "/api/booking/check-in/{token}"
}
```

### Mensagens do catálogo

| ID | Destinatário | Texto | Ações/botões |
| --- | --- | --- | --- |
| `MSG-04` | Colaborador | `Check-in confirmado para {data}, às {hora}, na {sala}.` | `Ver agendamento` ou `Fechar` |
| `MSG-05` | Massoterapeuta | `{primeiro_nome} chegou para o atendimento de hoje, às {hora}, na {sala}.` | `Abrir agenda` ou `Fechar` |
| `MSG-06` | Massoterapeuta | `{primeiro_nome} ainda não fez check-in para o atendimento de hoje, às {hora}, na {sala}.` | `Abrir agenda` ou `Fechar` |

O `MSG-04` confirma a ação ao colaborador. Os `MSG-05` e `MSG-06` são notificações separadas ao massoterapeuta, para eventos distintos. Todos devem ter `spokenText` equivalente ao texto exibido, sem token de QR, e-mail ou dados de saúde.

Outras mensagens usadas pelo épico:

| Chave | Mensagem | Uso |
| --- | --- | --- |
| `notIdentified` | `Você ainda não se identificou: escolha um usuário na tela de entrada.` | Ausência de identificação |
| `accessDenied` | `Seu perfil não tem acesso a esta função: volte para a página inicial.` | Papel não autorizado |
| `invalidCheckIn` | `Código de check-in inválido.` | Token inexistente ou sala inativa |
| `noAppointmentForRoom` | `Não há uma reserva elegível para este colaborador nesta sala.` | Nenhuma sessão compatível |
| `checkInTooEarly` | `O check-in ainda não está disponível.` | Antes da janela de RN-09 |
| `lateCheckIn` | `O limite de atraso para check-in foi excedido.` | Depois da tolerância de RN-02 |
| `checkInUnavailable` | `Check-in indisponível para este agendamento.` | Concorrência ou estado alterado |
| `invalidStatusTransition` | `Esta ação não está disponível para este atendimento agora. Consulte a agenda para ver a situação dele.` | Transição incompatível |

## Contrato da API

### `POST /api/booking/check-in/:token`

Permite ao `EMPLOYEE` validar a presença lendo o QR Code da `Room`. Não há DTO de corpo. `token` é uma string opaca e nunca aparece em mensagens faladas, logs ou respostas de erro.

Critérios para localizar a sessão:

- a `Room` existe e está ativa;
- a sessão pertence ao usuário identificado pelo `x-user-id`;
- o estado é `CONFIRMED`;
- o instante está entre `startsAt - CHECK_IN_EARLY_MINUTES` e `startsAt + LATE_ARRIVAL_TOLERANCE_MINUTES`;
- a sessão usa a mesma `Room` do QR Code.

Resposta `200 OK`:

```json
{
  "id": "appointment-uuid",
  "status": "CHECKED_IN",
  "checkedInAt": "2026-10-21T13:55:00.000Z",
  "startsAt": "2026-10-21T14:00:00.000Z",
  "endsAt": "2026-10-21T14:20:00.000Z",
  "roomId": "room-uuid",
  "spokenText": "Check-in confirmado para hoje, às 11h, na Sala 1."
}
```

Os campos estruturados permanecem em UTC; somente o `spokenText` usa `America/Sao_Paulo`. Uma segunda requisição após a mudança de estado retorna `409` com `checkInUnavailable` e não cria outra notificação nem altera `checkedInAt`.

| HTTP | Mensagem |
| --- | --- |
| 401 | `notIdentified` |
| 403 | `accessDenied` |
| 404 | `invalidCheckIn`, `noAppointmentForRoom`, `checkInTooEarly` ou `lateCheckIn`, conforme a causa |
| 409 | `checkInUnavailable` |

### `GET /api/notifications`

Consulta avisos persistidos para o usuário autenticado. A rota é destinada à tela; a entrega externa não faz parte do EP-05.

Papéis: `THERAPIST` consulta avisos destinados a ele. `EMPLOYEE` consulta os próprios avisos. Nenhum usuário consulta avisos de outra pessoa.

DTO de query `NotificationQueryDto`:

```ts
type NotificationQueryDto = {
  status?: "PENDING" | "SENT" | "FAILED" | "CANCELLED";
  limit?: number;
  cursor?: string;
};
```

`limit` fica entre 1 e 100, com padrão 50. A ordenação é `scheduledFor ASC, id ASC`.

Resposta `200 OK`:

```json
{
  "items": [
    {
      "id": "notification-uuid",
      "appointmentId": "appointment-uuid",
      "kind": "CHECK_IN_CONFIRMATION",
      "status": "PENDING",
      "scheduledFor": "2026-10-21T13:55:00.000Z",
      "spokenText": "Check-in confirmado para hoje, às 11h, na Sala 1."
    }
  ],
  "nextCursor": null,
  "spokenText": "Você tem 1 aviso. Check-in confirmado para hoje, às 11h, na Sala 1."
}
```

Erros: `401` com `notIdentified`, `403` com `accessDenied` e `400` com `invalidPeriod` para query inválida.

### Jobs internos

Os jobs não têm rota pública. São registrados pelo Nest Scheduler e recebem `Clock`, `PrismaService`, `BusinessRulesService` e `NotificationChannel` por injeção. Cada job pode ser chamado diretamente nos testes.

#### `AttendanceToleranceJob`

Executado a cada minuto. Busca apenas appointments `CONFIRMED` cujo início mais `LATE_ARRIVAL_TOLERANCE_MINUTES` já passou. Para cada item, faz atualização condicional para `POSSIBLE_NO_SHOW` e cria um aviso `MSG-06` ao `Therapist` pelo `NotificationChannel`.

Se executado novamente, não atualiza a sessão nem cria outro aviso. Uma falha em uma sessão não impede as demais.

#### `AppointmentCompletionJob`

Executado a cada minuto. No TK-05.04, busca appointments `IN_PROGRESS` cujo `endsAt` já passou e atualiza para `COMPLETED`, preenchendo `sessionEndedAt` com o instante do `Clock`. O TK-05.05 estende o job para cobrir `CHECKED_IN` que nunca foi iniciado, conforme D-06.

O job não modifica `CANCELLED`, `RELEASED`, `NO_SHOW` ou sessões futuras. Repeti-lo não altera `sessionEndedAt` nem gera avisos duplicados.

### `NotificationChannel`

Contrato interno usado pelos serviços de presença e jobs:

```ts
type NotificationMessage = {
  recipientId: string;
  appointmentId?: string;
  kind: "CHECK_IN_CONFIRMATION" | "EMPLOYEE_CHECKED_IN" | "POSSIBLE_NO_SHOW";
  message: string;
  spokenText: string;
  scheduledFor: Date;
};

interface NotificationChannel {
  notify(message: NotificationMessage): Promise<void>;
}
```

O token de injeção é `NOTIFICATION_CHANNEL`. `InMemoryNotificationChannel` implementa o contrato nos testes e guarda as mensagens recebidas para asserção. A implementação persistente grava `Notification` antes de qualquer entrega externa. Services de domínio não chamam webhook, Alexa ou SDK diretamente.

## Mudanças no modelo de dados

O schema atual já contém a base necessária:

- `Appointment.checkedInAt` registra o instante do check-in.
- `Appointment.sessionStartedAt` e `Appointment.sessionEndedAt` registram o ciclo da sessão.
- `Appointment.status` usa `CHECKED_IN`, `POSSIBLE_NO_SHOW`, `IN_PROGRESS` e `COMPLETED`.
- `Room.checkInToken` é único e identifica o QR Code da sala sem expor o ID da sala.
- `Notification` persiste destinatário, appointment, tipo, estado, horário, texto falado, envio e erro.
- Os índices de `Notification(status, scheduledFor)` e `Appointment(status, startsAt/endsAt)` sustentam os jobs.

Implementação prevista:

- reutilizar essas colunas e enums, sem criar uma tabela paralela de presença;
- adicionar `NotificationKind.POSSIBLE_NO_SHOW` se ainda não existir no momento do ticket;
- adicionar `NotificationKind.EMPLOYEE_CHECKED_IN` para separar o aviso `MSG-05` da possível ausência;
- manter a unicidade lógica do aviso por `(appointmentId, recipientId, kind)` no service ou, se a concorrência exigir, formalizá-la com índice único em migration;
- não armazenar o token do QR em notificações, logs ou `spokenText`;
- acompanhar qualquer migration com e2e contra PostgreSQL.

## Critérios de aceite

### TK-05.01 — `NotificationChannel` e avisos persistidos

**RF-31 / RNF-01 — contrato substituível e aviso acessível**

- **Dado** um `NotificationChannel` configurado com `NOTIFICATION_CHANNEL`, **Quando** um serviço emitir uma notificação para o massoterapeuta, **Então** deve chamar somente a interface do canal e não conhecer a implementação concreta.
- **Dado** o `InMemoryNotificationChannel`, **Quando** receber uma notificação, **Então** deve guardar destinatário, appointment, tipo, `message`, `spokenText` e `scheduledFor` para inspeção no teste.
- **Dado** uma notificação emitida, **Quando** for persistida, **Então** deve existir um registro `Notification` com `PENDING`, `recipientId`, `appointmentId`, tipo e texto pronto para leitura.
- **Dado** duas tentativas de persistir o mesmo aviso lógico, **Quando** forem processadas, **Então** deve existir apenas um aviso para o mesmo appointment, destinatário e tipo.
- **Dado** uma lista de avisos de um massoterapeuta, **Quando** for consultada, **Então** deve retornar somente seus registros, em ordem cronológica, com `spokenText` e sem dados sensíveis.

### TK-05.02 — Check-in por QR Code

**RF-06 / RN-02 / RN-09 — validar presença dentro da janela**

- **Dado** um colaborador identificado, uma sala ativa e uma sessão `CONFIRMED` nessa sala, **Quando** enviar o QR Code entre 15 minutos antes do início e o limite de atraso configurado, **Então** a sessão deve mudar para `CHECKED_IN`, preencher `checkedInAt` pelo `Clock` e retornar sucesso com `MSG-04`.
- **Dado** um check-in aceito, **Quando** a operação terminar, **Então** deve ser emitido `MSG-04` ao colaborador e `MSG-05` ao massoterapeuta pelo `NotificationChannel`.
- **Dado** uma tentativa antes da janela de RN-09, **Quando** o colaborador ler o QR Code, **Então** a API deve responder `404` com `checkInTooEarly` e não alterar a sessão.
- **Dado** uma tentativa depois da tolerância de RN-02, **Quando** o colaborador ler o QR Code, **Então** a API deve responder `404` com `lateCheckIn` e não alterar a sessão.
- **Dado** um QR Code inexistente, uma sala inativa ou uma sessão de outra sala, **Quando** o colaborador tentar o check-in, **Então** a API deve responder com a mensagem de catálogo correspondente e não revelar o token nem dados de outro usuário.
- **Dado** duas requisições simultâneas para o mesmo appointment, **Quando** ambas tentarem o check-in, **Então** exatamente uma deve mudar o estado e a outra deve receber `checkInUnavailable`, sem notificações duplicadas.

### TK-05.03 — Job de tolerância

**RN-02 — possível ausência após o limite de atraso**

- **Dado** uma sessão `CONFIRMED` cujo início mais a tolerância já passou e sem `checkedInAt`, **Quando** o `AttendanceToleranceJob` executar, **Então** a sessão deve mudar para `POSSIBLE_NO_SHOW` usando uma transição autorizada pelo sistema.
- **Dado** uma sessão transformada em `POSSIBLE_NO_SHOW`, **Quando** o job executar, **Então** deve emitir um único `MSG-06` ao massoterapeuta pelo `NotificationChannel`.
- **Dado** uma sessão futura ou ainda dentro da tolerância, **Quando** o job executar, **Então** ela não deve ser alterada nem gerar aviso.
- **Dado** o job executado duas vezes para a mesma sessão, **Quando** ambas as execuções terminarem, **Então** o estado deve continuar `POSSIBLE_NO_SHOW` e deve existir apenas um aviso.
- **Dado** uma sessão `CHECKED_IN`, `IN_PROGRESS`, `CANCELLED`, `RELEASED`, `NO_SHOW` ou `COMPLETED`, **Quando** o job executar, **Então** ela não deve ser marcada como possível ausência.

### TK-05.04 — Job de conclusão automática

**RN-16 — concluir sessão em andamento no horário de término**

- **Dado** uma sessão `IN_PROGRESS` cujo `endsAt` já passou, **Quando** o `AppointmentCompletionJob` executar, **Então** ela deve mudar para `COMPLETED` e preencher `sessionEndedAt` com o instante do `Clock`.
- **Dado** uma sessão `IN_PROGRESS` cujo `endsAt` ainda não chegou, **Quando** o job executar, **Então** ela deve permanecer `IN_PROGRESS`.
- **Dado** o job executado duas vezes para a mesma sessão, **Quando** ambas as execuções terminarem, **Então** deve haver uma única conclusão e o primeiro `sessionEndedAt` deve ser preservado.
- **Dado** uma sessão `CANCELLED`, `RELEASED`, `NO_SHOW` ou `COMPLETED`, **Quando** o job executar, **Então** ela não deve ser reaberta nem alterada.

### TK-05.05 — `CHECKED_IN` sem início

**D-06 / máquina de estados — concluir check-in não iniciado**

- **Dado** uma sessão `CHECKED_IN` com `endsAt` no passado e sem `sessionStartedAt`, **Quando** o `AppointmentCompletionJob` executar, **Então** ela deve mudar para `COMPLETED` e preencher `sessionEndedAt`.
- **Dado** uma sessão `CHECKED_IN` cujo `endsAt` ainda não chegou, **Quando** o job executar, **Então** ela deve permanecer `CHECKED_IN`.
- **Dado** uma sessão `CHECKED_IN` concluída automaticamente, **Quando** o job for executado novamente, **Então** não deve haver nova transição, nova notificação ou alteração do horário de conclusão.
- **Dado** uma sessão `CHECKED_IN` sem início, **Quando** ela for concluída automaticamente, **Então** a auditoria deve identificar a transição como realizada pelo sistema, sem registrar dados sensíveis.

## Acessibilidade

- Toda resposta destinada à tela do massoterapeuta inclui `spokenText`; a informação principal aparece nas primeiras palavras.
- `MSG-04` confirma a ação ao colaborador; `MSG-05` anuncia a chegada e `MSG-06` a possível ausência ao massoterapeuta. São mensagens distintas para não misturar destinatários ou eventos.
- Listas de notificações são ordenadas pelo backend por data de programação e identificador estável, para leitura consistente por leitor de tela.
- Horários falados usam pt-BR e `America/Sao_Paulo`, por exemplo “hoje, às 11h”; timestamps estruturados permanecem em UTC.
- O QR Code é apenas o mecanismo de entrada: a resposta textual confirma o resultado e não depende de cor, ícone ou posição.
- Mensagens faladas e avisos usam somente o primeiro nome do colaborador e nunca incluem token, e-mail, dados de saúde ou conteúdo interno de logs.
- Avisos novos devem ser expostos pelo frontend em região anunciável, como `aria-live`; o backend fornece `spokenText` e não pressupõe que o usuário veja um badge.
- As ações `Ver agendamento`, `Abrir agenda` e `Fechar` devem ter nomes acessíveis e foco gerenciado após a atualização do aviso.

## Perguntas em aberto

- Os valores iniciais de `LATE_ARRIVAL_TOLERANCE_MINUTES` (10) e `CHECK_IN_EARLY_MINUTES` (15) serão confirmados pelo RH antes da demonstração?
- O aviso ao massoterapeuta deve informar apenas que o colaborador chegou ou também data, hora e sala? Esta spec assume data, hora e sala, conforme `MSG-05`.
- A consulta de notificações deve marcar avisos como lidos no EP-05 ou somente retornar o status de entrega? A marcação de leitura não está no modelo atual.
- O canal persistente do protótipo será somente a tabela `Notification` ou haverá uma implementação de entrega local para a tela antes do EP-06?
- O RH precisa de uma rota operacional para executar jobs manualmente em ambiente de demonstração, ou os jobs serão acionados exclusivamente pelo Scheduler?
