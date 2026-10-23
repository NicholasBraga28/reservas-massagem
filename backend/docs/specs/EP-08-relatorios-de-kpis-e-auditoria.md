Status: 🟡 Planejada (especificação do épico)
Marco: M4
Épico: EP-08 · Roadmap: `docs/roadmap.md`
Tickets: TK-08.01 a TK-08.03
Requisitos: RF-21, RF-22, RNF-01, RNF-04, RNF-05
Decisões relacionadas: D-08 (decidida em 2026-10-21), D-03 (remarcação fora do MVP)

Criada em 2026-10-21. Fonte de verdade: `docs/requisitos.md`. Onde esta spec e o `requisitos.md` divergirem, vale o `requisitos.md`.

---

## Objetivo

Permitir que RH e ADMIN acompanhem a procura pelos atendimentos e os cancelamentos, consultem os eventos de auditoria dos agendamentos e filtrem os dados por período, unidade e massoterapeuta. Os resultados devem ser explicáveis por texto, completos para leitor de tela e consistentes com as datas locais das unidades.

Os KPIs do MVP, decididos em D-08, são:

1. procura por turno, exibindo manhã e tarde;
2. volume de agendamentos por todos os dias da semana;
3. procura por horário de início;
4. cancelamentos por data do atendimento, agrupados por dia, semana ou mês, com contagem absoluta e taxa.

A taxa de cancelamento é `(atendimentos cancelados ÷ atendimentos agendados) × 100`. O período de referência é a data em que o atendimento estava marcado, e não o instante em que a ação de cancelar foi feita. A taxa é zero quando não há atendimentos agendados no período.

O relatório de procura conta registros de `Appointment` pela data e hora de início previstas, incluindo os que depois foram cancelados. Assim, o total representa procura registrada; o cancelamento permanece visível na série própria. Cada registro é contado uma vez.

## Fora de escopo

- Taxa de remarcação: RF-08 está fora do MVP por D-03 e o modelo não vincula uma reserva cancelada à nova reserva. Não inferir remarcação apenas pela proximidade entre cancelamento e nova reserva do mesmo colaborador.
- KPIs de ocupação, ausência, ociosidade, lista de espera, pontualidade e colaboradores distintos, que não foram selecionados para D-08.
- Exportação CSV/PDF, alertas, metas, comparações automáticas, previsões e atualização em tempo real.
- Alteração ou exclusão de eventos de auditoria.
- Exposição de nomes, e-mails ou dados pessoais/sensíveis nos relatórios ou na auditoria.
- Dashboard e componentes visuais do frontend, entregues no EP-12.

## Atores e autorização

- `HR` pode consultar os relatórios e a auditoria.
- `ADMIN` herda o acesso de `HR`, conforme EP-02.
- `EMPLOYEE` e `THERAPIST` não podem acessar estas rotas.
- As rotas exigem identificação pelo mecanismo global do EP-02.

## Contrato da API

Prefixo global: `/api`. Datas de negócio são filtradas e agrupadas no fuso da unidade (`Location.timezone`); para São Paulo e Londrina, o fuso configurado é `America/Sao_Paulo`. Timestamps persistidos continuam em UTC.

### `GET /reports/kpis`

Consulta os KPIs escolhidos em D-08. Não altera dados.

#### Query DTO

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `from` | `YYYY-MM-DD` | Sim | Primeiro dia incluído no período, interpretado no fuso local da unidade. |
| `to` | `YYYY-MM-DD` | Sim | Último dia incluído no período; deve ser igual ou posterior a `from`. |
| `locationId` | UUID | Não | Filtra uma unidade. Sem filtro, agrega as unidades; cada uma é agrupada no próprio fuso. |
| `therapistId` | UUID | Não | Filtra um massoterapeuta. |
| `granularity` | `DAY \| WEEK \| MONTH` | Não | Granularidade da série de cancelamentos; padrão `DAY`. Semana começa na segunda-feira. |

Um `locationId` desconhecido resulta em `404 locationNotFound`; um `therapistId` sem perfil resulta em `404 therapistNotFound`. Filtros de unidade e massoterapeuta podem ser usados juntos.

#### `200 OK`

```json
{
  "range": {
    "from": "2026-10-01",
    "to": "2026-10-31",
    "granularity": "WEEK",
    "timezone": "America/Sao_Paulo"
  },
  "filters": {
    "locationId": null,
    "therapistId": null
  },
  "demand": {
    "byShift": [
      { "shift": "MORNING", "appointmentCount": 24 },
      { "shift": "AFTERNOON", "appointmentCount": 31 }
    ],
    "mostRequestedShift": "AFTERNOON",
    "byWeekday": [
      { "weekday": "MONDAY", "appointmentCount": 12 },
      { "weekday": "TUESDAY", "appointmentCount": 9 },
      { "weekday": "WEDNESDAY", "appointmentCount": 10 },
      { "weekday": "THURSDAY", "appointmentCount": 14 },
      { "weekday": "FRIDAY", "appointmentCount": 10 },
      { "weekday": "SATURDAY", "appointmentCount": 0 },
      { "weekday": "SUNDAY", "appointmentCount": 0 }
    ],
    "mostRequestedWeekday": "THURSDAY",
    "byStartTime": [
      { "time": "09:00", "appointmentCount": 3 },
      { "time": "09:20", "appointmentCount": 5 }
    ],
    "mostRequestedStartTime": "09:20"
  },
  "cancellations": [
    {
      "periodStart": "2026-10-05",
      "periodEnd": "2026-10-11",
      "scheduledAppointmentCount": 13,
      "cancelledAppointmentCount": 2,
      "cancellationRatePercent": 15.38
    }
  ],
  "spokenText": "Período de 1 a 31 de outubro. Turno mais procurado: tarde, com 31 agendamentos. Dia com maior volume: quinta-feira, com 14. Horário mais procurado: 9h20. Cancelamentos: consulte a série semanal."
}
```

Regras do resultado:

- `byShift` sempre contém manhã e tarde, nesta ordem, mesmo com contagem zero. Turno da manhã cobre início de expediente até `LUNCH_START`; tarde cobre `LUNCH_END` até `WORK_END`, usando os valores vigentes do `BusinessRulesService`. Horários são classificados pelo `startsAt` local. O intervalo de almoço não é um turno.
- `byWeekday` sempre contém segunda a domingo, nesta ordem, incluindo dias sem agendamentos.
- `byStartTime` contém todos os horários de início válidos gerados pelos parâmetros ativos de expediente, duração e passo da grade (`SESSION_DURATION_MINUTES`, `SLOT_STEP_MINUTES`), em ordem crescente e com zeros. A hora vem do `startsAt` local.
- `mostRequestedShift`, `mostRequestedWeekday` e `mostRequestedStartTime` identificam o maior total. Em empate, escolher o primeiro item na ordem estável da lista. Se o total do período for zero, retornar `null` nesses campos.
- `cancellations` contém todos os períodos que intersectam o intervalo consultado, em ordem cronológica. Períodos parciais no início ou no fim do intervalo trazem os limites efetivamente consultados em `periodStart` e `periodEnd`.
- `scheduledAppointmentCount` conta todos os registros de atendimento cujo `startsAt` cai no período, inclusive os cancelados; `cancelledAppointmentCount` conta os mesmos registros com `status = CANCELLED`. A taxa é percentual numérico arredondado a duas casas decimais.
- O agrupamento diário é por data local; o semanal usa segunda a domingo; o mensal usa o mês-calendário. Quando um período não tem registros, a série ainda retorna o período com contagem zero e taxa zero.
- Com `locationId`, `timezone` é o fuso da unidade. Sem esse filtro, as agregações usam o fuso de cada unidade antes de somar cada categoria; a resposta declara `America/Sao_Paulo`, compartilhado pelas unidades do MVP.

### `GET /audit-events`

Consulta eventos imutáveis relacionados a `Appointment`. Não altera dados.

#### Query DTO

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `from` | ISO 8601 UTC | Não | Limite inferior inclusivo de `createdAt`. |
| `to` | ISO 8601 UTC | Não | Limite superior exclusivo de `createdAt`; deve ser posterior a `from`. |
| `appointmentId` | UUID | Não | Filtra `entityType = Appointment` e o identificador do atendimento. |
| `actorId` | UUID | Não | Filtra o ator; `null` representa evento do sistema e não pode ser passado como UUID. |
| `action` | string | Não | Correspondência exata com o código da ação. |
| `limit` | inteiro | Não | Padrão `50`, mínimo `1`, máximo `100`. |
| `cursor` | UUID | Não | ID do último evento recebido para continuar a paginação. |

#### `200 OK`

```json
{
  "items": [
    {
      "id": "3b3f17c0-0f84-45b9-8d8a-05e7c8e09c3a",
      "actorId": "d1e8ec44-9203-4f89-9e45-c9498f3670c3",
      "action": "APPOINTMENT_CANCELLED",
      "entityType": "Appointment",
      "entityId": "8a3f67c2-4d41-42ad-a87d-66a73db9b1ce",
      "createdAt": "2026-10-21T14:00:00.000Z",
      "data": { "status": "CANCELLED" },
      "spokenText": "Agendamento cancelado, registrado em 21 de outubro às 11h."
    }
  ],
  "nextCursor": null,
  "spokenText": "1 evento de auditoria no período consultado."
}
```

`items` é ordenado por `createdAt DESC` e, em empate, `id DESC`. O `cursor` usa a mesma ordenação estável. `nextCursor` é o ID do último item quando houver página seguinte; caso contrário, `null`. Eventos do sistema têm `actorId: null` e devem ser anunciados como realizados pelo sistema.

O retorno não inclui nome, e-mail, dados de saúde, payloads arbitrários ou dados internos de log. `data` expõe somente campos de auditoria permitidos por uma lista explícita e segura; dados não reconhecidos são omitidos. IDs estruturados permanecem disponíveis para rastreabilidade, mas não são lidos integralmente pelo `spokenText`.

### Autorização e erros

| Status | Condição | Mensagem do catálogo |
| --- | --- | --- |
| `401` | Usuário não identificado | `messages.errors.notIdentified` |
| `403` | Papel sem permissão | `messages.errors.accessDenied` |
| `400` | Data inválida, `from > to` ou granularidade inválida | `messages.errors.invalidReportPeriod` ou `messages.errors.invalidReportFilter` |
| `400` | Cursor inválido ou inexistente | `messages.errors.invalidAuditCursor` |
| `404` | Unidade inexistente | `messages.errors.locationNotFound` |
| `404` | Perfil de massoterapeuta inexistente | `messages.errors.therapistNotFound` |

Erros seguem o envelope global da API e não incluem SQL, stack trace nem dados pessoais.

### Mensagens do catálogo

Os seguintes textos precisam ser adicionados ao catálogo de mensagens do backend:

| Chave | Texto |
| --- | --- |
| `errors.invalidReportPeriod` | `O período do relatório é inválido. Confira as datas e tente novamente.` |
| `errors.invalidReportFilter` | `Os filtros do relatório são inválidos. Confira as informações e tente novamente.` |
| `errors.invalidAuditCursor` | `Não foi possível continuar a consulta da auditoria. Atualize a lista e tente novamente.` |
| `errors.locationNotFound` | `A unidade selecionada não foi encontrada. Confira a unidade e tente novamente.` |
| `reports.kpiSummary` | Resumo curto com turno, dia e horário de maior procura e resultado dos cancelamentos, com a informação principal no início. |
| `reports.auditEvent` | Texto curto e localizado para ação e data/hora do evento, sem nome, e-mail ou ID completo. |
| `reports.auditListSummary` | Contagem de eventos retornados, em português claro e adequada a singular/plural. |

## Mudanças no modelo de dados

O MVP não precisa de novas tabelas nem colunas:

- `Appointment.startsAt`, `status`, `cancelledAt`, `therapistId` e `roomId` sustentam os agregados. A data do atendimento, `startsAt`, determina o período do KPI; `cancelledAt` permanece disponível para auditoria, mas não define o período da taxa de cancelamento.
- `Room.locationId` associa cada atendimento à unidade. `Location.timezone` determina os limites locais do período e a classificação de turno, dia e horário.
- `BusinessRules` fornece horário de expediente, almoço, duração e passo da grade. Os relatórios não repetem valores de negócio em código nem em migration.
- `AuditEvent` já contém `actorId`, `action`, `entityType`, `entityId`, `data` e `createdAt`; os registros continuam imutáveis.
- Avaliar na implementação os índices `Appointment(status, startsAt)`, `AuditEvent(actorId, createdAt)` e `AuditEvent(action, createdAt)` para sustentar filtros e agregações. Manter os índices existentes de horário e auditoria; validar o plano de consulta antes de criar migration.
- Não criar uma relação de remarcação neste épico. Uma futura entrega que reintroduza RF-08 deve modelar o vínculo entre reserva anterior e nova, em vez de inferi-lo pelo colaborador e proximidade temporal.

## Critérios de aceite

### TK-08.01 — KPIs e fórmulas (RF-21 / D-08)

- **Dado** os KPIs selecionados pelo RH, **Quando** as definições do MVP forem consultadas, **Então** devem incluir procura por manhã/tarde, volume nos sete dias da semana, procura por horário de início e cancelamentos por data do atendimento.
- **Dado** a taxa de cancelamento de um período, **Quando** for calculada, **Então** deve ser `(atendimentos cancelados ÷ atendimentos agendados) × 100`, retornando também a contagem absoluta de cancelamentos.
- **Dado** uma reserva cancelada e uma nova reserva sem vínculo explícito, **Quando** os relatórios forem calculados, **Então** não devem inferir nem apresentar uma taxa de remarcação; essa métrica permanece fora do MVP conforme D-03.
- **Dado** os limites ativos de expediente e almoço, **Quando** o relatório classificar os turnos, **Então** deve classificar inícios locais antes do almoço como `MORNING` e depois do almoço como `AFTERNOON`, sem codificar horários fixos.

### TK-08.02 — Relatórios de KPIs (RF-21)

- **Dado** um usuário `HR` ou `ADMIN` e datas válidas, **Quando** consultar `GET /reports/kpis`, **Então** deve receber os agregados do período, com filtro opcional por unidade e massoterapeuta.
- **Dado** atendimentos distribuídos entre os turnos, **Quando** o relatório for calculado, **Então** deve retornar manhã e tarde nessa ordem, incluindo zeros, e indicar o turno de maior procura.
- **Dado** um período sem registros em um ou mais dias da semana, **Quando** o relatório for calculado, **Então** deve retornar todos os sete dias na ordem segunda a domingo, com os dias vazios em zero.
- **Dado** horários válidos da grade com e sem agendamentos, **Quando** o relatório for calculado, **Então** deve retornar todos em ordem crescente, inclusive horários com zero, e identificar o de maior procura.
- **Dado** atendimentos cancelados e não cancelados com datas de serviço dentro do período, **Quando** a série for solicitada por dia, semana ou mês, **Então** deve agrupar por `startsAt` local, retornar contagem absoluta, denominador e taxa de cada período.
- **Dado** nenhum atendimento agendado em um período, **Quando** a taxa for calculada, **Então** deve retornar zero sem erro de divisão.
- **Dado** um período com empate de procura, **Quando** o relatório indicar o maior resultado, **Então** deve aplicar a ordem fixa documentada para desempate.
- **Dado** uma resposta de relatório, **Quando** for consumida por leitor de tela, **Então** deve conter `spokenText` com os principais resultados em frase curta e sem depender de gráfico, cor ou posição.
- **Dado** um usuário não identificado, ou identificado como `EMPLOYEE`/`THERAPIST`, **Quando** consultar a rota, **Então** deve receber respectivamente `401 notIdentified` ou `403 accessDenied`.
- **Dado** uma data ou filtro inválido, **Quando** consultar a rota, **Então** deve receber erro do catálogo sem detalhes internos.

### TK-08.03 — Consulta da auditoria (RF-22 / RNF-04)

- **Dado** um usuário `HR` ou `ADMIN`, **Quando** consultar `GET /audit-events` com filtros, **Então** deve receber somente eventos de `Appointment` correspondentes e somente os campos permitidos.
- **Dado** filtros de período, ação, ator ou atendimento, **Quando** a consulta retornar eventos, **Então** os limites de `createdAt` devem ser aplicados conforme contrato e os itens devem estar ordenados do mais recente para o mais antigo, com ID como desempate estável.
- **Dado** mais eventos que o limite por página, **Quando** o cliente usar `nextCursor`, **Então** deve receber páginas sem repetição nem perda de eventos enquanto os dados não forem alterados.
- **Dado** um evento de sistema, **Quando** for apresentado, **Então** `actorId` deve ser `null` e o `spokenText` deve identificá-lo como evento do sistema.
- **Dado** um evento com dados privados ou não reconhecidos no JSON, **Quando** a auditoria for consultada, **Então** esses dados não devem ser retornados nem falados; nomes e e-mails não devem aparecer na resposta.
- **Dado** um usuário não identificado ou sem papel permitido, **Quando** consultar a rota, **Então** deve receber respectivamente `401 notIdentified` ou `403 accessDenied`.
- **Dado** um cursor inválido, **Quando** continuar a consulta, **Então** deve receber `400 invalidAuditCursor` e orientação para atualizar a lista.
- **Dado** uma página de auditoria, **Quando** for lida por tecnologia assistiva, **Então** cada item deve oferecer um `spokenText` curto com ação e data/hora, e a resposta deve anunciar a quantidade de eventos.

## Acessibilidade

- `spokenText` inicia pelos resultados mais relevantes: turno de maior procura, dia de maior volume, horário mais procurado e síntese dos cancelamentos. A lista de eventos anuncia primeiro a quantidade retornada.
- Gráficos do frontend são complementares. As mesmas informações devem existir como texto e em coleções tabulares com cabeçalhos e nomes acessíveis.
- Ordenação dos arrays de KPI é determinística: turnos manhã/tarde; semana segunda a domingo; horários do mais cedo ao mais tarde; séries de cancelamento da mais antiga para a mais recente. Auditoria é da mais recente para a mais antiga, desempate por ID.
- Todas as consultas usam timestamps persistidos em UTC. Datas de serviço, rótulos de turnos e horas de início são calculados no `Location.timezone`; São Paulo e Londrina usam `America/Sao_Paulo` no MVP.
- Intervalos de datas da API são inclusivos por dia local. A implementação converte o início do primeiro dia e o início do dia seguinte ao último dia para o intervalo UTC semiaberto, evitando problemas em mudanças de horário civil.
- Nenhuma frase falada contém nome, e-mail, ID completo, dado de saúde ou payload de auditoria. IDs ficam apenas nos campos estruturados necessários à rastreabilidade.

## Perguntas em aberto

- Qual prioridade deve ser atribuída ao RF-22 (consulta de auditoria) na tabela de requisitos? Atualmente aparece como `[M/S/C/W]`; a dependência e o ticket existem, mas a prioridade não foi definida.
- Quais ações de auditoria além das ações atualmente persistidas devem entrar no filtro e receber rótulos falados localizados? O filtro aceita códigos de ação exatos e o texto deve ter fallback acessível para códigos futuros.
- Se a taxa de remarcação voltar ao MVP, qual evento ou vínculo persistente representará uma remarcação, considerando que D-03 define cancelar e reservar novamente como fluxo atual?
