# EP-01 — Modelo de dados e máquina de estados

Status: ✅ (concluído em 2026-10-19; TK-01.01 a TK-01.07 mergeados na `main`)
Marco: M1 — Domínio
Épico: EP-01 · Roadmap: `docs/roadmap.md`
Triage: `ready-for-agent`
Tickets: TK-01.01 a TK-01.07
Requisitos: RN-12, RN-16, RF-17, RF-27, "Máquina de estados da sessão", decisões de 2026-10-19 (papéis, reserva nasce confirmada, início sem check-in)

Criada em 2026-10-19. Fonte de verdade: `docs/requisitos.md`. Onde esta spec e o `requisitos.md` divergirem, vale o `requisitos.md`.

## Problem Statement

O backend nasceu antes das decisões de 2026-10-16 e 2026-10-19 e hoje fala outra língua que não a do domínio:

- O colaborador é `COLLABORATOR`, e o `ADMIN` faz o papel do RH. Não existe o papel `HR`, então não há como separar quem cuida do benefício (RH) de quem dá suporte à aplicação.
- A sessão tem só seis estados (`RESERVED`, `CANCELLED`, `CHECKED_IN`, `IN_PROGRESS`, `COMPLETED`, `NO_SHOW`). Faltam `CONFIRMED`, `POSSIBLE_NO_SHOW` e `RELEASED`, que sustentam a tolerância de atraso, a confirmação futura por e-mail e a oferta da vaga à lista de espera.
- As transições de estado estão espalhadas pelos services, cada uma com sua própria lista de estados válidos (o massoterapeuta pode iniciar a partir de `RESERVED` ou `CHECKED_IN`; o check-in só aceita `RESERVED`). Ninguém consegue responder "quais transições existem e quem pode dispará-las" sem ler o código inteiro.
- As restrições de sobreposição no banco (RN-12) só consideram `RESERVED`, `CHECKED_IN` e `IN_PROGRESS`, e a sala do atendimento é opcional, o que deixa brecha para duas sessões na mesma sala.
- Os nomes do schema (`AvailabilityWindow`, `collaboratorId`, tabelas em PascalCase) não seguem o glossário do `CLAUDE.md`.
- Não há onde guardar o pareamento da Alexa (RF-17): o código usa um mapa fixo em variável de ambiente.
- Os parâmetros das regras de negócio só existem no ambiente. Mudar a duração da sessão ou a tolerância exige novo deploy, contrariando a decisão de 2026-10-19 (RF-27).
- O seed de demonstração cria um único massoterapeuta, uma sala e nenhum RH, e não roda por nenhum script do `package.json`.

Para o massoterapeuta com deficiência visual, isso significa que os épicos seguintes (tolerância, aviso de possível ausência, agenda falada, Alexa pareada) não têm onde se apoiar. Para o time, significa que cada épico seguinte teria de reinventar o modelo.

## Solution

Ao fim do EP-01, o banco e o domínio falam a língua do `requisitos.md` e do glossário:

- Quatro papéis: `EMPLOYEE`, `THERAPIST`, `HR` e `ADMIN` (suporte, com acesso a tudo o que o RH faz).
- Nomes do glossário no schema e no Prisma Client (`employeeId`, `ScheduleSlot`), com tabelas e colunas em `snake_case` no banco.
- Os nove estados de `AppointmentStatus` e uma **tabela de transições pura**, num único módulo, que diz para cada par (de, para) quem pode disparar a transição: colaborador, massoterapeuta, RH (e, por herança, suporte) ou o sistema. Transição fora da tabela lança `InvalidStatusTransitionException`.
- Restrições de sobreposição (RN-12) por massoterapeuta e por sala, com a sala obrigatória, considerando ocupado todo horário cuja sessão não foi cancelada nem liberada.
- Tabelas para `AlexaDevice` e para o código de pareamento, prontas para o RH gerar códigos (TK-03.08) e o massoterapeuta dizer "vincular código {código}" (TK-07.05).
- Parâmetros das regras de negócio guardados no banco. O ambiente só fornece os valores iniciais. O `BusinessRulesService` continua sendo a única porta de leitura, com a mesma interface de hoje.
- Seed de demonstração idempotente com duas unidades, salas, dois ou mais massoterapeutas, colaboradores, RH, suporte e agendas diárias das próximas semanas.

Nenhuma rota nova é criada neste épico. O comportamento visível da API existente continua o mesmo, exceto pelos nomes de estado e de papel que ela devolve.

## User Stories

### Papéis

1. Como RH, quero ter um papel próprio (`HR`), para que meu acesso seja o de quem cuida do benefício, e não o de quem dá suporte técnico.
2. Como pessoa do suporte, quero que o papel `ADMIN` continue tendo acesso a tudo o que o RH faz, para diagnosticar e corrigir problemas sem pedir permissões extras.
3. Como colaborador, quero continuar acessando meus agendamentos depois da troca de `COLLABORATOR` para `EMPLOYEE`, para não perder nada na migração.
4. Como RH, quero acessar as telas e rotas que hoje exigem `ADMIN`, para não depender do suporte enquanto a herança formal de papéis (EP-02) não chega.
5. Como pessoa do suporte, quero que o usuário criado pelo script de bootstrap continue sendo `ADMIN`, para manter o acesso de emergência à aplicação.
6. Como desenvolvedor, quero que o banco recuse um papel fora dos quatro definidos, para não existir usuário com papel inválido.

### Glossário no schema

7. Como desenvolvedor, quero que o Prisma Client use `employeeId` em vez de `collaboratorId`, para escrever o código com o vocabulário do glossário.
8. Como desenvolvedor, quero que a agenda diária se chame `ScheduleSlot`, para que o nome no código seja o mesmo dos docs e dos tickets.
9. Como desenvolvedor, quero tabelas no plural e colunas em `snake_case` no banco, para seguir a convenção do `CLAUDE.md` e consultar o banco sem aspas.
10. Como desenvolvedor, quero que a renomeação preserve os dados locais existentes, para não precisar recriar o banco de desenvolvimento.
11. Como desenvolvedor, quero que o código legado continue compilando e passando nos testes depois das renomeações, para que o refactor aconteça aos poucos, como decidido em 2026-10-16.

### Estados da sessão

12. Como colaborador, quero que minha reserva apareça como confirmada, para saber que o horário é meu (no protótipo, a reserva nasce confirmada).
13. Como colaborador, quero que as reservas que fiz antes da migração continuem válidas, como confirmadas, para não perder meu horário.
14. Como massoterapeuta, quero que exista o estado "possível ausência", para que o sistema possa me avisar quando alguém passou da tolerância sem fazer check-in (RN-02, EP-05).
15. Como massoterapeuta, quero poder iniciar a sessão mesmo sem o check-in do colaborador, para não ficar travado quando a pessoa chegou mas não leu o QR Code.
16. Como massoterapeuta, quero poder iniciar a sessão de alguém marcado como possível ausência, para atender quem chegou atrasado.
17. Como massoterapeuta, quero confirmar a ausência de quem não veio, para liberar minha cabeça e registrar a falta (RF-33).
18. Como massoterapeuta, quero finalizar a sessão em andamento, para registrar o fim do atendimento (RF-14).
19. Como massoterapeuta, quero que uma sessão que esqueci de finalizar seja concluída sozinha no horário de término, para que ela não atrapalhe o "próximo atendimento" (RN-16).
20. Como massoterapeuta, quero cancelar um atendimento da minha agenda, para lidar com imprevistos (RF-12, RF-32).
21. Como colaborador, quero cancelar minha reserva, para liberar o horário a outra pessoa (RF-03).
22. Como RH, quero cancelar um atendimento, para resolver exceções que chegam até mim.
23. Como colaborador, quero fazer check-in só em uma reserva confirmada, para que o massoterapeuta saiba que cheguei (RF-06).
24. Como sistema, quero liberar uma reserva que não foi confirmada no prazo, para oferecer a vaga à lista de espera quando a confirmação por e-mail existir (RN-03, RN-10).
25. Como sistema, quero marcar como possível ausência a sessão confirmada sem check-in depois da tolerância, para avisar o massoterapeuta (RN-02).
26. Como colaborador, quero confirmar uma reserva ainda não confirmada, para quando o lembrete por e-mail existir (RF-05, fora do protótipo).
27. Como massoterapeuta, quero que uma sessão concluída, cancelada, liberada ou com ausência confirmada não mude mais de estado, para confiar no histórico da minha agenda.
28. Como massoterapeuta, quero receber uma mensagem curta e compreensível quando uma ação não puder ser feita naquele atendimento, para saber o que aconteceu sem depender de ninguém.
29. Como colaborador, quero que o sistema recuse ações que eu não posso fazer (por exemplo, iniciar minha própria sessão), para que só quem deve agir sobre o atendimento consiga agir.
30. Como desenvolvedor, quero uma única tabela de transições, pura e testada, para que todos os services perguntem a ela em vez de manter listas próprias de estados válidos.
31. Como desenvolvedor, quero saber, para cada transição, quem pode dispará-la (colaborador, massoterapeuta, RH, sistema), para que os services e os jobs dos próximos épicos apliquem a mesma regra.
32. Como desenvolvedor, quero que o `ADMIN` seja tratado como `HR` pela tabela de transições, para não duplicar regras.
33. Como RH, quero que toda transição possa ser auditada com o estado anterior, o novo e quem disparou, para consultar a auditoria depois (RF-22; a gravação fica no EP-04).

### Sobreposição (RN-12)

34. Como colaborador, quero que duas pessoas nunca fiquem com o mesmo horário do mesmo massoterapeuta, mesmo reservando ao mesmo tempo.
35. Como massoterapeuta, quero que nenhuma sessão da minha sala se sobreponha a outra, para não ter dois atendimentos marcados no mesmo espaço.
36. Como colaborador, quero que um horário cancelado ou liberado volte a ficar disponível, para eu poder reservá-lo.
37. Como RH, quero que sessões concluídas e ausências continuem ocupando o horário no histórico, para que os KPIs de ocupação e ausência (RF-21) façam sentido.
38. Como desenvolvedor, quero que a lista de estados que ocupam o horário seja a mesma no banco e no código, para que a consulta de horários disponíveis e a restrição do banco nunca discordem.
39. Como desenvolvedor, quero que todo atendimento tenha sala, para que a restrição por sala valha sempre.

### Alexa pareada (RF-17)

40. Como massoterapeuta, quero que minha Alexa fique ligada a mim depois do pareamento, para que tudo o que eu perguntar valha para a minha agenda.
41. Como massoterapeuta, quero poder ter mais de uma Alexa pareada (por exemplo, uma em cada sala em que trabalho), para usar a que estiver perto.
42. Como RH, quero que um aparelho fique pareado a um único massoterapeuta por vez, para que ninguém ouça a agenda de outra pessoa.
43. Como RH, quero que o código de pareamento tenha validade e só possa ser usado uma vez, para que um código anotado num papel não sirva depois.
44. Como RH, quero saber quem gerou cada código de pareamento, para auditar o processo.
45. Como desenvolvedor, quero que o uso único do código possa ser garantido no banco, para que dois aparelhos não consumam o mesmo código ao mesmo tempo.

### Parâmetros de negócio no banco (RF-27)

46. Como RH, quero que os parâmetros das regras fiquem guardados no banco, para que eu possa mudá-los sem novo deploy (a edição em si é o TK-03.07).
47. Como RH, quero que um valor que eu alterei não volte ao valor do ambiente quando a aplicação reiniciar, para que minha mudança valha de verdade.
48. Como pessoa do suporte, quero que, num banco novo, os parâmetros sejam preenchidos com os valores do ambiente, para subir a aplicação sem passo manual.
49. Como pessoa do suporte, quero que a aplicação recuse subir se os parâmetros guardados forem inconsistentes, para não funcionar com um horário de funcionamento impossível.
50. Como desenvolvedor, quero continuar lendo os parâmetros por `BusinessRulesService.current()`, sem `await`, para não precisar mudar quem já os usa.
51. Como desenvolvedor, quero testar o `BusinessRulesService` com um repositório dublê, para não depender de banco nos testes unitários.

### Seed de demonstração

52. Como pessoa do time, quero um seed com duas unidades (São Paulo e Londrina) e salas em cada uma, para demonstrar o filtro por unidade.
53. Como pessoa do time, quero dois ou mais massoterapeutas com agendas diárias nas próximas semanas, para demonstrar a escolha de massoterapeuta e a agenda de cada um.
54. Como pessoa do time, quero colaboradores, um RH e um suporte com IDs fixos, para trocar de usuário pelo cabeçalho `x-user-id` na demonstração.
55. Como pessoa do time, quero rodar o seed várias vezes sem duplicar dados, para recomeçar a demo quando quiser.
56. Como pessoa do time, quero que as agendas do seed respeitem o horário de funcionamento vigente (RN-08), para que os horários gerados sejam reserváveis.
57. Como pessoa do time, quero que "hoje" no seed seja o dia em `America/Sao_Paulo`, para que a agenda não pule um dia quando o seed roda perto da meia-noite.
58. Como pessoa do time, quero um script no `package.json` para rodar o seed de demonstração, para não precisar lembrar o comando.

## Implementation Decisions

### Ordem e escopo dos tickets

A ordem segue a coluna "Depende de" do roadmap: TK-01.01 → TK-01.02 → TK-01.03 → TK-01.04. TK-01.06 depende só de TK-01.01 e TK-01.05 depende de TK-01.02 (decisão de 2026-10-19, para que a migração do pareamento já nasça com os nomes finais das tabelas); os dois podem correr em paralelo ao restante. TK-01.07 fecha o épico.

Regra do refactor (2026-10-16): cada ticket leva para o glossário só o que precisa tocar. Cada ticket ajusta o código legado o mínimo para compilar e manter o comportamento. A reorganização em feature modules (`appointments/`, `schedules/` etc.) fica nos épicos donos (EP-03 a EP-06). A exceção é o módulo de estados do TK-01.04, que já nasce no lugar-alvo.

### Migrações

- Cada ticket com mudança de schema traz a sua migração, escrita à mão (`prisma migrate dev --create-only` e ajuste do SQL). O Prisma gera *drop and recreate* para mudança de enum e de nome, o que apagaria os dados locais. Renomes usam `ALTER TYPE ... RENAME VALUE`, `ALTER TABLE ... RENAME` e `RENAME COLUMN`.
- Valores novos de enum (`ALTER TYPE ... ADD VALUE`) ficam numa migração separada da que passa a usá-los. O PostgreSQL não deixa usar o valor novo na mesma transação em que ele foi criado.
- O banco não está em produção. Mesmo assim, toda migração precisa aplicar sobre um banco local populado pelo seed atual, sem perda de dados. Se a migração encontrar dado que não consegue converter (por exemplo, atendimento sem sala e sem período da agenda correspondente), ela falha com mensagem clara. Nesse caso o caminho é `prisma migrate reset`, nunca apagar em silêncio.
- As migrações existentes não são editadas.

### TK-01.01 — Papéis

- `UserRole` passa a ser `EMPLOYEE`, `THERAPIST`, `HR`, `ADMIN`. `COLLABORATOR` é renomeado para `EMPLOYEE`, o que preserva os usuários existentes. `HR` é um valor novo.
- Usuários `ADMIN` existentes continuam `ADMIN`. O script de bootstrap continua criando `ADMIN`: ele é o acesso de suporte, e o `ADMIN` herda tudo do `HR`.
- Herança mínima até o TK-02.01: todo ponto do código legado que hoje exige `ADMIN` no papel de RH passa a aceitar `HR` e `ADMIN`. Isso vale para o controller de cadastros e indicadores e para o cancelamento "privilegiado". O `RolesGuard` com herança formal fica no TK-02.01.
- O colaborador passa a ser `EMPLOYEE` nas rotas legadas.

### TK-01.02 — Renomes do glossário e `snake_case`

- Modelo `AvailabilityWindow` → `ScheduleSlot`. As relações `windows` em `Therapist` e `Room` passam a `scheduleSlots`.
- Campos `collaboratorId`/`collaborator` → `employeeId`/`employee` em `Appointment` e `WaitlistEntry`. A relação nomeada `CollaboratorAppointments` vira `EmployeeAppointments`.
- Todas as tabelas no plural e em `snake_case` via `@@map`: `users`, `locations`, `rooms`, `therapists`, `schedule_slots`, `schedule_blocks`, `appointments`, `waitlist_entries`, `notifications`, `audit_events`.
- Todas as colunas em `snake_case` via `@map` (`employee_id`, `starts_at`, `checked_in_at`, `session_started_at`...). Os tipos enum do PostgreSQL também em `snake_case` (`user_role`, `appointment_status`...). Os valores dos enums continuam em `UPPER_SNAKE_CASE`.
- Índices, chaves estrangeiras e restrições ganham nomes coerentes com as tabelas novas. A restrição de período válido (`ends_at > starts_at`) continua em todas as tabelas que já a têm.
- Os nomes dos campos no Prisma Client continuam em `camelCase`. Só o banco muda de convenção.

### TK-01.03 — `AppointmentStatus` e sobreposição

- `AppointmentStatus` passa a ter os nove estados do `requisitos.md`: `BOOKED`, `CONFIRMED`, `CHECKED_IN`, `POSSIBLE_NO_SHOW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `RELEASED`, `NO_SHOW`.
- Migração dos dados: `RESERVED` é renomeado para `CONFIRMED`, porque no protótipo a reserva nasce confirmada e o `RESERVED` legado significava exatamente isso. `BOOKED`, `POSSIBLE_NO_SHOW` e `RELEASED` são valores novos.
- A coluna de status deixa de ter valor padrão no banco. O estado inicial é uma decisão de negócio de quem cria o atendimento: hoje `CONFIRMED` (decisão de 2026-10-19, TK-04.02); `BOOKED` quando a confirmação por e-mail existir. O código legado de reserva passa a gravar `CONFIRMED` explicitamente.
- **Estados que ocupam o horário:** todos, exceto `CANCELLED` e `RELEASED`. `COMPLETED` e `NO_SHOW` continuam ocupando: o horário foi usado (ou reservado e perdido), e isso alimenta os KPIs. A lista é exposta pelo módulo de estados e é a mesma usada pelas restrições do banco. O TK-01.03 cria esse módulo puro já no lugar-alvo, só com a lista de estados que ocupam o horário e a de estados finais; o TK-01.04 acrescenta a tabela de transições (decisão de 2026-10-19, para evitar dependência circular).
- Restrições de exclusão (RN-12), recriadas com a nova lista:
  - por massoterapeuta: mesmo `therapist_id` com período sobreposto (`[)`), quando o status ocupa o horário;
  - por sala: mesmo `room_id` com período sobreposto, quando o status ocupa o horário.
- `Appointment.roomId` passa a ser obrigatório. Toda reserva já informa a sala, e sem isso a restrição por sala não vale para todos os atendimentos. A migração preenche a sala dos atendimentos legados sem sala a partir do `ScheduleSlot` do mesmo massoterapeuta que contém o período. Se algum ficar sem sala, a migração falha (ver "Migrações").
- Código legado: as listas próprias de "estados ativos" dos services de reserva e do massoterapeuta passam a usar a lista de estados que ocupam o horário. Os pontos que testavam `RESERVED` passam a testar `CONFIRMED`. O comportamento não muda além disso: a regra de quem pode fazer o quê passa a ser do TK-01.04.
- Nenhuma coluna nova de data por transição (como `confirmedAt` ou `noShowAt`). As que existem continuam (`checkedInAt`, `sessionStartedAt`, `sessionEndedAt`, `cancelledAt`, `cancelledById`). O histórico completo das transições fica na auditoria (TK-04.08).

### TK-01.04 — Tabela de transições

Módulo puro de estados de `Appointment`, no lugar-alvo do módulo `appointments`, sem dependência de Nest, Prisma ou relógio. Ele expõe:

- a pergunta "esta transição é permitida para este ator?", que devolve sim ou não;
- a afirmação que lança `InvalidStatusTransitionException` quando a resposta é não;
- a lista de estados que ocupam o horário (criada no TK-01.03);
- a lista de estados finais (criada no TK-01.03).

**Quem dispara** é um ator de transição: `EMPLOYEE`, `THERAPIST`, `HR`, `ADMIN` ou `SYSTEM`. `SYSTEM` representa os jobs agendados e não é um papel de usuário: não existe no enum `UserRole` nem no banco. `ADMIN` é tratado como `HR`.

A tabela abaixo é o contrato do TK-01.04. Ela reproduz a tabela "Máquina de estados da sessão" do `requisitos.md`, acrescentando quem dispara cada transição, derivado dos RF e RN citados:

| De | Para | Quem dispara | Origem |
| --- | --- | --- | --- |
| `BOOKED` | `CONFIRMED` | `EMPLOYEE` | RN-03, RF-05 (fora do protótipo) |
| `BOOKED` | `CANCELLED` | `EMPLOYEE`, `THERAPIST`, `HR` | RF-03, RF-12, RF-32 |
| `BOOKED` | `RELEASED` | `SYSTEM` | RN-03 |
| `CONFIRMED` | `CHECKED_IN` | `EMPLOYEE` | RF-06 |
| `CONFIRMED` | `IN_PROGRESS` | `THERAPIST` | RF-14, início sem check-in (2026-10-19) |
| `CONFIRMED` | `POSSIBLE_NO_SHOW` | `SYSTEM` | RN-02 |
| `CONFIRMED` | `CANCELLED` | `EMPLOYEE`, `THERAPIST`, `HR` | RF-03, RF-12, RF-32 |
| `CHECKED_IN` | `IN_PROGRESS` | `THERAPIST` | RF-14 |
| `POSSIBLE_NO_SHOW` | `IN_PROGRESS` | `THERAPIST` | RF-14 |
| `POSSIBLE_NO_SHOW` | `NO_SHOW` | `THERAPIST` | RF-33 |
| `IN_PROGRESS` | `COMPLETED` | `THERAPIST`, `SYSTEM` | RF-14, RN-16 |

- Estados finais: `COMPLETED`, `CANCELLED`, `RELEASED`, `NO_SHOW`. Nenhuma transição sai deles.
- Transição de um estado para ele mesmo não é transição: é inválida.
- **Fora da tabela de propósito:**
  - `CHECKED_IN` → `COMPLETED` pelo sistema (sessão com check-in que nunca foi iniciada): adicionada no TK-05.05 após a decisão D-06 registrada em `docs/requisitos.md`;
  - cancelamento a partir de `CHECKED_IN`, `POSSIBLE_NO_SHOW` ou `IN_PROGRESS`: o `requisitos.md` não prevê. Se for preciso, primeiro entra no `requisitos.md`.
- O módulo **não** verifica posse ("é o meu atendimento?", RN-13), prazos (RN-01, RN-02, RN-09) nem horário. Essas regras ficam nos services donos (EP-04, EP-05, EP-06), que consultam a tabela depois de validá-las.
- `InvalidStatusTransitionException` estende `ConflictException` (HTTP 409). A mensagem ao usuário vem do catálogo de mensagens, em português, numa frase que diz o que aconteceu e o que fazer. Proposta, a validar com os massoterapeutas no TK-14.03: "Esta ação não está disponível para este atendimento agora. Consulte a agenda para ver a situação dele." O estado de origem, o de destino e o ator vão só para o log, junto com o ID do atendimento, sem nome de pessoa (RNF-04).
- Código legado: os pontos que já mudam o status consultam a tabela antes de gravar. São eles: cancelar (colaborador ou RH), check-in, iniciar sessão e finalizar sessão. A atualização condicional no banco (só atualiza se o status ainda for o de origem) continua: ela é a proteção contra concorrência, e a tabela não a substitui. Com isso, o massoterapeuta passa a poder iniciar a partir de `POSSIBLE_NO_SHOW`, como manda o `requisitos.md`.
- A auditoria de cada transição ("Toda transição gera um evento de auditoria") não é feita pelo módulo puro. Ela fica com os services e o listener de auditoria (TK-04.08). O módulo só garante que a transição é válida.

### TK-01.05 — `AlexaDevice` e código de pareamento

- Tabela `alexa_devices`: ID, `device_id` da Amazon (único), massoterapeuta (FK) e data do pareamento. Um aparelho pertence a um único massoterapeuta. Um massoterapeuta pode ter vários aparelhos. Parear de novo um aparelho já pareado troca o dono (a regra fica no TK-07.05; o schema só não impede).
- Tabela `alexa_pairing_codes`: ID, código, massoterapeuta (FK), quem gerou (FK para `users`, RH ou suporte), validade (`expires_at`), uso (`consumed_at`, nulo até ser usado) e aparelho que o usou (FK para `alexa_devices`, nulo até ser usado).
- Uso único garantido no banco: índice único parcial no código entre os códigos ainda não usados. O consumo (TK-07.05) é uma atualização condicional (não usado e dentro da validade), para que dois aparelhos não usem o mesmo código ao mesmo tempo.
- Formato do código (por exemplo, só dígitos, para o slot numérico da Alexa), tempo de validade e regra de "um código ativo por massoterapeuta" são do TK-03.08. Este ticket só modela.
- Não guardar nada além do `device_id` sobre o aparelho, nem dados da conta Amazon.

### TK-01.06 — Parâmetros de negócio no banco

- Tabela `business_rules` com uma única linha (garantida por restrição) e uma coluna tipada por parâmetro do `BusinessRules`, mais a data da última alteração. Os dias de trabalho ficam num array de inteiros. Os horários do dia ficam em minutos desde a meia-noite, como no tipo atual. Colunas tipadas, em vez de chave-valor ou JSON, deixam o banco validar tipos. Parâmetro novo exige migração, de forma explícita.
- O `BusinessRulesService` passa a depender de um repositório injetado por token (`BUSINESS_RULES_REPOSITORY`, interface `BusinessRulesRepository`), com implementação Prisma. A interface do repositório é pequena: ler a linha vigente e gravar os valores iniciais se a linha ainda não existir (sem sobrescrever, seguro se duas instâncias subirem juntas).
- Na inicialização do módulo:
  1. lê a linha vigente;
  2. se não existe, grava os valores iniciais do ambiente (o `parseBusinessRules` atual continua validando o ambiente) e usa o que ficou gravado;
  3. valida a consistência do que veio do banco com a mesma função que valida o ambiente; se for inconsistente, a aplicação não sobe e a mensagem diz qual parâmetro corrigir;
  4. guarda em memória.
- `current()` continua síncrono e devolve o valor em memória. Quem chama não muda. O protótipo roda em uma instância só, por isso o cache em memória basta. A atualização do cache quando o RH editar é do TK-03.07.
- O banco vence o ambiente: com a linha já gravada, mudar a variável de ambiente não muda o valor vigente. O `.env.example` passa a dizer isso.
- A variável de ambiente continua obrigatória e validada na inicialização (TK-00.02), mesmo com a linha gravada. É ela que garante o valor inicial de um banco novo.
- Os testes que hoje constroem o `BusinessRulesService` direto com um objeto de regras passam a usar um dublê com `current()` ou um helper de teste. O helper fica junto do módulo, para não espalhar regras de teste.

### TK-01.07 — Seed de demonstração

- Idempotente: IDs fixos e `upsert`. Rodar duas vezes não duplica nada e restaura nomes, papéis e status.
- Conteúdo: as duas unidades que a migração já cria; ao menos duas salas por unidade; dois ou mais massoterapeutas (ao menos um por unidade); três ou mais colaboradores; um RH; um suporte (`ADMIN`); agendas diárias (`ScheduleSlot`) para cada massoterapeuta nos próximos dias úteis, dentro da janela de agendamento (RN-07).
- Os horários das agendas vêm dos parâmetros vigentes (RN-08: dias de trabalho, início, almoço e fim), lidos da tabela de parâmetros ou, num banco novo, do ambiente pelo mesmo parser. Nada fixo no script.
- "Hoje" é calculado em `America/Sao_Paulo`. Os horários são gravados em UTC (RNF-05). O seed de demo atual calcula a data em UTC, o que pula um dia perto da meia-noite.
- Antes de recriar as agendas futuras, o seed remove só as agendas futuras sem atendimento marcado. Não apaga atendimentos.
- Nenhum `AlexaDevice` no seed: o `device_id` é de um aparelho real e vem do pareamento. Os dados de roteiro da demo são do TK-13.05.
- Ao final, o seed imprime os IDs e o papel de cada usuário de demonstração, para uso no `x-user-id`. Só nomes de demonstração e IDs: nenhum dado real.
- Ganha script próprio no `package.json`, separado do bootstrap do suporte.
- Os nomes de demonstração usam primeiro nome e sobrenome distintos entre si, para que as falas com "só o primeiro nome" fiquem distinguíveis na demo.

### Contrato da API

Nenhuma rota é criada, removida ou renomeada no EP-01. Mudam só os valores que as rotas legadas já devolvem:

- `status` dos atendimentos: `RESERVED` deixa de existir e aparece `CONFIRMED`; podem aparecer `POSSIBLE_NO_SHOW`, `RELEASED` e `BOOKED`;
- `role` do usuário: `COLLABORATOR` deixa de existir e aparecem `EMPLOYEE` e `HR`;
- campos `collaboratorId`/`collaborator` nas respostas legadas passam a `employeeId`/`employee`.

Ainda não há frontend consumindo a API, por isso essa mudança não é tratada como incompatível.

### Acessibilidade

O EP-01 não cria texto falado nem tela. O que ele toca e chega ao massoterapeuta:

- a mensagem de `InvalidStatusTransitionException` segue a seção "Acessibilidade" do `CLAUDE.md`: uma frase, em português, dizendo o que aconteceu e o que fazer, sem código de estado nem jargão; tem teste de formato;
- o seed gera agendas em ordem cronológica e no fuso `America/Sao_Paulo`, para que as consultas dos épicos seguintes já devolvam listas que façam sentido lidas em voz alta.

## Testing Decisions

### O que é um bom teste aqui

- Testa comportamento observável pela interface do módulo, não detalhes internos. Para o módulo de estados: dado (de, para, ator), é permitido ou não, e qual exceção sai. Não testa como a tabela é guardada.
- Nome do teste cita o ID: `it('RN-16: allows the system to complete an in-progress appointment')`, `it('Máquina de estados: rejects leaving a final status')`.
- Sem `new Date()` nem banco nos testes unitários: `FakeClock` e dublês, como já fazem os testes de `PolicyService` e `FakeClock`.
- Testes não dependem de ordem nem de estado compartilhado.

### Seams (confirmados em 2026-10-19)

1. **Módulo puro de estados (TK-01.04), o seam principal.** Testes unitários sem `Test.createTestingModule`, porque o módulo não tem dependências. Cobertura exaustiva por tabela de transições autorizadas; todo o resto é recusado com `InvalidStatusTransitionException`. Mais testes nomeados para os casos de negócio: início sem check-in, conclusão automática (RN-16), `ADMIN` tratado como `HR`, saída de estado final, `CHECKED_IN` → `COMPLETED` autorizado para `SYSTEM` após D-06 (TK-05.05), lista de estados que ocupam o horário, e mensagem da exceção vinda do catálogo, em uma frase.
2. **`BusinessRulesService` (TK-01.06), seam que já existe.** Testes com `Test.createTestingModule` e um `BusinessRulesRepository` em memória:
   - banco vazio grava os valores do ambiente e `current()` os devolve;
   - banco com valores diferentes do ambiente faz `current()` devolver os do banco;
   - valores inconsistentes no banco fazem a inicialização falhar com mensagem clara;
   - `current()` não toca o repositório depois da inicialização.
3. **O próprio banco (TK-01.01, 01.02, 01.03, 01.05, 01.06, 01.07).** Migrações, restrições e seed são verificados contra PostgreSQL 17 real. O TK-00.06 está pronto: `npm run test:e2e` sobe o serviço `postgres-test`, recria o schema e aplica todas as migrações a cada execução, então toda migração nova já é verificada num banco vazio. Os passos de verificação:
   1. com o banco populado pelo seed atual, `prisma:deploy` aplica sem erro;
   2. os dados existentes foram convertidos (papéis, status, sala do atendimento, nomes);
   3. o seed novo roda duas vezes sem duplicar;
   4. a inserção de dois atendimentos sobrepostos para o mesmo massoterapeuta ou a mesma sala é recusada pelo banco;
   5. um atendimento `CANCELLED` ou `RELEASED` não bloqueia o horário;
   6. um código de pareamento não pode ser consumido duas vezes.

   Os passos 3 a 6 são testes automatizados em `test/` (`*.e2e-spec.ts`), usando `createTestApp()` e `truncateAllTables()` de `test/support/`. Os passos 1 e 2 continuam como roteiro manual no PR, contra o banco do `docker compose` populado pelo seed atual: o banco de teste nasce vazio e recebe todas as migrações de uma vez, então não guarda dados de antes da migração para converter. O teste de concorrência de reserva com banco real é do TK-04.02.

### Prior art

- `src/domain/policy.service.spec.ts`: `Test.createTestingModule` com `BusinessRulesService` e `CLOCK` substituídos, regras base em objeto tipado, nomes com ID de RN.
- `src/config/business-rules.config.spec.ts`: validação dos parâmetros e mensagens de erro, base para os testes de consistência do TK-01.06.
- `src/common/clock/fake-clock.spec.ts`: dublê de relógio.
- `src/booking/slots.spec.ts`: teste de função pura sem módulo Nest, modelo para o módulo de estados.
- `test/app.e2e-spec.ts`: aplicação inteira com Supertest contra o banco de teste, dados criados no próprio teste e tabelas esvaziadas no `beforeEach`. Modelo para os testes do seam 3.

### Regressão

`npm run test`, `npm run test:e2e`, `npm run lint` e `npm run build` passam ao fim de cada ticket. Os testes legados que citam `RESERVED`, `COLLABORATOR` ou `collaboratorId` são atualizados no ticket que faz a renomeação, sem mudar o que verificam.

## Critérios de aceite por ticket

### TK-01.01 — Papéis

- **Dado** um banco local com um usuário `COLLABORATOR`, **quando** a migração roda, **então** o usuário existe com papel `EMPLOYEE` e os mesmos atendimentos.
- **Dado** um usuário `ADMIN` criado pelo bootstrap, **quando** a migração roda, **então** ele continua `ADMIN`.
- **Dado** um usuário `HR` ativo, **quando** ele chama uma rota legada de cadastros ou indicadores, **então** o acesso é permitido.
- **Dado** um usuário `EMPLOYEE`, **quando** ele chama uma rota legada de cadastros, **então** recebe 403 com a mensagem do catálogo.
- **Dado** uma tentativa de gravar um papel fora dos quatro, **quando** a gravação chega ao banco, **então** ela é recusada.

### TK-01.02 — Renomes do glossário

- **Dado** um banco local populado pelo seed atual, **quando** a migração roda, **então** as tabelas e colunas estão em `snake_case` no plural e nenhum registro foi perdido.
- **Dado** o Prisma Client gerado, **quando** o código usa `scheduleSlot` e `employeeId`, **então** compila; `availabilityWindow` e `collaboratorId` não existem mais.
- **Dado** as rotas legadas de horários disponíveis e reserva, **quando** são chamadas como antes, **então** devolvem o mesmo resultado, com `employeeId` no lugar de `collaboratorId`.

### TK-01.03 — Status e sobreposição

- **Dado** um atendimento `RESERVED` no banco local, **quando** a migração roda, **então** ele fica `CONFIRMED`.
- **Dado** um atendimento legado sem sala, coberto por um período da agenda do mesmo massoterapeuta, **quando** a migração roda, **então** ele recebe a sala desse período.
- **Dado** um atendimento legado sem sala e sem período correspondente, **quando** a migração roda, **então** ela falha com mensagem que indica o problema.
- **Dado** um atendimento `CONFIRMED` das 14h às 14h20 com o massoterapeuta A, **quando** se grava outro, de qualquer estado que ocupa o horário, com A das 14h10 às 14h30, **então** o banco recusa (RN-12).
- **Dado** um atendimento `CONFIRMED` na sala S das 14h às 14h20, **quando** se grava outro na sala S, com outro massoterapeuta, das 14h às 14h20, **então** o banco recusa (RN-12).
- **Dado** um atendimento `CANCELLED` ou `RELEASED` das 14h às 14h20, **quando** se grava outro no mesmo horário, massoterapeuta e sala, **então** o banco aceita.
- **Dado** um atendimento das 14h às 14h20, **quando** se grava outro das 14h20 às 14h40 com o mesmo massoterapeuta e a mesma sala, **então** o banco aceita (intervalo `[)`).
- **Dado** uma reserva feita pela rota legada, **quando** ela é gravada, **então** nasce `CONFIRMED`.
- **Dado** uma tentativa de gravar um atendimento sem sala, **quando** chega ao banco, **então** é recusada.

### TK-01.04 — Tabela de transições

- **Dado** cada linha da tabela de transições, **quando** um ator listado pede a transição, **então** ela é permitida.
- **Dado** uma linha da tabela, **quando** um ator não listado pede a transição, **então** é lançada `InvalidStatusTransitionException`.
- **Dado** um atendimento `CONFIRMED`, **quando** o massoterapeuta pede `IN_PROGRESS`, **então** é permitido (início sem check-in).
- **Dado** um atendimento `IN_PROGRESS`, **quando** o sistema pede `COMPLETED`, **então** é permitido (RN-16).
- **Dado** um atendimento `CONFIRMED`, **quando** o `ADMIN` pede `CANCELLED`, **então** é permitido, como para o `HR`.
- **Dado** um atendimento em estado final (`COMPLETED`, `CANCELLED`, `RELEASED`, `NO_SHOW`), **quando** qualquer ator pede qualquer transição, **então** é lançada `InvalidStatusTransitionException`.
- **Dado** um atendimento `CHECKED_IN` sem início, **quando** o sistema pede `COMPLETED`, **então** é permitido conforme D-06 e TK-05.05.
- **Dado** um atendimento `CONFIRMED`, **quando** o colaborador pede `IN_PROGRESS`, **então** é recusado.
- **Dado** qualquer estado, **quando** a transição é para ele mesmo, **então** é recusada.
- **Dado** uma transição recusada, **quando** a exceção chega ao usuário, **então** a mensagem é a do catálogo, em português, em uma frase, sem nome de estado nem código.
- **Dado** um atendimento `POSSIBLE_NO_SHOW`, **quando** o massoterapeuta inicia a sessão pela rota legada, **então** ela passa a `IN_PROGRESS`.
- **Dado** um atendimento `CHECKED_IN`, **quando** o colaborador tenta cancelar pela rota legada, **então** recebe 409 com a mensagem do catálogo.

### TK-01.05 — Pareamento da Alexa

- **Dado** um `device_id` já pareado, **quando** se grava outro aparelho com o mesmo `device_id`, **então** o banco recusa.
- **Dado** um massoterapeuta com um aparelho pareado, **quando** se pareia um segundo aparelho a ele, **então** o banco aceita.
- **Dado** um código ainda não usado, **quando** se grava outro código não usado com o mesmo valor, **então** o banco recusa.
- **Dado** um código já usado, **quando** se grava um código novo com o mesmo valor, **então** o banco aceita.
- **Dado** um código não usado e dentro da validade, **quando** duas atualizações condicionais tentam consumi-lo ao mesmo tempo, **então** só uma afeta o registro.

### TK-01.06 — Parâmetros no banco

- **Dado** um banco sem linha de parâmetros, **quando** a aplicação inicia, **então** a linha é gravada com os valores do ambiente e `current()` os devolve.
- **Dado** um banco com `SESSION_DURATION_MINUTES` gravado como 30 e o ambiente com 20, **quando** a aplicação inicia, **então** `current().sessionDurationMinutes` é 30.
- **Dado** um banco com o início do almoço depois do fim do expediente, **quando** a aplicação inicia, **então** ela não sobe e a mensagem diz qual parâmetro corrigir.
- **Dado** duas instâncias iniciando ao mesmo tempo num banco vazio, **quando** ambas gravam os valores iniciais, **então** fica uma única linha e nenhuma falha.
- **Dado** a aplicação iniciada, **quando** `current()` é chamado várias vezes, **então** o repositório não é consultado de novo.

### TK-01.07 — Seed de demonstração

- **Dado** um banco migrado e vazio, **quando** o seed roda, **então** existem duas unidades, ao menos duas salas em cada uma, dois ou mais massoterapeutas, três ou mais colaboradores, um RH e um `ADMIN`.
- **Dado** o seed já executado, **quando** ele roda de novo, **então** a contagem de usuários, salas e períodos da agenda não muda.
- **Dado** os parâmetros vigentes de RN-08, **quando** o seed gera as agendas, **então** nenhum período cai fora do expediente, no almoço ou em dia não útil.
- **Dado** o seed rodando às 23h30 de São Paulo, **quando** gera as agendas, **então** o primeiro dia gerado é o dia seguinte em São Paulo.
- **Dado** um atendimento marcado num período futuro, **quando** o seed roda de novo, **então** o atendimento e o período dele continuam lá.
- **Dado** o seed concluído, **quando** a rota legada de horários disponíveis é chamada com o `x-user-id` de um colaborador de demonstração, **então** devolve horários dos dois ou mais massoterapeutas.

## Out of Scope

- Reorganização em feature modules (`appointments/`, `schedules/`, `waitlist/`, `attendance/`) e saída do `booking/`, do `therapist/` e do `admin/`: EP-03 a EP-06.
- `RolesGuard` com herança `ADMIN` ⊃ `HR`, `GET /me` e matriz de permissões por rota: EP-02.
- Regras de posse (RN-13), prazos (RN-01, RN-02, RN-09) e limite de reservas (RN-06) dentro das transições: services dos EP-04 a EP-06.
- Gravação dos eventos de auditoria de cada transição: TK-04.08.
- Jobs que disparam transições do sistema (tolerância, conclusão automática, liberação): EP-05 e o lembrete por e-mail, fora do MVP.
- Sessão `CHECKED_IN` nunca iniciada: D-06, implementada no TK-05.05.
- Geração do código de pareamento (formato, validade, um ativo por massoterapeuta): TK-03.08. Intent "vincular código": TK-07.05.
- Edição dos parâmetros pelo RH, com validação e auditoria: TK-03.07.
- Coluna de lembrete da Alexa no atendimento (`lembrete_alexa_id`): TK-07.10.
- Primeiro nome derivado e formatação falada: TK-06.01.
- Tabela de avisos ao massoterapeuta e `NotificationChannel`: TK-05.01.
- Dados e roteiro de demonstração além do seed: TK-13.05.
- Login Google, `InscricaoPush`, `Feedback`: fora do MVP.

## Further Notes

### Divergências encontradas (não resolvidas por esta spec)

- **`requisitos.md`, tabela "Atores e perfis":** resolvida. A coluna "Papel no código" já diz `EMPLOYEE` e `HR` (conferido em 2026-10-20).
- **`CONTEXT.md`, máquina de estados:** `concluida` aparece só como "Terapeuta finalizou a sessão", sem a conclusão automática (RN-16). Vale o `requisitos.md`.
- **`CLAUDE.md`, seção "Estado atual do código":** depois do EP-01, as linhas sobre papéis, estados, `AvailabilityWindow` e tabelas em PascalCase deixam de valer e devem ser atualizadas no PR do ticket que as resolve.

### Perguntas em aberto

| Pergunta | Afeta | Bloqueia |
| --- | --- | --- |
| Tempo de validade e formato do código de pareamento. É um parâmetro editável pelo RH (entra na tabela de parâmetros) ou uma constante técnica? [DECIDIR] Virou a D-18 do roadmap em 2026-10-20 (spec do EP-03). | TK-03.08, TK-07.05 | Nada no EP-01: o schema guarda a validade calculada |
| O RH pode cancelar a partir de `CHECKED_IN` ou `POSSIBLE_NO_SHOW` (por exemplo, para corrigir um erro)? O `requisitos.md` não prevê. [DECIDIR] | TK-01.04, RF-22 | Nada: fica fora da tabela até ser decidido |
| Texto final da mensagem de transição inválida. [VALIDAR com os massoterapeutas no TK-14.03] | TK-01.04 | Nada: entra a proposta |

### Riscos

- Migrações escritas à mão sobre enum e renomes são o ponto mais frágil do épico. A mitigação é o seam 3 (roteiro manual para a conversão dos dados existentes, testes automatizados para restrições e seed) e migrações pequenas, uma por ticket.
- Considerar `COMPLETED` e `NO_SHOW` como ocupando o horário muda a restrição legada. Se um banco local tiver uma sobreposição antiga desses estados, a criação da restrição falha. O caminho é `prisma migrate reset`.
