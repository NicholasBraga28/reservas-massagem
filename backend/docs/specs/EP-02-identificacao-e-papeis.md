# EP-02 — Identificação e papéis

Status: ✅ (concluído em 2026-10-20; TK-02.01 a TK-02.03 mergeados na `main` pelo PR #7)
Marco: M1 — Domínio
Épico: EP-02 · Roadmap: `docs/roadmap.md`
Triage: `ready-for-agent`
Tickets: TK-02.01, TK-02.02, TK-02.03
Requisitos: decisões de 2026-10-16 (protótipo, `x-user-id`, login Google no roadmap) e de 2026-10-19 (papéis `EMPLOYEE`, `THERAPIST`, `HR`, `ADMIN`), D-12, RNF-01, RNF-04, RN-13 (só a parte de papel)

Criada em 2026-10-20. Fonte de verdade: `docs/requisitos.md`. Onde esta spec e o `requisitos.md` divergirem, vale o `requisitos.md`.

## Problem Statement

O EP-01 deixou os quatro papéis no banco, mas quem decide "quem é você" e "o que você pode fazer" ainda é o código do primeiro corte:

- A identificação e a autorização estão num único `ActorGuard`, num arquivo solto, que mistura três coisas: ler o `x-user-id`, validar o token do Google e conferir o papel. Ele lê `AUTH_MODE` direto de `process.env`, contrariando o `CLAUDE.md`.
- A herança `ADMIN` ⊃ `HR` não existe como regra: é uma lista fixa (`ROLES_WITH_HR_ACCESS`) repetida onde alguém lembrou de usá-la. A tabela de transições do EP-01 tem a sua própria versão da mesma regra.
- O guard é aplicado controller a controller. Um controller novo que esqueça o `@UseGuards` nasce aberto, sem aviso.
- Não existe um jeito de o frontend saber quem está logado e quais telas mostrar. A rota mais próxima (`GET /booking/me`) só aceita colaborador e devolve nome e e-mail, sem papel.
- Não existe como escolher o usuário no protótipo. Para a banca, alguém teria de copiar UUIDs do terminal do seed para o cabeçalho de cada requisição.
- As mensagens de erro de identificação falam em "cabeçalho x-user-id", jargão que um massoterapeuta com leitor de tela não tem como resolver.

Para a banca, isso significa que a demonstração não consegue trocar de papel (colaborador → massoterapeuta → RH) sem passos técnicos à vista. Para o time, significa que os EP-03 a EP-12 não têm um contrato estável de "quem pode chamar esta rota".

## Solution

Ao fim do EP-02:

- Existe o módulo `auth/`, com duas responsabilidades separadas e aplicadas **globalmente**:
  1. **Identificação:** descobre o usuário da requisição por um `ActorResolver` trocável. No protótipo (`AUTH_MODE=header`), pelo `x-user-id`; o modo Google fica isolado atrás da mesma interface, sem novos investimentos.
  2. **Autorização:** o `RolesGuard` compara o papel do usuário com o exigido pela rota, aplicando a herança `ADMIN` ⊃ `HR` de uma única função pura.
- Toda rota exige identificação, exceto as marcadas com `@Public()`: saúde, Alexa (que tem verificação própria, EP-07) e a lista de usuários de demonstração.
- `GET /me` devolve o perfil de quem está identificado: papel, papéis efetivos (com a herança já aplicada), nome, primeiro nome, ID de massoterapeuta quando houver e um `spokenText` para o leitor de tela anunciar quem entrou.
- `GET /auth/demo-users` (só com `AUTH_MODE=header`) lista os usuários ativos para a tela "Entrar como…" do frontend (D-12). Na banca, trocar de papel é um clique.
- Uma **matriz de permissões** por rota, nesta spec, é o contrato com o frontend e com os próximos épicos. Ela é verificada por um teste e2e com uma linha por rota e papel.
- As mensagens de identificação e de permissão dizem, em português e numa frase, o que aconteceu e o que fazer.

## User Stories

### Identificação no protótipo

1. Como apresentador na banca, quero escolher com quem entrar numa lista de usuários de demonstração, para mostrar a jornada do colaborador, do massoterapeuta e do RH sem copiar IDs.
2. Como apresentador, quero que a lista mostre o nome e o papel de cada pessoa em português ("Massoterapeuta", "Colaborador", "RH", "Suporte"), para escolher o perfil certo sem decorar nomes.
3. Como apresentador, quero que a lista venha agrupada por papel e em ordem alfabética dentro de cada grupo, para achar a pessoa rápido diante da banca.
4. Como massoterapeuta com leitor de tela, quero que a lista de usuários tenha um texto pronto para leitura em cada item, para escolher meu nome sem depender de layout visual.
5. Como RH, quero que um usuário que eu desativei suma da lista de demonstração, para que ninguém entre com um perfil desligado.
6. Como pessoa do suporte, quero que a lista de demonstração não exista quando a aplicação estiver em modo Google, para não expor os usuários num ambiente com login de verdade.
7. Como colaborador, quero que meu e-mail não apareça na lista de demonstração, para que uma rota pública não exponha mais dados do que o necessário (RNF-04).
8. Como apresentador, quero que usuários criados pelo RH durante a demo apareçam na lista sem rodar o seed de novo, para mostrar o cadastro funcionando de ponta a ponta.

### Quem sou eu (`GET /me`)

9. Como frontend, quero saber o papel de quem está identificado, para decidir quais telas mostrar.
10. Como frontend, quero receber os papéis efetivos já com a herança aplicada (o `ADMIN` recebe também `HR`), para não reimplementar a regra de herança no navegador.
11. Como massoterapeuta, quero ouvir "Você entrou como Marina, massoterapeuta." logo depois de escolher meu usuário, para ter certeza de que entrei com o perfil certo.
12. Como massoterapeuta, quero que o frontend saiba o meu ID de massoterapeuta, para abrir a minha agenda sem pedir outra informação.
13. Como colaborador, quero que o sistema me trate pelo primeiro nome, para que as telas e falas sejam curtas e pessoais (RNF-04).
14. Como frontend, quero que `GET /me` funcione para qualquer papel, para usar uma única rota no carregamento inicial.
15. Como colaborador, quero continuar vendo meu perfil depois que a rota legada `GET /booking/me` for substituída, para não perder nada na troca.

### Erros de identificação

16. Como massoterapeuta com leitor de tela, quero que, se eu não estiver identificado, a mensagem diga o que fazer ("escolha um usuário na tela de entrada"), para resolver sozinho.
17. Como usuário, quero receber a mesma mensagem para um ID inexistente, malformado ou de usuário desativado, para que o sistema não revele quais IDs existem.
18. Como usuário, quero que, ao tentar uma função do meu papel, a mensagem diga que meu perfil não tem acesso e o que fazer, sem códigos nem jargão.
19. Como frontend, quero distinguir "não identificado" (401) de "sem permissão" (403), para voltar à tela de entrada no primeiro caso e à página inicial no segundo.
20. Como pessoa do suporte, quero que os logs de recusa tragam só o ID do usuário, a rota e o motivo, sem nome nem e-mail (RNF-04).

### Papéis e herança

21. Como RH, quero acessar todas as rotas de RH, para fazer cadastros, montar agendas e ver indicadores.
22. Como pessoa do suporte, quero acessar tudo o que o RH acessa sem ter o papel `HR`, para diagnosticar problemas (decisão de 2026-10-19).
23. Como pessoa do suporte, quero que a herança `ADMIN` ⊃ `HR` seja a mesma nas rotas e na tabela de transições do atendimento, para que suporte e RH nunca vejam regras diferentes.
24. Como RH, quero não ter acesso às rotas do suporte que venham a existir, para que a separação entre cuidar do benefício e dar suporte técnico seja real.
25. Como colaborador, quero que só eu (e não o massoterapeuta nem o RH) use as rotas de reserva, check-in e lista de espera em meu nome, para que ninguém aja pela minha conta.
26. Como massoterapeuta, quero que só o papel `THERAPIST` use as rotas da agenda do massoterapeuta, para que outra pessoa não veja nem altere a minha agenda por elas (a posse de cada atendimento, RN-13, é verificada nos EP-06 e EP-07).
27. Como pessoa do suporte, quero que o `ADMIN` não herde os papéis de colaborador e massoterapeuta, para que ele nunca reserve nem inicie sessão em nome de alguém.

### Segurança por padrão

28. Como desenvolvedor, quero que toda rota nova exija identificação sem eu precisar lembrar de um decorator, para que nada nasça aberto por esquecimento.
29. Como desenvolvedor, quero marcar explicitamente as poucas rotas públicas com `@Public()`, para que a exceção fique visível na revisão.
30. Como desenvolvedor, quero declarar os papéis de uma rota ou de um controller com `@Roles(...)`, para ler a permissão junto da rota.
31. Como desenvolvedor, quero que uma rota identificada sem `@Roles` aceite qualquer papel, para rotas como `GET /me`.
32. Como desenvolvedor, quero receber o usuário da requisição por um decorator de parâmetro tipado, para não ler `request` à mão nos controllers.
33. Como desenvolvedor, quero que a Alexa continue funcionando sem `x-user-id`, porque ela se identifica pelo aparelho pareado (RF-17) e pela assinatura (RNF-03), não por cabeçalho.
34. Como pessoa do suporte, quero que a verificação de saúde continue pública, para o monitoramento da hospedagem funcionar.

### Modo Google isolado

35. Como time, quero que o código de login Google fique atrás da mesma interface do modo cabeçalho, para que voltar a ele no roadmap seja trocar uma implementação, sem tocar nas rotas.
36. Como time, quero que a escolha do modo venha da configuração validada (`ConfigService`), não de `process.env`, para seguir o `CLAUDE.md` e falhar na inicialização se o valor for inválido.
37. Como time, quero que nenhum teste do EP-02 dependa do Google, para não chamar serviço externo nos testes.

### Contrato com os próximos épicos

38. Como pessoa que escreve as specs dos EP-03 a EP-12, quero uma matriz de permissões por rota nesta spec, para acrescentar as minhas rotas no mesmo formato.
39. Como revisora, quero que a matriz seja um teste e2e com uma linha por rota e papel, para que uma permissão errada quebre o build.
40. Como frontend (EP-09), quero que `GET /me` e `GET /auth/demo-users` tenham contrato fixo nesta spec, para montar o roteamento por papel em paralelo ao backend.

## Implementation Decisions

### Ordem e escopo dos tickets

TK-02.01 → TK-02.02 → TK-02.03, como no roadmap. TK-02.02 e TK-02.03 dependem só do TK-02.01 e podem correr em paralelo depois dele. Com a D-12 decidida (ver "Decisões registradas por esta spec"), o TK-02.03 deixa de estar 🔒.

Regra do refactor (2026-10-16): o EP-02 leva para o lugar-alvo só a identificação e a autorização. Os controllers legados (`booking/`, `therapist/`, `admin/`) ficam onde estão: trocam o `@UseGuards(ActorGuard)` e a lista `ROLES_WITH_HR_ACCESS` pelos decorators novos e nada mais. A mudança de pasta deles é dos EP-03 a EP-06.

### TK-02.01 — Módulo `auth/`, identificação e `RolesGuard`

**Módulo.** `AuthModule` concentra identificação, autorização e as rotas do TK-02.02 e do TK-02.03. Ele registra os guards como globais (`APP_GUARD`), na ordem: limite de requisições (já existe), identificação, autorização.

**Herança de papéis: uma função pura.** O módulo expõe uma função pura sem dependência de Nest que responde "quais papéis este papel tem efetivamente":

| Papel | Papéis efetivos |
| --- | --- |
| `EMPLOYEE` | `EMPLOYEE` |
| `THERAPIST` | `THERAPIST` |
| `HR` | `HR` |
| `ADMIN` | `ADMIN`, `HR` |

e, a partir dela, "este papel satisfaz algum destes papéis exigidos?". O `ADMIN` herda só o `HR`, nunca `EMPLOYEE` nem `THERAPIST` (história 27). A tabela de transições do EP-01, que hoje trata `ADMIN` como `HR` por conta própria, passa a usar esta função. O comportamento dela não muda.

**Identificação.**

- Interface `ActorResolver`, injetada por token (`ACTOR_RESOLVER`): recebe a requisição e devolve o usuário ou nada. A implementação é escolhida por `AUTH_MODE`, lido do `ConfigService`:
  - `HeaderActorResolver` (`header`, padrão): lê `x-user-id`. Valor ausente → "não identificado". Valor que não é UUID → recusado sem consultar o banco.
  - `GoogleActorResolver` (`google`): o código atual do token Google, movido sem mudança de comportamento e sem testes novos (Google está fora do MVP). Ele continua lendo `GOOGLE_CLIENT_ID` e `GOOGLE_WORKSPACE_DOMAIN`, agora pelo `ConfigService`.
- O guard de identificação pula as rotas com `@Public()`. Nas demais, usa o resolver; usuário inexistente ou com status diferente de `ACTIVE` é recusado. O usuário aceito é anexado à requisição.
- O usuário da requisição é um tipo pequeno e imutável: ID, papel, nome e e-mail. Nenhum outro dado do banco vai para a requisição.

**Autorização.**

- `@Roles(...papéis)` em rota ou controller; o da rota vence o do controller.
- O `RolesGuard` pula as rotas `@Public()`. Sem `@Roles`, qualquer usuário identificado passa. Com `@Roles`, passa quem satisfaz algum dos papéis exigidos pela função de herança.
- A verificação de posse ("este atendimento é meu?", RN-13) **não** é do guard: fica nos services dos EP-04 a EP-07, que já recebem o usuário.

**Decorators.** `@Public()`, `@Roles(...)` e `@CurrentActor()` (parâmetro tipado com o usuário da requisição). Os nomes antigos (`ActorGuard`, `Actor`, `ROLES_WITH_HR_ACCESS`) deixam de existir.

**Rotas públicas** depois do EP-02: `GET /health`, `GET /health/ready`, `POST /alexa` e `GET /auth/demo-users`. A Alexa é pública no nível HTTP porque se identifica pelo `deviceId` pareado (TK-07.03, TK-07.05) e pela assinatura (TK-07.02, RNF-03).

**Respostas de erro** (`HttpException` do Nest, mensagem do catálogo):

| Situação | Status | Mensagem (proposta, [VALIDAR] com os massoterapeutas no TK-14.03) |
| --- | --- | --- |
| Sem `x-user-id` (ou sem token, no modo Google) | 401 | "Você ainda não se identificou: escolha um usuário na tela de entrada." |
| ID malformado, inexistente ou de usuário inativo | 401 | "Não encontramos um usuário ativo com essa identificação: escolha um usuário na tela de entrada." |
| Identificado, mas o papel não tem acesso | 403 | "Seu perfil não tem acesso a esta função: volte para a página inicial." |

As três substituem `missingActor`, `invalidActor` e `forbidden` no catálogo atual. Os casos de 401 não distinguem "não existe" de "inativo" (história 17). Cada recusa é registrada no `Logger` do Nest com o ID do usuário (quando houver), o método, a rota e o motivo; sem nome nem e-mail (RNF-04).

**Matriz de permissões** (contrato do EP-02; cada épico seguinte acrescenta as suas rotas aqui ou na própria spec, no mesmo formato, e no mesmo teste e2e):

| Rota | Público | `EMPLOYEE` | `THERAPIST` | `HR` | `ADMIN` |
| --- | --- | --- | --- | --- | --- |
| `GET /health`, `GET /health/ready` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /alexa` | ✅ (verificação própria, EP-07) | — | — | — | — |
| `GET /auth/demo-users` (só `AUTH_MODE=header`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /me` | 401 | ✅ | ✅ | ✅ | ✅ |
| `/booking/*` (legado: horários, reservas, lista de espera, check-in) | 401 | ✅ | 403 | 403 | 403 |
| `/therapist/*` (legado: agenda, próximo, cancelar, bloquear, iniciar, finalizar) | 401 | 403 | ✅ | 403 | 403 |
| `/admin/*` (legado: usuários, salas, bloqueios, agenda, auditoria, KPIs) | 401 | 403 | 403 | ✅ | ✅ (herda `HR`) |

"Público" é a coluna de quem não manda identificação. As rotas legadas mudam de nome e de pasta nos EP-03 a EP-06; a permissão de cada uma vai junto, e a linha correspondente da matriz é atualizada no mesmo PR. O EP-03 substitui as linhas de cadastro do `/admin/*` pelas rotas novas (`docs/specs/EP-03-cadastros-do-rh.md`), todas `HR` com herança para `ADMIN`.

**Configuração.** `AUTH_MODE` continua validado na inicialização (TK-00.02), com `header` como padrão. Nenhuma variável nova.

### TK-02.02 — `GET /me`

- Rota identificada, sem `@Roles`: qualquer papel.
- Resposta (200):

  ```json
  {
    "id": "00000000-0000-4000-8000-000000000101",
    "role": "THERAPIST",
    "effectiveRoles": ["THERAPIST"],
    "name": "Marina Castro",
    "firstName": "Marina",
    "therapistId": "…",
    "spokenText": "Você entrou como Marina, massoterapeuta."
  }
  ```

  - `effectiveRoles` vem da função de herança do TK-02.01 (`ADMIN` → `["ADMIN", "HR"]`). O frontend decide as telas por este campo.
  - `therapistId` é o ID do registro de massoterapeuta quando o usuário é `THERAPIST` e tem perfil; `null` nos demais casos.
  - `firstName` é a primeira palavra do nome, sem espaços nas pontas. A derivação é uma função pura compartilhada; o formatador de fala do TK-06.01 a reaproveita em vez de recriá-la.
  - `spokenText` vem do catálogo de mensagens: "Você entrou como {primeiro nome}, {papel por extenso}." O papel por extenso também vem do catálogo: `EMPLOYEE` → "colaborador", `THERAPIST` → "massoterapeuta", `HR` → "RH", `ADMIN` → "suporte". [VALIDAR] o texto com os massoterapeutas no TK-14.03.
  - O e-mail **não** sai no `GET /me`: nenhuma tela do MVP precisa dele, e a rota é chamada em todo carregamento.
- A rota legada `GET /booking/me` é removida neste ticket, e os testes que a usam como "rota identificada qualquer" passam a usar `GET /me`.
- Os dados vêm de uma consulta do próprio módulo `auth/` (usuário + perfil de massoterapeuta). Quando o TK-03.01 criar os módulos donos (`users/` e `therapists/`, ver a spec do EP-03), a leitura passa a ser pedida ao service dono.

### TK-02.03 — Usuários de demonstração (D-12)

- `GET /auth/demo-users`, `@Public()`. Só existe com `AUTH_MODE=header`: em outro modo responde 404, como uma rota inexistente.
- Resposta (200): lista de usuários **ativos**, agrupada por papel na ordem `EMPLOYEE`, `THERAPIST`, `HR`, `ADMIN` e, dentro de cada papel, por nome em ordem alfabética (pt-BR):

  ```json
  [
    {
      "id": "00000000-0000-4000-8000-000000000103",
      "name": "Beatriz Lima",
      "firstName": "Beatriz",
      "role": "EMPLOYEE",
      "roleLabel": "Colaborador",
      "spokenText": "Beatriz Lima, colaborador."
    }
  ]
  ```

  - `roleLabel` e o texto do papel em `spokenText` vêm do catálogo de mensagens, os mesmos do `GET /me`.
  - Sem e-mail, sem `googleSubject`, sem datas: a rota é pública (RNF-04).
- Lê do banco a cada chamada, sem cache: um usuário criado ou desativado pelo RH aparece ou some na próxima chamada (histórias 5 e 8).
- A tela "Entrar como…" é do EP-09 (TK-09.02): ela chama esta rota, guarda o ID escolhido e o envia no `x-user-id` de toda requisição. O backend não guarda sessão.
- O seed de demonstração continua imprimindo os IDs no terminal; a rota é o caminho para a banca, o terminal fica para quem desenvolve.

### Contrato da API

| Mudança | Detalhe |
| --- | --- |
| Nova | `GET /me` (TK-02.02) |
| Nova | `GET /auth/demo-users` (TK-02.03) |
| Removida | `GET /booking/me`, substituída por `GET /me` |
| Alterada | Mensagens de 401 e 403 em todas as rotas identificadas (tabela "Respostas de erro") |

Nenhuma outra rota muda de caminho ou de formato. Ainda não há frontend consumindo a API, por isso a remoção de `GET /booking/me` não é tratada como incompatível.

### Acessibilidade

- `GET /me` e `GET /auth/demo-users` trazem `spokenText` com a informação principal nas primeiras palavras (nome antes do papel), só o primeiro nome no `GET /me`.
- A lista de demonstração vem ordenada pelo backend (papel, depois nome), para o leitor de tela percorrer na ordem em que aparece.
- As mensagens de 401 e 403 dizem o que aconteceu e o que fazer, numa frase, sem "cabeçalho", "token", "x-user-id" ou código de status.
- Textos com teste de formato: começam pelo nome, uma frase, sem termos técnicos.

### Decisões registradas por esta spec (2026-10-20)

- **D-12:** tela de seleção de usuário de demonstração, alimentada por `GET /auth/demo-users`, só com `AUTH_MODE=header`.
- Modo Google isolado atrás de `ActorResolver`, sem investimento novo até sair do roadmap.
- Identificação e autorização globais, com `@Public()` explícito para exceções.

## Testing Decisions

### O que é um bom teste aqui

- Testa o que o cliente da API observa: status, corpo e mensagem para cada combinação de rota, papel e identificação. Não testa a ordem interna dos guards nem como o metadado é lido.
- Nome do teste cita o ticket ou o requisito: `it('TK-02.01: lets ADMIN use HR routes by inheritance')`, `it('RNF-04: hides the email from the demo users list')`.
- Sem Google, sem rede: o modo `google` não tem teste novo.
- Cada teste cria os próprios usuários e esvazia as tabelas no `beforeEach`.

### Seams (confirmados em 2026-10-20)

1. **A API inteira pelo HTTP, com banco real: o seam principal.** Um teste e2e de **matriz de permissões** com `createTestApp()`, tabela-dirigido (`it.each`): para cada linha da matriz, uma rota representativa de cada grupo é chamada sem identificação e com um usuário de cada papel, e o status esperado é conferido. Rotas públicas não podem responder 401; rotas identificadas, sem identificação, respondem 401 com a mensagem do catálogo; papel sem acesso responde 403 com a mensagem do catálogo. "Tem acesso" é verificado como "não é 401 nem 403", para que o teste de permissão não dependa das regras de negócio da rota. No mesmo seam:
   - `x-user-id` malformado, inexistente e de usuário inativo → 401 com a mesma mensagem;
   - `GET /me` para cada papel, com `effectiveRoles`, `firstName`, `therapistId` e `spokenText`;
   - `GET /auth/demo-users`: só ativos, ordem por papel e nome, sem e-mail; 404 com `AUTH_MODE=google` (aplicação de teste criada com essa configuração);
   - `GET /booking/me` deixa de existir.
2. **Função pura de herança de papéis.** Testes unitários sem `Test.createTestingModule`, exaustivos: todo papel × todo conjunto de papéis exigidos de um elemento (4 × 4), mais os casos nomeados (`ADMIN` satisfaz `HR`; `HR` não satisfaz `ADMIN`; `ADMIN` não satisfaz `EMPLOYEE` nem `THERAPIST`). A derivação de `firstName` entra aqui também, como função pura (nome com espaços extras, nome de uma palavra).

O `ActorGuard` atual tem testes unitários com `Reflector` e contexto falso. Eles são substituídos pelo seam 1, que cobre o mesmo comportamento pelo HTTP. Não se criam testes unitários novos para os guards: o seam 1 é mais alto e testa o contrato que importa.

### Prior art

- `test/roles.e2e-spec.ts`: papéis pelo HTTP, com usuários criados no teste e mensagem do catálogo. A matriz cresce a partir dele.
- `test/app.e2e-spec.ts`: 401 sem identificação, hoje via `GET /booking/me`.
- `src/appointments/appointment-status.spec.ts`: tabela pura testada de forma exaustiva, modelo para a função de herança.
- `test/support/create-test-app.ts`: ponto de extensão para criar a aplicação com outra configuração (`AUTH_MODE=google`), do mesmo jeito que já aceita outro `Clock`.

### Regressão

`npm run test`, `npm run test:e2e`, `npm run lint` e `npm run build` passam ao fim de cada ticket. Os testes legados que conferem as mensagens antigas de 401 e 403 passam a conferir as novas, sem mudar o que verificam.

## Critérios de aceite por ticket

### TK-02.01 — Identificação e `RolesGuard`

- **Dado** uma rota identificada, **quando** chega sem `x-user-id`, **então** responde 401 com "Você ainda não se identificou: escolha um usuário na tela de entrada."
- **Dado** um `x-user-id` que não é UUID, **quando** a requisição chega, **então** responde 401 com a mensagem de identificação inválida, sem consultar o banco.
- **Dado** um `x-user-id` de usuário inexistente ou inativo, **quando** a requisição chega, **então** responde 401 com a mesma mensagem de identificação inválida.
- **Dado** um usuário `ADMIN`, **quando** chama uma rota `/admin/*`, **então** tem acesso (herda `HR`).
- **Dado** um usuário `HR`, **quando** chama uma rota exigida só para `ADMIN`, **então** recebe 403 (verificado pela função pura; ainda não há rota só de `ADMIN`).
- **Dado** um usuário `ADMIN`, **quando** chama uma rota `/booking/*` ou `/therapist/*`, **então** recebe 403.
- **Dado** cada linha da matriz de permissões, **quando** cada papel chama a rota, **então** o resultado é o da matriz.
- **Dado** `GET /health` ou `POST /alexa`, **quando** chegam sem `x-user-id`, **então** não respondem 401.
- **Dado** um controller novo sem nenhum decorator de acesso, **quando** é chamado sem identificação, **então** responde 401 (segurança por padrão; verificado pelo `GET /me`, que não tem `@Roles`).
- **Dado** a tabela de transições do atendimento, **quando** o `ADMIN` pede uma transição permitida ao `HR`, **então** continua permitida, agora pela função de herança compartilhada.
- **Dado** uma recusa 401 ou 403, **quando** ela é registrada no log, **então** o registro tem só ID, método, rota e motivo, sem nome nem e-mail.
- **Dado** o código-fonte, **quando** se procura `ActorGuard`, `ROLES_WITH_HR_ACCESS` ou leitura de `AUTH_MODE` em `process.env`, **então** não há ocorrências.

### TK-02.02 — `GET /me`

- **Dado** um massoterapeuta com perfil, **quando** chama `GET /me`, **então** recebe `role` `THERAPIST`, `effectiveRoles` `["THERAPIST"]`, `firstName`, `therapistId` preenchido e `spokenText` "Você entrou como {primeiro nome}, massoterapeuta."
- **Dado** um `ADMIN`, **quando** chama `GET /me`, **então** `effectiveRoles` contém `ADMIN` e `HR`, e `therapistId` é `null`.
- **Dado** um colaborador com nome "Beatriz Lima", **quando** chama `GET /me`, **então** `firstName` é "Beatriz" e o corpo não tem e-mail.
- **Dado** um usuário com nome " Ana  Souza ", **quando** o primeiro nome é derivado, **então** é "Ana".
- **Dado** qualquer papel, **quando** chama `GET /me` identificado, **então** recebe 200.
- **Dado** a rota legada `GET /booking/me`, **quando** é chamada, **então** responde 404.

### TK-02.03 — Usuários de demonstração

- **Dado** `AUTH_MODE=header` e usuários ativos de todos os papéis, **quando** se chama `GET /auth/demo-users` sem identificação, **então** responde 200 com a lista agrupada na ordem `EMPLOYEE`, `THERAPIST`, `HR`, `ADMIN` e, dentro de cada papel, em ordem alfabética.
- **Dado** um usuário inativo, **quando** a lista é pedida, **então** ele não aparece.
- **Dado** a lista, **quando** se inspeciona qualquer item, **então** há `id`, `name`, `firstName`, `role`, `roleLabel` e `spokenText`, e não há e-mail.
- **Dado** um item da lista, **quando** se lê o `spokenText`, **então** ele começa pelo nome e termina com o papel por extenso, em uma frase.
- **Dado** `AUTH_MODE=google`, **quando** se chama `GET /auth/demo-users`, **então** responde 404.
- **Dado** um usuário criado depois da primeira chamada, **quando** a lista é pedida de novo, **então** ele aparece.

## Out of Scope

- Login Google funcionando de ponta a ponta, sessão, cookies, JWT: fora do MVP. O código existente só é isolado.
- Verificação de posse do atendimento ou da agenda (RN-13: "o massoterapeuta só age sobre a própria agenda"): services dos EP-04 a EP-07.
- Identificação da Alexa por aparelho pareado e verificação de assinatura: TK-07.02, TK-07.03, TK-07.05.
- Rotas exclusivas do `ADMIN` (suporte): nenhuma no MVP até agora. A função de herança já as suporta.
- Tela "Entrar como…" e roteamento por papel no frontend: TK-09.02.
- CRUD de usuários e ativação/desativação: TK-03.01.
- Mudança de pasta das rotas legadas (`booking/`, `therapist/`, `admin/`): EP-03 a EP-06.
- Limite de requisições por usuário (hoje o `ThrottlerGuard` é por IP): não muda.

## Further Notes

### Riscos

- **A rota pública de demonstração expõe nomes e papéis** de todos os usuários ativos para quem tiver a URL. Aceitável no protótipo, com dados fictícios do seed. Se a demo usar a hospedagem pública da D-09, só dados de demonstração podem estar no banco. A rota some com `AUTH_MODE=google`.
- **Qualquer pessoa com a URL pode se passar por qualquer usuário** no modo cabeçalho. É a decisão de 2026-10-16 (protótipo). Vale registrar isso no roteiro da banca (TK-13.05), já que a pergunta é provável.
- **Guards globais mudam o comportamento de rotas que hoje não têm guard.** Hoje são só saúde e Alexa; as duas ficam `@Public()`. A matriz e2e é a rede de proteção.

### Divergências encontradas (resolvidas em 2026-10-20)

- ~~**`CLAUDE.md`, seção "Estado atual do código":** a linha de `ROLES_WITH_HR_ACCESS`~~ Removida no PR do TK-02.01.
- ~~**`CONTEXT.md`, decisões:** identificação sem a tela de seleção~~ D-12 acrescentada no PR do TK-02.03.

### Notas da implementação (2026-10-20)

Ajustes feitos na revisão do PR #7. Nenhum muda o contrato desta spec; ficam registrados para quem estender o módulo:

- **Log de recusa com o padrão da rota, não o caminho.** O registro traz `/api/booking/check-in/:token`, não o valor do token. Valores de caminho (tokens de check-in, IDs de outra pessoa) nunca chegam ao log (RNF-04). Rotas novas com segredo no caminho (como o token de check-in do EP-03) herdam essa proteção.
- **404 fora do modo cabeçalho igual ao de rota inexistente.** `GET /auth/demo-users` com `AUTH_MODE=google` responde com o mesmo corpo de uma rota que não existe, por um guard próprio da rota.
- **Ordem dos guards explícita.** Limite de requisições, identificação e autorização são registrados numa única lista no `AuthModule`.
- **Nomes.** A pergunta "este papel satisfaz algum dos exigidos?" chama `canActAs`. A checagem de status `ACTIVE` é compartilhada pelos dois resolvers. Os rótulos de papel (`roleLabel`) derivam dos nomes falados do catálogo, sem repetir o mapa.
- **Mensagens de 401 e 403 em uma frase**, como pede o `CLAUDE.md`. Texto atualizado nesta spec e no TK-02.01; continua [VALIDAR] no TK-14.03.

### Perguntas em aberto

| Pergunta | Afeta | Bloqueia |
| --- | --- | --- |
| Texto das mensagens de 401 e 403 e do `spokenText` de entrada. [VALIDAR com os massoterapeutas no TK-14.03] | TK-02.01, TK-02.02, TK-02.03 | Nada: entra a proposta |
| Rótulo do `ADMIN` para quem usa: "suporte" ou outro termo? [VALIDAR] | TK-02.02, TK-02.03 | Nada: entra "suporte" |
