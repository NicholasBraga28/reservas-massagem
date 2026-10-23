# Roadmap de testes da Alexa

Roteiro para testar a skill da Alexa de ponta a ponta: da primeira resposta "Olá" no Echo Show até as ações por voz. Complementa o épico EP-07 de [docs/roadmap.md](../roadmap.md) e segue os requisitos de [docs/requisitos.md](../requisitos.md) (RF-10 a RF-17, RNF-02 e RNF-03).

Este roteiro é só para testar a Alexa. Ele não substitui o roadmap geral: os tickets continuam sendo a fonte de verdade para o trabalho, e cada fase aponta o ticket correspondente.

## Como usar

- Faça as fases em ordem. Cada fase tem um critério de sucesso; só avance quando ele for atendido.
- Atualize a coluna **Status** ao terminar cada fase: ⬜ a fazer · 🟡 em andamento · ✅ concluída · 🔒 bloqueada.
- Registre o que aconteceu de verdade, inclusive as falhas, na seção "Registro de testes" no fim do arquivo.

| Fase | Objetivo | Ticket | Status |
| --- | --- | --- | --- |
| 0 | Pré-requisitos | — | ⬜ |
| 1 | "Olá" de ponta a ponta no Echo Show | TK-07.01 | ⬜ |
| 2 | Consultas com dados reais (próximo, agenda, quem chegou) | TK-07.06 (versão provisória) | ⬜ |
| 3 | Modelo de interação pt-BR publicado pela ASK CLI | TK-07.04 | ⬜ |
| 4 | Assinatura das requisições | TK-07.02 | ⬜ |
| 5 | Arquitetura de handlers | TK-07.03 | ⬜ |
| 6 | Pareamento por código ("vincular código") | TK-07.05 | 🔒 EP-01, EP-03 |
| 7 | Ações por voz com confirmação | TK-07.07 | 🔒 D-04, D-05 |
| 8 | Lembrete falado antes da sessão | TK-07.09, TK-07.10 | 🔒 D-15, D-16 |

## Fase 0: pré-requisitos

**Objetivo:** deixar o ambiente pronto para receber requisições da Amazon.

- [ ] Conta Amazon Developer criada e logada (feito pelo responsável, Guilherme).
- [ ] Skill customizada criada: idioma principal **Português (BR)**, modelo **Custom**, hospedagem **Provision your own**, template **Start from scratch**.
- [ ] Skill ID copiado para `ALEXA_SKILL_ID` no `backend/.env`.
- [ ] Echo Show na mesma conta Amazon, com idioma do aparelho e do app Alexa em **Português (Brasil)**.
- [ ] `backend/.env` com `PORT=3001` (a porta 3000 está ocupada por outro projeto).
- [ ] PostgreSQL local no ar: `docker compose up -d` dentro de `backend/`.
- [ ] Migrações aplicadas: `npm run prisma:deploy`.
- [ ] Túnel HTTPS escolhido (cloudflared, sem conta, ou ngrok, com authtoken).

**Critério de sucesso:** `curl http://localhost:3001/api/health` responde `{"status":"ok"}`.

## Fase 1: "Olá" de ponta a ponta (TK-07.01)

**Objetivo:** provar que a Amazon chega ao backend e que a resposta volta para o Echo Show.

1. Subir o backend: `npm run start:dev` (em `backend/`).
2. Subir o túnel apontando para `http://localhost:3001`. Copiar a URL HTTPS.
3. Na skill, em **Endpoint**, colar a URL HTTPS com o caminho `/api/alexa`. Tipo HTTPS, certificado: subdomínio de domínio com certificado curinga.
4. Em **Test**, ativar **Development** para pt-BR.
5. Testar no **simulador** do console: digitar "abrir pausa massoterapia" (ou o nome que a skill tiver).
6. Testar no **Echo Show**: "Alexa, abrir {nome da skill}".

**Critério de sucesso:** o Echo Show responde "Olá. Você pode pedir o próximo atendimento, a agenda do dia ou quem já chegou." e o log do backend mostra a requisição `LaunchRequest`.

**Se falhar:**
- Erro de endpoint no console: confira se a URL é HTTPS e se o túnel está no ar (`curl` na URL pública deve responder).
- Echo não responde a pt-BR: confira o idioma do aparelho e do app.
- Resposta vazia: olhe o log do `start:dev`; o `AlexaController` loga falhas do ASK SDK.

## Fase 2: consultas com dados reais (versão provisória de TK-07.06)

**Objetivo:** testar "próximo atendimento", "agenda do dia" e "quem chegou" com um terapeuta de demonstração e agendamentos reais no banco. Nesta fase a identificação é provisória (`ALEXA_USER_MAP`), não o pareamento.

1. Na Fase 1, o log mostra o `userId` da requisição (`amzn1.ask.account...`). Copiar esse valor.
2. Confirmar o conteúdo de `backend/prisma/demo-seed.ts` antes de rodar. Ele cria um terapeuta em UUID fixo.
3. Rodar o seed de demonstração e conferir no banco que há agendamentos para hoje.
4. Em `backend/.env`, preencher `ALEXA_USER_MAP` com o `userId` da Amazon apontando para o UUID do usuário terapeuta do seed. Reiniciar o backend.
5. Testar no Echo Show:

| Frase | Resposta esperada hoje (código atual) | Resposta planejada (ALX) |
| --- | --- | --- |
| "qual é o meu próximo atendimento" | Seu próximo atendimento é às {hora}, com {nome}. | "Próximo: {primeiro_nome}, às {hora}." |
| "qual minha agenda de hoje" | Sua agenda de hoje tem {n} atendimentos: ... | "Hoje, {n} atendimentos. Primeiro: {primeiro_nome}, às {hora}." |
| "quem chegou" | Já chegaram: {nomes}. | "{primeiro_nome} chegou às {hora}." ou "Ninguém chegou ainda." |

**Critério de sucesso:** as três consultas respondem com os dados do seed, em português falado, sem IDs.

**Divergências conhecidas (a registrar, não a corrigir nesta fase):**
- O código atual usa o nome completo, e o planejado usa só o primeiro nome (RNF e EP-06).
- O código atual ainda usa `RESERVED`; o planejado usa `BOOKED` (TK-01.03). O seed pode quebrar após o EP-01.
- Erros de "terapeuta não encontrado" aparecem como "Não consegui consultar a agenda agora", sem indicar o motivo (ver Fase 6).

## Fase 3: modelo de interação pt-BR (TK-07.04)

**Objetivo:** versionar o modelo de interação no repositório e publicá-lo pela ASK CLI, em vez de montá-lo só no console.

1. Criar `backend/alexa/interaction-model.pt-BR.json` com os intents `ProximoAtendimentoIntent`, `AgendaDoDiaIntent` e `QuemChegouIntent`, e com as frases de exemplo.
2. Os nomes de intent já usados no código atual devem ser mantidos, para não quebrar a Fase 2.
3. Instalar a ASK CLI e autenticar com a conta Amazon (passo manual do responsável).
4. Publicar o modelo e testar as três frases de novo no Echo Show.

**Critério de sucesso:** as três frases são reconhecidas pelo Echo Show sem usar o simulador, e o modelo está no repositório.

**Observação:** as frases de exemplo precisam ser validadas com massoterapeutas (TK-14.03). Esta fase valida só o reconhecimento técnico.

## Fase 4: assinatura das requisições (TK-07.02)

**Objetivo:** cumprir o RNF-03. Hoje o endpoint aceita qualquer requisição.

- Verificar a assinatura (`Signature` e `SignatureCertChainUrl`), o certificado e o horário da requisição (tolerância de 150 segundos).
- Rejeitar requisições sem assinatura válida com erro HTTP, sem resposta de voz.
- Testar com requisições assinadas e adulteradas; os testes não chamam a Amazon, usam certificados de teste.

**Critério de sucesso:** o Echo Show continua respondendo (as requisições reais são válidas) e uma requisição sem assinatura é rejeitada nos testes.

**Por que nesta ordem:** a assinatura só entra depois da Fase 1, para não misturar um problema de conexão com um problema de segurança. Antes de publicar a skill para outras pessoas, ela é obrigatória.

## Fase 5: arquitetura de handlers (TK-07.03)

**Objetivo:** trocar o controller com handlers inline por uma classe por intent, com `canHandle` e `handle`, e tirar `new Date()` e `ALEXA_USER_MAP` do controller.

- Cada intent vira uma classe em `src/alexa/handlers/`.
- O controller só despacha.
- Os testes das Fases 1 a 3 continuam passando sem mudança de comportamento: esta fase é refatoração.

**Critério de sucesso:** as respostas da Fase 2 não mudam, e os testes unitários dos handlers passam.

## Fase 6: pareamento por código (TK-07.05)

**Objetivo:** substituir `ALEXA_USER_MAP` pelo pareamento de RF-17: o RH gera um código e o massoterapeuta diz "vincular código {código}".

**Depende de:** TK-01.05 (tabela `AlexaDevice`), TK-03.08 (geração do código, EP-03) e TK-07.03.

**Critérios de sucesso:**
- Um aparelho sem pareamento recebe: "Este aparelho ainda não está vinculado. Peça ao RH um código de vinculação."
- Um código válido vincula o aparelho; um código usado ou expirado é recusado.
- `ALEXA_USER_MAP` é removido do código e do `.env.example`.

**Enquanto isso:** a Fase 2 continua com `ALEXA_USER_MAP`, e a mensagem de aparelho não vinculado fica como pendência.

## Fase 7: ações por voz com confirmação (TK-07.07)

**Objetivo:** cancelar, bloquear, iniciar e finalizar sessão, sempre com confirmação falada antes da mudança (ALX-04 a ALX-07).

**Depende de:** TK-06.03, TK-07.05 e as decisões **D-04** (bloqueio com atendimentos marcados) e **D-05** (antecedência de cancelamento para o massoterapeuta).

**Critérios de sucesso:**
- Nenhuma ação altera dados sem um "sim" explícito em outra fala.
- O "não" ou o silêncio cancela a ação e diz isso.
- A confirmação do resultado é falada e curta (uma ou duas frases).

## Fase 8: lembrete falado antes da sessão (TK-07.09, TK-07.10)

**Objetivo:** testar se a Reminders API aceita lembrete criado pelo backend, fora da conversa (RF-16).

1. **Spike (TK-07.09):** criar um lembrete pelo backend para um aparelho de teste e confirmar que ele aparece e toca no Echo Show. Esse é o resultado que fecha D-15.
2. **TK-07.10:** criar, atualizar e apagar o lembrete quando a sessão mudar. Só depois que D-16 (se o lembrete diz o nome do colaborador) for decidido.

**Critério de sucesso do spike:** o lembrete aparece e toca no Echo Show, criado pelo backend, sem o usuário pedir.

**Atenção:** a Reminders API exige permissão do usuário para lembretes. Confirmar esse passo antes de testar.

## Lacunas registradas

Lacunas do código atual, em `backend/src/alexa/alexa.controller.ts`, que este roteiro precisa cobrir:

- Nenhuma verificação de assinatura (RNF-03) → Fase 4.
- Identificação por `ALEXA_USER_MAP` e ID do simulador → Fase 6.
- `new Date()` no intent de agenda (regra do CLAUDE.md) → Fase 5.
- Textos fixos no controller, fora de `notifications/messages.ts` → fase do TK-06.01.
- Ações pedem `appointmentId` em vez de horário falado → Fase 7.
- Status `RESERVED` em vez de `BOOKED` → TK-01.03.

## Registro de testes

Preencher a cada rodada. Não apague os registros antigos: eles mostram o que mudou.

| Data | Fase | Dispositivo | Frase ou ação | Resultado | Observação |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |
