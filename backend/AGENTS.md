# AGENTS.md
 
Backend de um sistema de agenda acessível para massoterapeutas com deficiência visual, desenvolvido no Desafio de Inovação do Programa de Estágio Semantix 2026.
 
Antes de qualquer tarefa, leia:
 
- `CONTEXT.md`: domínio, problema, decisões tomadas, regras de negócio e detalhes da Alexa.
- `docs/requisitos.md`: requisitos com IDs (RF, RN, RNF). É o contrato do projeto.
- `docs/roadmap.md`: ordem de execução, épicos e tickets.
Se este arquivo, o `CONTEXT.md` e o `docs/requisitos.md` divergirem, o `docs/requisitos.md` vence. Aponte a divergência em vez de escolher sozinho.
 
O `CONTEXT.md` e o `docs/requisitos.md` descrevem o domínio em português. **No código, tudo é em inglês**, seguindo o glossário abaixo.
 
## Idioma
 
- **Código 100% em inglês:** pastas, arquivos, classes, interfaces, métodos, variáveis, enums, tabelas, colunas, rotas, nomes de testes e mensagens de commit.
- **Exceções em português:** textos exibidos ou falados ao usuário final (catálogo de mensagens, frases do modelo de interação da Alexa em `pt-BR`) e mensagens de erro retornadas ao usuário.
- IDs de requisitos (RF-11, RN-07) continuam como estão, inclusive nos nomes de testes e commits.
## Glossário de domínio
 
Use sempre estes nomes. Não crie sinônimos.
 
| Português (docs) | Inglês (código) |
| --- | --- |
| Terapeuta / massoterapeuta | `Therapist` |
| Colaborador | `Employee` |
| RH | papel `HR` |
| Suporte da aplicação | papel `ADMIN` |
| Sala | `Room` |
| Agenda diária do terapeuta | `Schedule` (cada período com data, sala e terapeuta: `ScheduleSlot`; sem recorrência) |
| Horário disponível | `AvailableSlot` |
| Bloqueio de horário (pelo RH ou pelo terapeuta) | `ScheduleBlock` |
| Sessão / atendimento | `Appointment` |
| Lista de espera / fila | `Waitlist` (cada entrada: `WaitlistEntry`) |
| Check-in | `CheckIn` |
| Tolerância de atraso | `lateArrivalTolerance` |
| Possível ausência / ausência | `PossibleNoShow` / `NoShow` |
| Dispositivo Alexa | `AlexaDevice` |
| Pareamento | `Pairing` |
| Lembrete | `Reminder` |
| Avaliação | `Feedback` |
| Evento de auditoria | `AuditEvent` |
| Relógio | `Clock` |
| Canal de notificação | `NotificationChannel` |
| Regras de negócio (parâmetros) | `BusinessRules`, lidas sempre pelo `BusinessRulesService` |
 
**Estados de `Appointment`** (`AppointmentStatus`):
 
| Docs | Código |
| --- | --- |
| reservada | `BOOKED` |
| confirmada | `CONFIRMED` |
| chegou | `CHECKED_IN` |
| possivel_ausencia | `POSSIBLE_NO_SHOW` |
| em_andamento | `IN_PROGRESS` |
| concluida | `COMPLETED` |
| cancelada | `CANCELLED` |
| liberada | `RELEASED` |
| ausente | `NO_SHOW` |
 
## Stack
 
- Node.js + TypeScript (`strict: true`, sem `any`)
- NestJS, seguindo a estrutura e as convenções da documentação oficial (docs.nestjs.com)
- PostgreSQL
- ORM: Prisma
- Configuração: `@nestjs/config` com validação das variáveis de ambiente
- Validação de entrada: `ValidationPipe` global com `class-validator` e `class-transformer`
- Agendador: `@nestjs/schedule`, com um job que roda a cada minuto e lê o estado do banco
- Eventos: `@nestjs/event-emitter`
- Testes: Jest (unitários com `Test.createTestingModule`), Supertest (e2e em `test/`)
- Alexa: endpoint HTTPS próprio (skill customizada). O SDK da Alexa é usado só para verificar a assinatura das requisições; o restante é JSON puro.
## Comandos
 
Rodar dentro de `backend/`. Copie `.env.example` para `.env` antes de subir a aplicação: ela não inicia com variáveis faltando ou inválidas.

```bash
docker compose up -d     # PostgreSQL local
npm run prisma:deploy    # aplica as migrations
npm run start:dev        # rodar a aplicação (API em http://localhost:3000/api)
npm run test             # testes unitários (Jest)
npm run test:e2e         # e2e e integração com banco real (sobe o postgres-test na porta 5433)
npm run lint             # ESLint
npm run format           # Prettier (format:check só verifica)
npm run build            # compila para dist/
```

Testes com banco real ficam em `test/` (`*.e2e-spec.ts`) e rodam contra o serviço `postgres-test` do `docker-compose.yml` (perfil `test`, dados em memória). A cada execução o schema é recriado e todas as migrações são aplicadas; o `test/support/` oferece `createTestApp()` (aplicação inteira, com a mesma configuração do `main.ts`) e `truncateAllTables()` para o `beforeEach`. O ambiente dos testes é fixo (`test/support/test-environment.ts`) e não lê o `.env`. A CI pode apontar outro banco com `TEST_DATABASE_URL`, desde que o nome termine em `_test`.
 
## Estrutura do projeto
 
Segue o padrão de **feature modules** da documentação oficial do NestJS. Cada recurso é um módulo com controller, service, DTOs e entidades. Gere novos recursos com o CLI (`nest g resource <nome>`) e ajuste o resultado, em vez de criar os arquivos à mão.
 
```
src/
  main.ts
  app.module.ts
  config/
    configuration.ts              # carrega e tipa as variáveis de ambiente
    env.validation.ts             # validação na inicialização
    business-rules.config.ts      # valores iniciais das RN (prazos, tolerância, limites), vindos do ambiente
  common/
    clock/                        # Clock (interface), SystemClock, token CLOCK
    decorators/
    filters/                      # filtros de exceção
    guards/
    interceptors/
    pipes/
  business-rules/                 # BusinessRulesService: parâmetros vigentes, editáveis pelo RH (RF-27)
  therapists/
  employees/
  rooms/
  schedules/                      # grade e cálculo de horários disponíveis
  appointments/                   # reserva, cancelamento, máquina de estados
  waitlist/
  attendance/                     # confirmação, check-in, tolerância, no-show, jobs
  notifications/                  # NotificationChannel, catálogo de mensagens
  alexa/                          # guard de assinatura, intents, pareamento, lembretes
  audit/
  reports/                        # KPIs e relatórios do RH
  auth/                           # identificação por x-user-id no protótipo; login Google no roadmap
test/
  app.e2e-spec.ts
  jest-e2e.json
```
 
Dentro de um módulo, como no `nest g resource`:
 
```
appointments/
  appointments.module.ts
  appointments.controller.ts
  appointments.controller.spec.ts
  appointments.service.ts
  appointments.service.spec.ts
  appointment-status.ts             # enum e tabela de transições
  dto/
    create-appointment.dto.ts
    update-appointment.dto.ts
  entities/
    appointment.entity.ts
  events/
    appointment-cancelled.event.ts
  listeners/
    appointment-cancelled.listener.ts
```
 
Pastas extras só quando o módulo precisar delas (`events/`, `listeners/`, `jobs/`, `guards/`, `interfaces/`). Não crie pastas vazias.
 
### Responsabilidades
 
- **Controllers** recebem a requisição, validam com DTOs e chamam o service. Sem regra de negócio.
- **Services** concentram a regra de negócio do módulo. Se um service passar de ~300 linhas ou acumular responsabilidades distintas, divida em services menores no mesmo módulo (por exemplo, `AppointmentBookingService` e `AppointmentCancellationService`).
- **Entities** representam as tabelas. A máquina de estados de `Appointment` fica em `appointment-status.ts`, como função pura e testável, chamada pelo service.
- **Providers customizados** (`useClass`, `useValue`, `useFactory` com tokens) para tudo que precisa ser trocado em testes ou por outra implementação: `Clock`, `NotificationChannel`, clientes da Alexa.
- **Módulos se comunicam** pelos services exportados (`exports`) ou por eventos. Nunca importe um repositório ou entidade de outro módulo diretamente: peça ao service do módulo dono.
- **Dependências circulares** entre módulos indicam desenho errado. Resolva com eventos, não com `forwardRef`.
### Convenções de nomes
 
Seguem as do CLI do NestJS.
 
| Elemento | Convenção | Exemplo |
| --- | --- | --- |
| Pastas de módulo | `kebab-case`, plural | `appointments/` |
| Arquivos | `kebab-case.<tipo>.ts` | `appointments.service.ts`, `create-appointment.dto.ts` |
| Classes | `PascalCase` com sufixo do tipo | `AppointmentsService`, `CreateAppointmentDto`, `AlexaSignatureGuard` |
| Interfaces | `PascalCase`, sem prefixo `I` | `NotificationChannel` |
| Tokens de injeção | `UPPER_SNAKE_CASE` | `NOTIFICATION_CHANNEL`, `CLOCK` |
| Métodos e variáveis | `camelCase`, verbos para métodos | `markAsNoShow()`, `lateArrivalTolerance` |
| Booleanos | prefixo `is`, `has`, `can`, `should` | `isWithinCheckInWindow` |
| Enums | `PascalCase`, membros `UPPER_SNAKE_CASE` | `AppointmentStatus.NO_SHOW` |
| Tabelas e colunas | `snake_case`, tabelas no plural | `appointments.started_at` |
| Rotas | `kebab-case`, recursos no plural | `POST /appointments/:id/check-in` |
| Testes | `describe` pela classe; `it` citando o ID | `it('RN-03: releases an unconfirmed appointment after the deadline')` |
 
## SOLID na prática
 
- **S — Responsabilidade única.** Uma classe, um motivo para mudar. Um service não formata mensagem nem envia notificação: delega ao módulo `notifications`.
- **O — Aberto/fechado.** Novos canais de notificação e novos intents da Alexa entram como novas classes, sem editar as existentes.
- **L — Substituição de Liskov.** Toda implementação de `NotificationChannel` (Alexa, push, e-mail, em memória) se comporta igual do ponto de vista de quem a usa. O dublê de teste segue o mesmo contrato.
- **I — Segregação de interfaces.** Interfaces pequenas e específicas. Um provider não deve expor métodos que seus consumidores não usam.
- **D — Inversão de dependência.** Services dependem de interfaces injetadas por token (`@Inject(NOTIFICATION_CHANNEL)`), não de SDKs ou clientes concretos.
## Clean Code
 
- Funções curtas, com um nível de abstração. Mais de ~20 linhas é sinal para extrair.
- No máximo 3 parâmetros; acima disso, um objeto tipado.
- Nomes revelam intenção, sem abreviações (`appointment`, não `appt`).
- Sem números mágicos: valores de negócio vêm do `BusinessRulesService`; constantes técnicas viram constantes nomeadas.
- Guard clauses e retorno antecipado em vez de `if` aninhado.
- **Sem comentários no código**, de nenhum tipo (`//`, `/* */`, JSDoc), e sem código comentado. Vale para `src/`, `test/` e `prisma/`. Exceções: as migrações já aplicadas em `prisma/migrations/` não são editadas (o Prisma confere o checksum) e o `.env.example` documenta as variáveis. Se um trecho precisa de explicação, ele ainda não está claro: extraia uma função, uma constante, uma variável booleana ou um tipo com nome que revele a intenção (`isSimulatorUsingApplicationUserId`, `type MinutesSinceMidnight = number`). O **porquê** de uma decisão vai para os testes, o `CONTEXT.md`, uma ADR em `docs/adr/` ou a mensagem de commit.
- Erros: use as exceções HTTP do Nest (`NotFoundException`, `ConflictException`) nos controllers e services. Para regras de negócio, crie exceções nomeadas (`SlotUnavailableException`, `InvalidStatusTransitionException`) estendendo as do Nest. Nunca lance `Error` genérico nem strings.
- `readonly` em DTOs e em propriedades que não mudam.
- Estado de `Appointment` só muda por métodos com intenção no service (`confirm`, `cancel`, `checkIn`), que validam a transição. Nunca atribua `status` diretamente fora deles.
## Design patterns
 
Use estes padrões onde indicado. Fora disso, não introduza padrões sem necessidade (YAGNI).
 
| Padrão | Onde | Para quê |
| --- | --- | --- |
| **Dependency Injection** (nativo do Nest) | Todo o projeto | Desacoplar e permitir dublês nos testes |
| **Repository** | Acesso a dados via ORM, dentro de cada service | Concentrar consultas; com TypeORM, `@InjectRepository`; com Prisma, um service de acesso por módulo |
| **Strategy** | `NotificationChannel` (Alexa, push, e-mail, em memória) | Trocar ou somar canais sem mudar regras |
| **Adapter** | Clientes da Alexa, e-mail, push, Google | Isolar SDKs e APIs externas atrás de interfaces |
| **Chain of Responsibility** | Handlers de intents da Alexa (`AlexaIntentHandler` com `canHandle()` e `handle()`) | Cada intent é uma classe; o controller só despacha |
| **State** | Transições de `AppointmentStatus` | Tabela de transições válidas; transição inválida lança exceção |
| **Observer** (eventos do Nest) | `appointment.cancelled`, `appointment.released`, `employee.checked-in` | Services emitem eventos; listeners notificam, auditam, oferecem a vaga à fila e criam/apagam lembretes da Alexa |
| **Guard** (nativo do Nest) | `AlexaSignatureGuard`, autenticação | Validar acesso fora do controller |
 
## Estado atual do código

Já existe um primeiro corte do backend (commit `01ed938`) que **não segue** este arquivo. Decisão de 2026-10-16: **refatorar aos poucos**. Schema Prisma, regras já testadas e o tratamento de concorrência são aproveitados.

Regra da refatoração: ao mexer em um trecho, leve-o para a estrutura, o glossário e as convenções deste arquivo. Não reescreva o que está fora da fase atual.

| Hoje | Alvo |
| --- | --- |
| Um único `AppModule` com todos os providers | Feature modules (seção "Estrutura do projeto") |
| `src/booking/` | `appointments/`, `schedules/`, `waitlist/`, `attendance/` |
| `src/therapist/` | `therapists/` |
| `slotsForWindow`, `AvailabilityDto` e `addAvailability` (cálculo e cadastro legados de `ScheduleSlot`) | Nomes do glossário no módulo `schedules/` (TK-03.03) |
| `src/admin/` | Cadastros nos módulos donos; indicadores do RH em `reports/` |
| `src/domain/policy.service.ts` | Regras em cada módulo, parâmetros lidos do `BusinessRulesService` |
| Parâmetros de negócio guardados no banco (`business_rules`), ainda sem edição | Editáveis pelo RH, com atualização do cache e auditoria (RF-27, TK-03.07) |
| `src/messages/catalog.ts` | `notifications/messages.ts` |
| `new Date()` em `alexa.controller.ts` e no cálculo de "hoje" do terapeuta (usa o fuso do servidor) | `Clock` injetado e dia calculado em `America/Sao_Paulo` (TK-06.02, TK-07.03) |
| `ALEXA_USER_MAP` e intents que pedem o ID do atendimento | `AlexaDevice` com pareamento (RF-17) e comandos sem identificador |
| Alexa sem verificação de assinatura | `AlexaSignatureGuard` (RNF-03) |
| `NOTIFICATION_WEBHOOK_URL` | `NotificationChannel` |

## Roadmap

O roadmap completo fica em **`docs/roadmap.md`**: marcos, épicos (EP-NN), tickets (TK-NN.MM), dependências, decisões pendentes e o fluxo spec → tickets → implement.

- Trabalhe sempre a partir de um ticket do `docs/roadmap.md`, respeitando a coluna "Depende de".
- Ticket marcado 🔒 não é implementado: a decisão pendente vem antes.
- Ao concluir um ticket, atualize o status dele no `docs/roadmap.md` no mesmo PR.
- O EP-00 (Fundação) foi concluído em 2026-10-19, junto com os testes e2e (TK-00.06); a CI (`.github/workflows/backend-ci.yml`: lint, format:check, testes unitários, build e e2e) e a limpeza do `tsbuildinfo` chegaram em 2026-10-21.
- O marco M1 (Domínio) está concluído: EP-01 em 2026-10-19 e EP-02 em 2026-10-20. Toda rota nova exige identificação por padrão, declara papéis com `@Roles` e entra na matriz de permissões (`test/permissions.e2e-spec.ts`); exceções levam `@Public()`.
- A spec do EP-03 (Cadastros do RH) está em `docs/specs/EP-03-cadastros-do-rh.md`.
- O Fora do MVP (login Google, e-mail, Web Push, feedback, Google Calendar, campainha virtual) não é iniciado sem pedido explícito.
 
## Regras de trabalho
 
- **Branches.** Antes de tocar um EP pela primeira vez, crie a branch do EPIC seguindo Conventional Commits: `<tipo>/<EP-xx-nome-da-feature>`, em que `<tipo>` é um dos tipos de commit (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`). Exemplo: `feat/EP-03-cadastros-do-rh`. Uma branch por EP, não por ticket; os tickets do EP são commitados nessa branch.
- **TDD nas regras de negócio.** Toda RN e todo critério de aceite começa por um teste falhando, depois o código mínimo, depois a refatoração.
- **Testes.** Unitários ao lado do arquivo (`*.spec.ts`), com `Test.createTestingModule` e providers substituídos por dublês. Tudo o que precisa de banco real (restrições, migrações, seed, concorrência, fluxos principais pela API) fica em `test/` como `*.e2e-spec.ts` e roda com `npm run test:e2e`; cada teste cria os próprios dados e esvazia as tabelas no `beforeEach`.
- **Rastreabilidade.** Nomes de testes e mensagens de commit citam o ID de `docs/requisitos.md`: `RN-03: release unconfirmed appointment after deadline`.
- **Commits** sempre no padrão [Conventional Commits](https://www.conventionalcommits.org/), em inglês: `<tipo>(<escopo>): <descrição>`, com o escopo igual ao módulo e citando o ticket e os IDs de requisito: `feat(appointments): TK-05.02 RF-02 book available slot`. Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`. Mudança incompatível leva `!` (`feat(appointments)!: ...`). Commits e PRs **não** levam linha `Co-Authored-By: Claude` nem qualquer outra marca de autoria de IA (como "Generated with Claude Code").
- **Não suponha.** Campo marcado como `[PREENCHER]`, `[VALIDAR]`, `[DECIDIR]` ou `[CONFIRMAR]` não é preenchido por conta própria: pare e pergunte.
- **Parâmetros de negócio.** Nenhum número de regra de negócio fica fixo no código nem é lido direto de `process.env`: tudo vem do `BusinessRulesService`.
- **Tempo.** Datas em UTC (`timestamptz`). Conversão para `America/Sao_Paulo` só na borda (respostas da Alexa, mensagens). Nunca `new Date()` ou `Date.now()` em regra de negócio: use o `Clock` injetado.
- **Jobs idempotentes.** Rodar o mesmo job duas vezes não gera dois avisos nem libera a mesma vaga duas vezes. Testado.
- **Concorrência.** Reserva e oferta de vaga impedem que duas pessoas fiquem com o mesmo horário (restrição única no banco e/ou transação com bloqueio). Testado.
- **Canais isolados.** Toda saída para o usuário passa por `NotificationChannel`. Services de negócio nunca chamam Alexa, e-mail ou push diretamente.
- **Mensagens.** Textos ao usuário vêm de `notifications/messages.ts` (em português), nunca escritos direto no código. Informação principal nas primeiras palavras, frases curtas, só o primeiro nome do colaborador.
- **Privacidade.** Nenhum dado de saúde em logs, eventos de calendário ou mensagens faladas. Logs só com IDs, usando o `Logger` do Nest.
- **Segredos.** Tokens e chaves só em variáveis de ambiente. Nunca em código, testes, fixtures ou commits.
- **Testes não chamam serviços externos.** Alexa, Google e e-mail são substituídos por dublês.
- **Escopo.** Não adicione dependências, módulos ou funcionalidades fora da fase atual sem perguntar.
## Acessibilidade
 
O massoterapeuta com deficiência visual é o usuário principal. Toda funcionalidade que chega até ele, por qualquer canal, precisa funcionar só com leitor de tela ou só com voz, sem depender de visão. No backend, isso significa:
 
- **Respostas da API prontas para leitura.** Endpoints consumidos pela tela do terapeuta devolvem, além dos dados estruturados, um texto curto pronto para leitura (`spokenText` ou equivalente), com a informação principal nas primeiras palavras. Nada que dependa de cor, ícone ou posição na tela para fazer sentido.
- **Listas em ordem.** Agendas e listas já vêm ordenadas cronologicamente pelo backend. O frontend não deve precisar reorganizar para a leitura fazer sentido.
- **Horários falados como se fala.** Datas e horas formatadas em `pt-BR`, no fuso `America/Sao_Paulo`, por extenso quando forem faladas ("às 14h", "amanhã às 9h"), nunca em ISO ou UTC.
- **Erros compreensíveis.** Mensagens de erro ao usuário dizem o que aconteceu e o que fazer, em português, em uma frase. Sem códigos, stack traces ou jargão.
- **Ações seguras.** Ações que alteram dados do terapeuta (marcar ausência, bloquear horário) exigem confirmação explícita e devolvem um texto confirmando o resultado.
- **Mudanças viram aviso.** Todo evento que muda a agenda do terapeuta gera notificação pelo `NotificationChannel`; ele nunca precisa procurar a mudança.
- **Alexa.** Respostas curtas (uma ou duas frases), sem listas longas, sempre com uma saída clara ("Para ouvir de novo, diga repetir").
- **Testado.** Textos para leitura e fala têm testes que verificam formato, tamanho e ordem da informação.
Se uma funcionalidade não puder ser tornada acessível, pare e pergunte antes de implementá-la.
 
## Definição de pronto
 
- [ ] Critérios de aceite cobertos por testes passando
- [ ] **Acessível ao massoterapeuta com deficiência visual**: tudo o que ele usa (endpoint, mensagem, aviso, resposta da Alexa) segue a seção "Acessibilidade" e tem teste cobrindo
- [ ] `npm run test`, `npm run test:e2e`, `npm run lint` e `npm run build` passando
- [ ] Nenhum comentário no código
- [ ] Estrutura e nomes seguindo as convenções do NestJS e o glossário
- [ ] Nenhuma dependência circular entre módulos
- [ ] Regras de privacidade respeitadas
- [ ] Nenhum `[PREENCHER]` resolvido por suposição
- [ ] `docs/requisitos.md` atualizado se algo mudou

## Agent skills

### Issue tracker

Markdown local: specs em `docs/specs/EP-NN-<nome>.md`, um arquivo por ticket em `docs/tickets/EP-NN/TK-NN.MM-<slug>.md` (D-11). Ver `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` e `docs/adr/` dentro de `backend/`. Ver `docs/agents/domain.md`.