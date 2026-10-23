## Documento de Requisitos — [Nome do projeto]

Oct 2, 2026 · revisado em Oct 16, 2026

## Como usar este documento

Este documento é a fonte única de requisitos do projeto e a entrada principal para o Claude Code gerar o código. O que não estiver escrito aqui será suposto; por isso, preencham tudo.

## Convenções de preenchimento

- [PREENCHER] marca um campo obrigatório vazio. Nenhum deve sobrar antes do desenvolvimento.

- [VALIDAR] marca algo que depende de confirmação com usuários ou stakeholders.

- [DECIDIR] marca uma escolha do grupo que ainda não foi feita.

- Cada requisito tem um ID fixo (RF-01, RN-01, RNF-01). IDs apagados não são reaproveitados.

- **Os IDs deste documento são os oficiais.** Se o `CLAUDE.md` ou o `CONTEXT.md` citarem um ID com outro significado, vale o daqui.

- Prioridade segue MoSCoW: M (obrigatório), S (importante), C (desejável), W (fora desta versão).

- Critérios de aceite são escritos em Dado / Quando / Então; cada um vira um teste automatizado.

## Decisões registradas

| Data | Decisão |
| --- | --- |
| 2026-10-16 | O projeto é um **protótipo**. O objetivo é demonstrar o fluxo completo, não entrar em produção. |
| 2026-10-16 | Três perfis de usuário: **Colaborador**, **RH** e **Massoterapeuta**. |
| 2026-10-16 | **Login com Google sai do MVP** e vai para o roadmap (só se der tempo). No protótipo, a identificação é simplificada: o backend recebe o ID do usuário no cabeçalho `x-user-id` (`AUTH_MODE=header`). |
| 2026-10-16 | A **Alexa é canal de consulta e de ação** do massoterapeuta: ele faz requisições ao sistema por voz (cancelar, bloquear agenda, iniciar e finalizar sessão). Substitui a decisão anterior do `CONTEXT.md` ("Alexa não é canal de ação"). |
| 2026-10-16 | O massoterapeuta, que tem deficiência visual, é o **usuário principal**. Tudo o que ele usa precisa funcionar só por voz ou só com leitor de tela. |
| 2026-10-16 | **O RH faz os cadastros** (usuários, salas, grade, bloqueios, pareamento da Alexa) e acompanha os KPIs. Não há perfil de secretária no sistema. |
| 2026-10-16 | **Máquina de estados híbrida** (ver "Máquina de estados da sessão"): confirmação após o lembrete e liberação automática, como no `CONTEXT.md`, mais início e fim marcados pelo massoterapeuta (RF-14). |
| 2026-10-16 | **A Alexa é pareada ao massoterapeuta:** o RH gera um código e o massoterapeuta diz "vincular código {código}". O aparelho fica ligado a ele. |
| 2026-10-16 | **O código existente é refatorado aos poucos** até seguir o `CLAUDE.md` (módulos, `Clock`, glossário, máquina de estados). Schema Prisma e regras prontas são aproveitados. |
| 2026-10-19 | **Parâmetros das regras de negócio são editáveis** (RF-27): duração da sessão, janela de agendamento, horário de funcionamento, prazos. Ficam no banco, e o ambiente só fornece os valores iniciais. Mudar um valor não exige novo deploy. |
| 2026-10-19 | **Interface web do massoterapeuta entra no MVP**, junto com a Alexa. |
| 2026-10-19 | **Sem envio de lembrete no protótipo.** O colaborador vê um card de lembrete ao entrar na página (RF-09). O lembrete por e-mail vai para o roadmap. |
| 2026-10-19 | **Agenda por dia, sem recorrência.** Cada massoterapeuta tem a sua agenda, montada dia a dia pelo RH. A forma de facilitar essa montagem será estudada (RF-26). |
| 2026-10-19 | **Papéis:** `EMPLOYEE` (colaborador), `THERAPIST` (massoterapeuta), `HR` (RH) e `ADMIN`, este último só para quem presta suporte à aplicação. Substitui o uso de `ADMIN` como RH. |
| 2026-10-19 | **No protótipo, a reserva nasce confirmada.** A confirmação de presença volta com o lembrete por e-mail; quem não confirmar perde a vaga. |
| 2026-10-19 | **O massoterapeuta pode iniciar a sessão sem check-in** do colaborador. |
| 2026-10-19 | **Sessão em andamento que ninguém finalizou é concluída automaticamente** no horário de término (RN-16). |
| 2026-10-19 | **Tickets em markdown local** (D-11): specs em `docs/specs/EP-NN-<nome>.md` e um arquivo por ticket em `docs/tickets/EP-NN/TK-NN.MM-<slug>.md`, sem GitHub Issues. Convenções em `docs/agents/issue-tracker.md`. |
| 2026-10-20 | **Identificação no protótipo (D-12):** o frontend mostra uma tela "Entrar como…" com os usuários ativos, vinda de `GET /auth/demo-users`, que só existe com `AUTH_MODE=header`. O ID escolhido vai no `x-user-id`. Toda rota exige identificação e papel, exceto as marcadas como públicas (spec do EP-02). |
| 2026-10-20 | **Cópia da agenda diária (D-02 / RF-26):** O RH replica turnos de uma data modelo para uma lista de datas futuras (`POST /schedules/copy`). Cada dia gera registros concretos `ScheduleSlot` com validação de conflitos. |
| 2026-10-20 | **Bloqueio de horários com atendimentos concorrentes (D-04 / RF-23):** Bloqueios sobre horários com atendimentos confirmados são recusados com status 409 e listam os atendimentos conflitantes, exigindo cancelamento explícito prévio. |
| 2026-10-20 | **Reagendamento (D-03 / RF-08):** Fora do MVP. Para trocar de horário, o colaborador cancela a sessão atual e faz uma nova reserva. |
| 2026-10-20 | **Oferta da lista de espera (D-13 / RF-04):** O colaborador recebe uma notificação/card dentro do sistema. A oferta expira conforme `WAITLIST_ACCEPTANCE_MINUTES` e passa ao próximo da fila. |
| 2026-10-20 | **Sessão em `CHECKED_IN` sem início (D-06):** se o massoterapeuta não iniciar a sessão, o sistema a marca como `COMPLETED` no horário de término, seguindo a RN-16. |
| 2026-10-20 | **Mensagens de check-in:** a confirmação do check-in é destinada ao colaborador; o aviso de chegada é uma mensagem separada destinada ao massoterapeuta, com ações acessíveis para consultar a agenda ou fechar o aviso. |
| 2026-10-22 | **Código de pareamento da Alexa (D-18 / RF-17):** 6 dígitos numéricos (o slot da Alexa reconhece dígitos), válido por 60 minutos, constante técnica (não é parâmetro do RH). Gerar um código novo expira os códigos ainda não usados do mesmo massoterapeuta: um código ativo por vez. |
| 2026-10-22 | **Uma Alexa serve a vários massoterapeutas (RN-17):** a cardinalidade é n massoterapeutas : 1 Alexa. Refina a decisão de 2026-10-16 ("o aparelho fica ligado a ele"). Como a Alexa compartilhada sabe qual massoterapeuta está falando ainda está em aberto (D-19). |
| — | ORM: Prisma (ver "Arquitetura e stack"). |

## Responsáveis por seção

| Seção | Responsável | Prazo |
| --- | --- | --- |
| Visão geral | [PREENCHER] | [PREENCHER] |
| Atores e perfis | [PREENCHER] | [PREENCHER] |
| Escopo do MVP | [PREENCHER] | [PREENCHER] |
| Requisitos funcionais | [PREENCHER] | [PREENCHER] |
| Regras de negócio | [PREENCHER] | [PREENCHER] |
| Requisitos não funcionais | [PREENCHER] | [PREENCHER] |
| Integrações externas | [PREENCHER] | [PREENCHER] |
| Modelo de dados | [PREENCHER] | [PREENCHER] |
| Arquitetura e stack | [PREENCHER] | [PREENCHER] |
| Catálogo de mensagens | [PREENCHER] | [PREENCHER] |
| Questões em aberto | [PREENCHER] | [PREENCHER] |

## Visão geral

Problema (o que acontece hoje, com evidências)

O gerenciamento atual do benefício de massoterapia dentro da Semantix é operado manualmente por meio de planilhas gerenciadas pelas secretárias (Londrina e São Paulo). A forma como esse processo ocorre acaba gerando alguns gargalos:

1. Toda a informação da agenda fica concentrada nas secretárias de cada unidade.

2. O massoterapeuta não sabe quem é o próximo atendimento, nem quem é a pessoa; apenas espera. (entrevistas com os massoterapeutas)

3. Quando alguém atrasa ou cancela sem avisar, o massoterapeuta fica parado esperando. (entrevistas com os massoterapeutas)

4. O colaborador sofre com falta de visibilidade, dificuldade para agendar, fila de espera e falta de retorno. (dores mapeadas pela Semantix)

5. O RH não tem indicadores de uso do benefício. [VALIDAR]

## Causa raiz

Toda a informação da agenda está concentrada em uma pessoa e circula por canais visuais (planilhas). Não existe canal direto até o massoterapeuta. A ociosidade do massoterapeuta e a fila do colaborador são o mesmo problema visto dos dois lados.

## Objetivo da solução

Uma plataforma centralizada, que possua:

- agendamento self-service para o colaborador (consultar horários, reservar, cancelar, entrar na fila);

- agenda acessível ao massoterapeuta por voz (Alexa) e por leitor de tela, com consulta e ação;

- indicadores e auditoria para o RH.

## Princípios de design

- **Modelo social da deficiência:** a barreira está no processo, não na pessoa. O sistema corrige o fluxo de informação.

- **Paridade de informação:** o massoterapeuta sabe o mesmo que a secretária, no mesmo momento.

- **Massoterapeuta protagonista:** ele consulta e age sobre a própria agenda, sem intermediários.

- **Nada sobre nós sem nós:** decisões de interação são validadas com os massoterapeutas.

## Métricas de sucesso

| Métrica | Valor atual | Meta | Como medir |
| --- | --- | --- | --- |
| Massoterapeuta passa um dia inteiro de trabalho sem pedir informação a ninguém | [PREENCHER] | [PREENCHER] | Teste com os massoterapeutas [VALIDAR] |
| [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] |

## Atores e perfis

| Ator | Papel no código | Quem é | Canal de acesso | O que precisa |
| --- | --- | --- | --- | --- |
| Colaborador | `EMPLOYEE` | Funcionário corporativo elegível ao benefício | Sistema web | Consultar horários disponíveis, agendar, cancelar e ver os próprios agendamentos de forma simples. Entrar na lista de espera. Fazer check-in lendo o QR Code da sala. Ver um card de lembrete da próxima sessão ao entrar na página. |
| RH | `HR` | Responsável pelo benefício e pelas métricas | Sistema web | Dashboard com KPIs, relatórios, taxa de faltas, auditoria. Cadastros (usuários, salas, agenda diária dos massoterapeutas, bloqueios), parâmetros das regras de negócio e geração do código de pareamento da Alexa. |
| Suporte | `ADMIN` | Quem presta suporte à aplicação (equipe do projeto) | Sistema web | Acesso a todas as funções do RH, para diagnosticar e corrigir problemas. |
| Massoterapeuta | `THERAPIST` | Massoterapeuta com deficiência visual (usuário principal) | Alexa na sala + sistema web acessível com leitor de tela | Saber o próximo atendimento e a agenda do dia, saber quem chegou, ouvir um lembrete antes de cada sessão. Agir por voz: cancelar, bloquear horários, iniciar e finalizar sessão. |
| Sistema | — | Jobs agendados | — | Lembretes, prazos, tolerância de atraso, oferta de vaga à lista de espera |

## Perfil detalhado do usuário principal (massoterapeuta)

Preencher com base nas entrevistas. Estas respostas definem como a interface e a Alexa funcionam.

| Pergunta | Resposta |
| --- | --- |
| Cegueira total ou baixa visão? Varia entre os massoterapeutas? | [PREENCHER] |
| Usa leitor de tela? Qual (NVDA, JAWS, TalkBack, VoiceOver)? Em computador ou celular? | [PREENCHER] |
| Tem celular próprio e aceita usá-lo no trabalho? | [PREENCHER] |
| Já usa Alexa ou outro assistente de voz? | [PREENCHER] |
| Há uma Alexa por sala? A sala é fixa por massoterapeuta? | [PREENCHER] |
| Quantos massoterapeutas por unidade (São Paulo, Londrina)? | [PREENCHER] |
| Como ele sabe hoje quem é o próximo e quando a pessoa chegou? | [PREENCHER] |
| O que ele gostaria de fazer sozinho e hoje depende de alguém? | [PREENCHER] |

## Escopo do MVP

## Dentro do MVP

- Agendamento: consultar disponibilidade, reservar, cancelar, ver meus agendamentos

- Lista de espera

- Check-in por QR Code

- Card de lembrete na página do colaborador (sem envio de mensagem)

- Dashboard do RH com KPIs e relatórios

- Parâmetros das regras de negócio editáveis pelo RH

- Integração com Alexa (consulta e ação do massoterapeuta)

- Interface web acessível do massoterapeuta

## Fora do MVP (próximos passos)

- Login com Google (Google Workspace) — roadmap, só se der tempo

- Lembrete por e-mail ao colaborador

- Google Calendar (espelho da agenda do colaborador)

- Push da PWA (Web Push) e e-mail transacional

- Avaliação da sessão (feedback) [DECIDIR: entra no MVP?]

- Campainha virtual da Alexa (anúncio de chegada em tempo real)

- Bots de mensagem (Telegram, WhatsApp, Google Chat), SMS, aplicativo nativo

## Requisitos funcionais

Agrupem os requisitos por módulo. A coluna "Regras" liga cada requisito às regras de negócio que ele usa.

## Módulo 1 — Agendamento (Colaborador)

| ID | Requisito | Ator | Prioridade | Regras |
| --- | --- | --- | --- | --- |
| RF-01 | Consultar e listar horários e massoterapeutas disponíveis | Colaborador | M | RN-05, RN-07, RN-08, RN-12 |
| RF-02 | Reservar horário | Colaborador | M | RN-01, RN-05, RN-06, RN-07, RN-08, RN-12 |
| RF-03 | Cancelar agendamento | Colaborador | M | RN-01 |
| RF-04 | Entrar na lista de espera para horários preenchidos | Colaborador | [M/S/C/W] | RN-10 |
| RF-05 | Receber lembrete de agendamento por e-mail | Colaborador | W (roadmap) | RN-03, RN-11 |
| RF-06 | Validar presença através de leitura de QR Code | Colaborador | [M/S/C/W] | RN-02, RN-09 |
| RF-07 | Consultar meus agendamentos (próximos e anteriores) | Colaborador | M | — |
| RF-08 | Reagendar sessão | Colaborador | W (fora do MVP) | RN-01 |
| RF-09 | Ver um card de lembrete da próxima sessão ao entrar na página (data, hora, massoterapeuta, sala) | Colaborador | [M/S/C/W] | — |

## Módulo 2 — Alexa (Massoterapeuta)

| ID | Requisito | Ator | Prioridade | Regras |
| --- | --- | --- | --- | --- |
| RF-10 | Emitir resumo da agenda do dia | Massoterapeuta | M | RNF-02 |
| RF-11 | Consultar próximos atendimentos | Massoterapeuta | M | RNF-02 |
| RF-12 | Cancelar agendamentos | Massoterapeuta | [M/S/C/W] | RN-13 |
| RF-13 | Trancar agenda em determinado período | Massoterapeuta | [M/S/C/W] | RN-13 |
| RF-14 | Mapear início e fim da sessão | Massoterapeuta | [M/S/C/W] | RN-13 |
| RF-15 | Consultar quem chegou (check-ins do dia) | Massoterapeuta | [M/S/C/W] | RN-14 |
| RF-16 | Ouvir lembrete falado antes de cada sessão | Massoterapeuta | [M/S/C/W] | RN-15 |
| RF-17 | Vincular a Alexa ao massoterapeuta (o RH gera um código; o massoterapeuta diz "vincular código {código}") | Massoterapeuta, RH | M | RN-17 |

Regras para todos os comandos de voz:

- O massoterapeuta **nunca precisa dizer um identificador**. Os comandos se referem ao atendimento atual, ao próximo, ou a um horário falado ("cancelar o atendimento das 14h", "bloquear das 15h às 16h").

- Toda ação que altera dados **pede confirmação** antes ("Cancelar o atendimento de Ana às 14h. Confirma?") e **confirma o resultado** depois.

- Respostas curtas, com a informação principal nas primeiras palavras, só o primeiro nome do colaborador.

## Módulo 3 — Interface web do massoterapeuta

Mesmas consultas e ações da Alexa, numa tela que funciona só com leitor de tela. Entra no MVP (2026-10-19).

| ID | Requisito | Ator | Prioridade | Regras |
| --- | --- | --- | --- | --- |
| RF-30 | Ver o atendimento atual, o próximo e a agenda do dia, em lista cronológica | Massoterapeuta | M | RNF-01 |
| RF-31 | Ser avisado de mudanças na agenda sem precisar procurá-las (`aria-live`) | Massoterapeuta | [M/S/C/W] | RNF-01 |
| RF-32 | Cancelar atendimento, bloquear horário, iniciar e finalizar sessão | Massoterapeuta | M | RN-13 |
| RF-33 | Marcar ausência do colaborador | Massoterapeuta | [M/S/C/W] | RN-02 |

## Módulo 4 — RH

| ID | Requisito | Ator | Prioridade | Regras |
| --- | --- | --- | --- | --- |
| RF-20 | Gerenciar usuários | RH | M | — |
| RF-21 | Visualizar dashboards com KPIs e métricas | RH | M | — |
| RF-22 | Consultar auditoria dos agendamentos | RH | [M/S/C/W] | — |
| RF-23 | Adicionar bloqueios de horários | RH | [M/S/C/W] | — |
| RF-24 | Gerenciar unidades e salas (inclui gerar o QR Code de check-in) | RH | M | — |
| RF-25 | Montar a agenda diária de cada massoterapeuta: períodos de trabalho com data, horário e sala, sem recorrência | RH | M | RN-05, RN-08 |
| RF-26 | Facilitar a montagem da agenda (por exemplo, copiar a agenda de um dia para outros dias) [DECIDIR: forma a estudar] | RH | [M/S/C/W] | RN-08 |
| RF-27 | Editar os parâmetros das regras de negócio (duração da sessão, janela de agendamento, horário de funcionamento, prazos) sem novo deploy | RH | [M/S/C/W] | RN-01 a RN-11 |

O papel `ADMIN` (suporte) tem acesso a todos os requisitos deste módulo.

KPIs definidos para o MVP do RF-21 (D-08, decisão de 2026-10-21):

| KPI | Cálculo |
| --- | --- |
| Turnos mais procurados | Quantidade de atendimentos agendados com início no turno da manhã ou da tarde; apresentar os dois turnos em ordem fixa. Os limites usam `WORK_START`, `LUNCH_START`, `LUNCH_END` e `WORK_END`. |
| Dia da semana com maior volume | Quantidade de atendimentos por dia da semana, exibindo os sete dias mesmo quando o total for zero. |
| Horários mais procurados | Quantidade de atendimentos por horário de início local, exibindo os horários da grade e os totais zero. |
| Taxa de cancelamento | Por data do atendimento, dia, semana ou mês: `(atendimentos cancelados ÷ atendimentos agendados) × 100`; exibir também o número absoluto de cancelamentos. |
| Taxa de remarcação | Fora do MVP até que exista rastreamento explícito que vincule o atendimento cancelado à nova reserva. RF-08 permanece fora do MVP conforme D-03. |

## Regras de negócio

Números e condições do sistema. Os valores ficam em configuração, nunca fixos no código.

Os valores marcados como "no código" já estão no backend, mas **não foram aprovados pelo grupo**. Validem ou corrijam. Todos são **valores iniciais**: o RH pode alterá-los depois (RF-27).

| ID | Regra | Parâmetro | Valor |
| --- | --- | --- | --- |
| RN-01 | Antecedência mínima para agendamento e cancelamento | `BOOKING_MIN_NOTICE_MINUTES`, `CANCELLATION_MIN_NOTICE_MINUTES` | no código: 60 min para agendar, 120 min para cancelar [VALIDAR] |
| RN-02 | Limite de atraso para sessão (depois disso, o check-in é recusado e a sessão pode virar ausência) | `LATE_ARRIVAL_TOLERANCE_MINUTES` | no código: 10 min [VALIDAR] |
| RN-03 | Tolerância para confirmação após lembrete; sem confirmação, a vaga é liberada | `REMINDER_CONFIRMATION_TOLERANCE_MINUTES` | fora do protótipo (a reserva nasce confirmada); volta com o lembrete por e-mail. Valor inicial no código: 720 min [VALIDAR] |
| RN-04 | Padrão de acessibilidade visual para interface web | — | proposta: WCAG 2.2 nível AA [VALIDAR] |
| RN-05 | Duração da sessão | `SESSION_DURATION_MINUTES` (passo da grade: `SLOT_STEP_MINUTES`) | no código: 20 min [VALIDAR] |
| RN-06 | Limite de reservas futuras ativas por colaborador | `MAX_ACTIVE_BOOKINGS_PER_EMPLOYEE` | no código: 1 [VALIDAR] |
| RN-07 | Janela de agendamento (até quantos dias à frente) | `BOOKING_HORIZON_DAYS` | no código: 21 dias [VALIDAR] |
| RN-08 | Horário de funcionamento | `WORK_DAYS`, `WORK_START`, `LUNCH_START`, `LUNCH_END`, `WORK_END` | segunda a sexta, funcionamento das 8h às 18h nas unidades de São Paulo e Londrina (confirmado em 2026-10-21); almoço/pausas seguem os parâmetros configuráveis do sistema (RF-27), com 12h–13h como configuração atual inicial |
| RN-09 | Antecedência máxima do check-in | `CHECK_IN_EARLY_MINUTES` | no código: 15 min [VALIDAR] |
| RN-10 | Vaga liberada é oferecida à lista de espera por ordem de entrada; prazo para aceitar | `WAITLIST_ACCEPTANCE_MINUTES` | valor inicial: 30 min; validar com o RH antes da demonstração |
| RN-11 | Antecedência do lembrete ao colaborador | `REMINDER_LEAD_MINUTES` | no código: 1440 min (24 h) [VALIDAR] |
| RN-12 | Uma sessão não pode se sobrepor a outra do mesmo massoterapeuta nem da mesma sala | — | — |
| RN-13 | O massoterapeuta só age sobre a própria agenda; ações que alteram dados exigem confirmação | — | [VALIDAR: a antecedência mínima de cancelamento (RN-01) vale para o massoterapeuta?] |
| RN-14 | "Quem chegou" considera os check-ins do dia do massoterapeuta | — | — |
| RN-15 | Lembrete falado antes de cada sessão; apagado ou atualizado se a sessão mudar | antecedência do anúncio | proposta do `CONTEXT.md`: 5 min [VALIDAR] |
| RN-16 | Sessão em andamento não finalizada pelo massoterapeuta é concluída automaticamente no horário de término | — | decidido em 2026-10-19 |
| RN-17 | Uma mesma Alexa pode ser usada por vários massoterapeutas (n massoterapeutas : 1 Alexa) | — | decidido em 2026-10-22; como identificar quem está falando: D-19 |

## Máquina de estados da sessão

| Status (docs) | Código | Significado | Transições possíveis |
| --- | --- | --- | --- |
| reservada | `BOOKED` | Criada, aguardando confirmação do colaborador. **Não usado no protótipo:** a reserva nasce `confirmada` | confirmada, cancelada, liberada |
| confirmada | `CONFIRMED` | Colaborador confirmou presença (RN-03). No protótipo, estado inicial da reserva | chegou, em andamento, possível ausência, cancelada |
| chegou | `CHECKED_IN` | Colaborador fez check-in pelo QR Code (RF-06) | em andamento |
| possível ausência | `POSSIBLE_NO_SHOW` | Passou o limite de atraso (RN-02) sem check-in; o massoterapeuta é avisado | em andamento, ausente |
| em andamento | `IN_PROGRESS` | Massoterapeuta iniciou a sessão (RF-14) | concluída |
| concluída | `COMPLETED` | Massoterapeuta finalizou a sessão (RF-14) ou o horário de término passou sem ninguém finalizar (RN-16) | final |
| cancelada | `CANCELLED` | Cancelada pelo colaborador, pelo massoterapeuta ou pelo RH | final |
| liberada | `RELEASED` | Expirou sem confirmação; a vaga vai para a lista de espera (RN-10) | final |
| ausente | `NO_SHOW` | Ausência confirmada pelo massoterapeuta (RF-33) | final |

Transições fora desta tabela são erro. Toda transição gera um evento de auditoria.

Decisões (2026-10-19):

- **Confirmação:** no protótipo, a reserva nasce `confirmada`. A confirmação volta junto com o lembrete por e-mail (RF-05), integrado à interface do sistema: quem não confirmar no prazo perde a vaga (`reservada` → `liberada`, RN-03).
- **Início sem check-in:** o massoterapeuta pode iniciar a sessão a partir de `confirmada`, por exemplo quando a pessoa chegou mas não leu o QR Code. Quem está na sala é ele, e o sistema não o trava.
- **Conclusão automática (RN-16):** uma sessão `em andamento` que ninguém finalizou é concluída automaticamente no horário de término. Assim ela não fica aberta para sempre, atrapalhando o "próximo atendimento" e os KPIs.

Ponto a validar:

- Uma sessão em `chegou` (check-in feito) que o massoterapeuta nunca iniciou é concluída no horário de término, seguindo a RN-16 (D-06, decidido em 2026-10-20).

## Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Acessibilidade: tudo o que o massoterapeuta usa funciona só com leitor de tela ou só por voz. Listas em ordem cronológica, horários falados como se fala ("às 14h"), nada que dependa de cor ou posição. |
| RNF-02 | Respostas da Alexa em uma ou duas frases, rápidas, sem chamadas externas no caminho da resposta. |
| RNF-03 | Toda requisição da Alexa tem assinatura, certificado e horário verificados. |
| RNF-04 | Privacidade (LGPD): falas e avisos usam só o primeiro nome; nenhum dado de saúde em logs, voz ou mensagens; logs só com IDs. |
| RNF-05 | Datas gravadas em UTC; conversão para `America/Sao_Paulo` só na apresentação. |

## Integrações externas

| Integração | Uso | Fase (MVP / futuro) | Pontos de atenção | Responsável |
| --- | --- | --- | --- | --- |
| Alexa Skills Kit (skill customizada) | Consulta por voz (próximo, agenda do dia, quem chegou) e ações do massoterapeuta (cancelar, bloquear, iniciar e finalizar sessão) | MVP | Conta de desenvolvedor Amazon; endpoint HTTPS público no NestJS com verificação de assinatura; modelo de interação em pt-BR | [PREENCHER] |
| Alexa Reminders API | Anúncio "sua próxima sessão começa em 5 minutos" | MVP [VALIDAR] | Permissão do usuário; criação fora da conversa ainda não confirmada; apagar o lembrete ao cancelar | [PREENCHER] |
| Google OAuth (Workspace) | Login dos colaboradores | Futuro (roadmap, se der tempo) | O backend já tem um modo `AUTH_MODE=google` parcial; verificar a migração da Semantix para o Google Workspace | [PREENCHER] |
| Google Calendar API | Espelho para o colaborador | Futuro | Sem dado de saúde no evento | [PREENCHER] |

## Arquitetura e stack

| Camada | Escolha | Justificativa |
| --- | --- | --- |
| Backend | Node.js (NestJS) | ASK SDK (Kit oficial de skills da Alexa) tem versão oficial para Node.js, sendo a mais consolidada do mercado |
| Frontend | React - Aria ou shadcn/ui com Radix | Facilidade de implementação, possui bibliotecas de UI prontas e acessíveis |
| Banco de dados | PostgreSQL | Banco de dados relacional mais robusto e confiável |
| ORM | Prisma ORM | Curva de aprendizado mais baixa, migrações automatizadas, type-safety |
| Agendador de tarefas | @nestjs/schedule | Sem infraestrutura robusta para MVP, lê o estado do banco e sobrevive a reinícios |
| Testes | Jest | Framework de testes mais utilizado do mercado, "zero- config" |
| Hospedagem | [PREENCHER] | [PREENCHER] (a Alexa exige um endpoint HTTPS público, inclusive para a demonstração) |
| Repositório e CI | GitHub com GitHub Actions | Lint, testes e deploy automático a cada merge; integra bem com as LLM's |

## Catálogo de mensagens

Textos que o sistema envia aos usuários. Ficam num arquivo de textos, nunca espalhados pelo código.

| ID | Evento | Destinatário | Texto | Ações / botões |
| --- | --- | --- | --- | --- |
| MSG-01 | Lembrete | [PREENCHER] | [PREENCHER] | [PREENCHER] |
| MSG-02 | Confirmação da reserva | [PREENCHER] | [PREENCHER] | [PREENCHER] |
| MSG-03 | Vaga liberada da lista de espera | Colaborador | Uma vaga ficou disponível para você em {data}, às {hora}. Acesse a página inicial para aceitar ou recusar. | Aceitar ou recusar no card da página inicial |
| MSG-04 | Confirmação de check-in | Colaborador | Check-in confirmado para {data}, às {hora}, na {sala}. | Ver agendamento ou fechar |
| MSG-05 | Aviso de colaborador presente | Massoterapeuta | {primeiro_nome} chegou para o atendimento de hoje, às {hora}, na {sala}. | Abrir agenda ou fechar |
| MSG-06 | Aviso de possível ausência | Massoterapeuta | {primeiro_nome} ainda não fez check-in para o atendimento de hoje, às {hora}, na {sala}. | Abrir agenda ou fechar |

Comandos da Alexa (frases de exemplo e respostas; validar com os massoterapeutas):

| ID | Comando | Exemplo de frase | Resposta (sugestão) |
| --- | --- | --- | --- |
| ALX-01 | Próximo atendimento (RF-11) | "quem é o próximo" | "Próximo: {primeiro_nome}, às {hora}." |
| ALX-02 | Agenda do dia (RF-10) | "qual minha agenda de hoje" | "Hoje, {n} atendimentos. Primeiro: {primeiro_nome}, às {hora}." |
| ALX-03 | Quem chegou (RF-15) | "quem chegou" | "{primeiro_nome} chegou às {hora}." ou "Ninguém chegou ainda." |
| ALX-04 | Cancelar atendimento (RF-12) | "cancelar o atendimento das {hora}" | Pergunta: "Cancelar o atendimento de {primeiro_nome} às {hora}. Confirma?" Depois: "Cancelado." |
| ALX-05 | Bloquear agenda (RF-13) | "bloquear das {hora} às {hora}" | Pergunta: "Bloquear das {hora} às {hora}. Confirma?" Depois: "Bloqueado." [VALIDAR: e se houver atendimento no período?] |
| ALX-06 | Iniciar sessão (RF-14) | "iniciar sessão" | "Sessão com {primeiro_nome} iniciada." |
| ALX-07 | Finalizar sessão (RF-14) | "finalizar sessão" | "Sessão finalizada. Próximo: {primeiro_nome}, às {hora}." |
| ALX-08 | Ajuda | "ajuda" | Lista curta do que perguntar |
| ALX-09 | Parar | "parar" | Encerra |

## Questões em aberto

| Questão | Requisitos afetados | Resposta | Quem pergunta | Prazo |
| --- | --- | --- | --- | --- |
| Os cadastros (usuários, salas, grade) ficam com o RH ou existe um perfil de secretária? | RF-20, RF-23, RF-24, RF-25 | Com o RH; sem perfil de secretária (2026-10-16) | — | — |
| A interface web do massoterapeuta entra no MVP ou só a Alexa? | RF-30 a RF-33 | As duas entram (2026-10-19) | — | — |
| Como a Alexa identifica o massoterapeuta? | RF-17 e todo o Módulo 2 | Pareamento por código ao massoterapeuta (2026-10-16) | — | — |
| Com uma Alexa compartilhada (RN-17), como ela sabe qual massoterapeuta está falando? Pela agenda da sala no momento, por novo pareamento a cada troca, ou outro meio? | RF-17, RN-17, todo o Módulo 2 | [PREENCHER] (D-19) | Guilherme | Antes do TK-07.05 |
| Existe confirmação de presença após o lembrete, com liberação automática da vaga? | RF-05, RN-03 | Sim, máquina de estados híbrida (2026-10-16) | — | — |
| O papel do RH no código continua `ADMIN` ou passa a `HR`? | RF-20 a RF-27 | `HR`; `ADMIN` só para suporte (2026-10-19) | — | — |
| Por qual canal o lembrete chega ao colaborador no protótipo? | RF-05, RF-09 | Nenhum envio; card na página. E-mail no roadmap (2026-10-19) | — | — |
| Os valores das regras RN-01 a RN-11 estão corretos? | Módulos 1 e 2 | [PREENCHER] | [PREENCHER] | [PREENCHER] |
| A Reminders API funciona com o lembrete criado pelo backend? | RF-16, RN-15 | [PREENCHER] | [PREENCHER] | [PREENCHER] |
| O lembrete falado diz o nome do colaborador? (outra pessoa pode estar na sala) | RF-16 | [PREENCHER] | [PREENCHER] | [PREENCHER] |
| Onde o backend será hospedado para a demonstração? | Alexa | [PREENCHER] | [PREENCHER] | [PREENCHER] |
| Quais KPIs o RH quer ver? | RF-21 | Decidido em 2026-10-21: turnos da manhã e tarde, volume pelos sete dias da semana, horários de início mais procurados e cancelamentos agrupados pela data do atendimento, com taxa e número absoluto. Remarcação fica fora do MVP até haver vínculo explícito entre reservas. | — | — |

## Orientações para o Claude Code

O Claude Code trata este documento como contrato: implementa o que está aqui, rastreia tudo pelos IDs e pergunta em vez de supor.

## Preparação do repositório

- 1. Exportar este documento em Markdown e salvar como docs/requisitos.md.

- 2. Criar um CLAUDE.md na raiz que aponte para docs/requisitos.md e repita as regras abaixo.

- 3. Centralizar os parâmetros das regras de negócio num arquivo de configuração único.

## Regras de trabalho

- Implementar um módulo por vez, começando pelo modelo de dados.

- Regras de negócio e critérios de aceite são feitos com TDD: teste falhando, código mínimo, refatoração.

- Nomes de testes e commits citam o ID do requisito.

- Campo com [PREENCHER] ou [VALIDAR] não é preenchido por suposição: o Claude Code para e pergunta.

- Textos ao usuário vêm sempre do catálogo de mensagens.

## Definição de pronto (por requisito)

- Critérios de aceite cobertos por testes automatizados passando

- Requisitos não funcionais aplicáveis verificados

- Revisado por outra pessoa do grupo

- Status atualizado no documento

## Prompt inicial sugerido

Leia docs/requisitos.md por completo. Liste os requisitos com prioridade M que ainda têm [PREENCHER] ou [VALIDAR] e pergunte antes de começar.


Depois, implemente o modelo de dados e as regras de negócio com TDD,

citando os IDs nos testes e commits.
