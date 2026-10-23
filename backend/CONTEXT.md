# CONTEXT.md
 
Contexto de domínio e decisões do projeto. Complementa o `CLAUDE.md` (como trabalhar) e o `docs/requisitos.md` (o que construir).
 
## O desafio
 
Desafio de Inovação do Programa de Estágio Semantix 2026:
 
> Como a tecnologia pode promover inclusão profissional e autonomia para massoterapeutas com deficiência visual, eliminando o atrito operacional e elevando o bem-estar corporativo?
 
A Semantix mantém um programa de bem-estar corporativo com sessões de massoterapia para os colaboradores, atendidas por massoterapeutas com deficiência visual.
 
## O problema
 
Achados das entrevistas com os terapeutas:
 
- O terapeuta não sabe quem é o próximo atendimento, nem quem é a pessoa; apenas espera.
- Se alguém atrasa ou cancela sem avisar, ele fica parado esperando.
- Toda informação da agenda depende da secretária.
Dores do colaborador mapeadas pela Semantix: falta de visibilidade, dificuldade na agenda, fila de espera, falta de feedback.
 
**Causa raiz:** toda a informação da agenda está concentrada em uma pessoa e circula por canais visuais. Não existe canal direto até o terapeuta. A ociosidade do terapeuta e a fila do colaborador são o mesmo problema visto dos dois lados.
 
## Princípios que orientam as decisões
 
- **Modelo social da deficiência (Débora Diniz):** a barreira está no processo, não na pessoa. O sistema corrige o fluxo de informação; não "assiste" o terapeuta.
- **Paridade de informação:** o terapeuta sabe o mesmo que a secretária, no mesmo momento.
- **Terapeuta protagonista:** ele consulta e age sobre a própria agenda.
- **Resolver para um, estender para muitos (Kat Holmes):** projeta-se para o terapeuta cego; o resultado serve a todos.
- **Nada sobre nós sem nós:** decisões de interação são validadas com os terapeutas.
**Métrica principal:** o terapeuta consegue passar um dia inteiro de trabalho sem pedir informação a ninguém.
 
## Atores
 
| Ator | Como acessa | O que faz |
| --- | --- | --- |
| Terapeuta | Aplicação web (PWA) com leitor de tela, no celular próprio (opcional) ou em computador; Alexa na sala | Consulta a agenda, recebe avisos, marca ausência, bloqueia horários, cancela, inicia e finaliza sessões (pela web ou por voz) |
| Colaborador | Aplicação web (login Google no roadmap; no protótipo, identificação simplificada); e-mail | Agenda, entra na fila, confirma, cancela, faz check-in, avalia |
| RH | Painel web | Cadastros, exceções, parâmetros das regras, códigos de pareamento das Alexas, indicadores e auditoria. No sistema não há perfil de secretária (decidido em 2026-10-16). |
| Suporte (`ADMIN`) | Painel web | Quem presta suporte à aplicação; acesso a tudo o que o RH faz (decidido em 2026-10-19) |
| Sistema | Jobs agendados | Lembretes, prazos, tolerância, fila |
 
## Decisões tomadas
 
- **Um backend é a fonte da verdade.** Toda regra vive no NestJS. Serviços externos são canais ou espelhos, nunca guardam regra.
- **Sem bots de mensagem por enquanto.** Telegram e WhatsApp foram descartados nesta versão.
- **Sem hardware novo.** A empresa não fornece celular. O terapeuta usa o celular próprio se quiser; a alternativa é um computador reaproveitado na sala.
- **Interface web do terapeuta:** tela dedicada, com regiões fixas (Agora, Próximo, Agenda de hoje, Ações), agenda em lista e não em grade, `aria-live` para mudanças, foco gerenciado. (Frontend fora deste repositório, mas a API deve servir esse formato.)
- **Avisos em tempo real ao terapeuta:** Web Push da PWA (fase posterior). Até lá, os avisos passam pelo `CanalNotificacao`.
- **Alexa é canal de consulta e de ação** (decidido em 2026-10-16, substitui "Alexa não é canal de ação"): consulta (próximo, agenda de hoje, quem chegou), lembrete falado antes da sessão e ações do terapeuta (cancelar, bloquear horário, iniciar e finalizar sessão). Comandos nunca exigem dizer identificadores, e ações que alteram dados pedem confirmação por voz.
- **Projeto é um protótipo; login Google vai para o roadmap** (decidido em 2026-10-16). No protótipo, o usuário é identificado pelo cabeçalho `x-user-id`.
- **Seleção de usuário de demonstração (D-12)** (decidido em 2026-10-20): no protótipo, o frontend mostra a tela "Entrar como…", alimentada por `GET /auth/demo-users` (usuários ativos, agrupados por papel e em ordem alfabética, sem e-mail). O ID escolhido vai no `x-user-id` de toda requisição; o backend não guarda sessão. A rota só existe com `AUTH_MODE=header`.
- **Check-in pelo colaborador** escaneando um QR code na porta da sala. Substitui a "palavra-chave" do fluxo original: quem se identifica é quem enxerga, e o terapeuta só recebe o resultado.
- **Lembrete ao colaborador por e-mail** com links de confirmar e cancelar (fase posterior). No protótipo não há envio: o colaborador vê um card de lembrete ao entrar na página (decidido em 2026-10-19).
- **Agenda diária, sem recorrência** (decidido em 2026-10-19): cada terapeuta tem a sua agenda, montada dia a dia pelo RH.
- **Parâmetros das regras editáveis pelo RH** (decidido em 2026-10-19): ficam no banco, e o ambiente só fornece os valores iniciais.
## Máquina de estados da sessão
 
| Status | Significado | Transições possíveis |
| --- | --- | --- |
| `reservada` | Criada, aguardando confirmação | `confirmada`, `cancelada`, `liberada` |
| `confirmada` | Colaborador confirmou presença. No protótipo, estado inicial da reserva (decidido em 2026-10-19) | `chegou`, `em_andamento` (terapeuta inicia sem check-in), `possivel_ausencia`, `cancelada` |
| `chegou` | Check-in feito pelo QR Code | `em_andamento` |
| `possivel_ausencia` | Passou a tolerância sem check-in | `em_andamento`, `ausente` |
| `em_andamento` | Terapeuta iniciou a sessão | `concluida` |
| `concluida` | Terapeuta finalizou a sessão | final |
| `cancelada` | Cancelada pelo colaborador, pelo terapeuta ou pelo RH | final |
| `liberada` | Expirou sem confirmação | final |
| `ausente` | Ausência confirmada pelo terapeuta | final |
 
Transições fora desta tabela são erro e devem ser rejeitadas. Toda transição gera um `EventoAuditoria`.
 
## Regras de negócio
 
Os valores ficam em `config/regras.config.ts`. Os que estão em aberto não devem ser inventados.

> **Atenção:** os IDs desta tabela são de uma versão anterior e **não coincidem** com os de `docs/requisitos.md`, que são os oficiais. Lá estão também os valores que o código usa hoje, todos aguardando validação.
 
| ID | Regra | Parâmetro | Valor |
| --- | --- | --- | --- |
| RN-01 | A grade é definida por terapeuta, dia da semana e sala | Duração da sessão (min) | [PREENCHER] |
| RN-02 | Limite de reservas ativas por colaborador | Máximo de reservas futuras | [PREENCHER] |
| RN-03 | Lembrete antes da sessão; sem confirmação no prazo, a vaga é liberada | Antecedência do lembrete; prazo de confirmação (min) | [PREENCHER] |
| RN-04 | Cancelamento permitido até um limite antes da sessão | Antecedência mínima (min) | [PREENCHER] |
| RN-05 | Vaga liberada é oferecida à fila por ordem de entrada | Prazo para aceitar a vaga (min) | [PREENCHER] |
| RN-06 | Check-in exige usuário autenticado, reserva naquela sala e horário dentro da janela | Antecedência máxima do check-in (min) | [PREENCHER] |
| RN-07 | Sem check-in até a tolerância, o terapeuta é avisado e pode marcar ausência | Tolerância de atraso (min) | [VALIDAR] |
| RN-08 | Todo evento que altera a agenda do terapeuta gera aviso imediato | — | — |
| RN-09 | Lembrete da Alexa criado antes de cada sessão confirmada; atualizado ou apagado se a sessão mudar | Antecedência do anúncio (min) | 5 [VALIDAR] |
| RN-10 | Anonimato do feedback | — | [VALIDAR] |
 
## Modelo de dados (ponto de partida)
 
| Entidade | Campos principais | Observações |
| --- | --- | --- |
| Terapeuta | id, nome, ativo | Sem dado de saúde do terapeuta |
| Colaborador | id, nome, primeiro_nome, email_google | Vem do login Google |
| Sala | id, nome, codigo_qr | `codigo_qr` aleatório e regenerável |
| Grade (agenda diária) | id, terapeuta_id, sala_id, inicio, fim (com data) | Base para gerar horários; sem recorrência |
| Sessao | id, terapeuta_id, colaborador_id, sala_id, inicio, fim, status, lembrete_alexa_id | `lembrete_alexa_id` permite atualizar ou apagar o lembrete |
| Fila | id, colaborador_id, entrou_em, status | Ordem por `entrou_em` |
| DispositivoAlexa | id, device_id, terapeuta_id, pareado_em | Pareado por código gerado no painel do RH |
| InscricaoPush | id, terapeuta_id, endpoint, chaves | Fase posterior; uma por aparelho |
| Feedback | id, sessao_id, nota, comentario | Fase posterior |
| EventoAuditoria | id, sessao_id, ator, acao, antes, depois, ocorrido_em | Imutável |
 
Uma sessão não pode se sobrepor a outra do mesmo terapeuta nem da mesma sala.
 
## Integração com a Alexa
 
**Como funciona.** A skill customizada é uma interface HTTP com JSON. A Alexa faz o reconhecimento de voz, identifica a intenção e faz um `POST` para o endpoint do backend; o backend responde com o texto a ser falado. O modelo de interação (intents e frases de exemplo em `pt-BR`) fica versionado no repositório e é publicado pela ASK CLI.
 
Exemplo de requisição (simplificado):
 
```json
{ "context": { "System": { "device": { "deviceId": "amzn1.ask.device.XXX" } } },
  "request": { "type": "IntentRequest", "timestamp": "2026-10-14T15:00:00Z",
               "intent": { "name": "ProximoAtendimentoIntent" } } }
```
 
Exemplo de resposta:
 
```json
{ "version": "1.0",
  "response": { "outputSpeech": { "type": "PlainText", "text": "Próximo: Ana, às 14h." },
                "shouldEndSession": true } }
```
 
**Intents previstos**
 
| Intent | Exemplo de frase | Resposta (sugestão) |
| --- | --- | --- |
| `ProximoAtendimentoIntent` | "quem é o próximo" | "Próximo: {primeiro_nome}, às {hora}." |
| `AgendaHojeIntent` | "qual minha agenda de hoje" | "Hoje, {n} atendimentos. Primeiro: {primeiro_nome}, às {hora}." |
| `QuemChegouIntent` | "quem chegou" | "{primeiro_nome} chegou às {hora}." ou "Ninguém chegou ainda." |
| `AMAZON.HelpIntent` | "ajuda" | Lista curta do que perguntar |
| `AMAZON.StopIntent` / `CancelIntent` | "parar" | Encerra |
 
**Obrigatório: verificação da requisição.** Toda chamada traz cabeçalhos de assinatura e URL do certificado. O guard precisa validar a assinatura, o certificado e o `timestamp` (rejeitar requisições antigas). Sem isso, qualquer pessoa pode se passar pela Alexa e a skill é reprovada na certificação. Usar os verificadores do `ask-sdk-express-adapter` dentro de um guard do NestJS.
 
**Tempo de resposta.** A Alexa tem limite curto de espera. O servidor precisa estar sempre ligado e as consultas devem ser rápidas (sem chamadas externas no caminho da resposta).
 
**Pareamento** (decidido em 2026-10-16). O RH gera um código no painel para um terapeuta. Na primeira vez, o terapeuta diz "vincular código {código}" e o backend associa o `deviceId` a esse terapeuta. Todas as consultas e ações feitas por aquele aparelho valem para a agenda dele. Não usar account linking OAuth no MVP. O código atual, que usa um mapa fixo em `ALEXA_USER_MAP`, será substituído.
 
**Lembretes falados (Reminders API).** Objetivo: a Alexa falar sozinha "Sua próxima sessão começa em 5 minutos" antes de cada sessão confirmada. Pontos em aberto:
- Exige permissão de lembretes concedida no app da Alexa.
- A criação pelo backend, fora de uma conversa, provavelmente exige obter um token pela Skill Messaging API. **Viabilidade não confirmada: validar com um teste isolado antes de integrar.**
- Cancelamento ou remarcação da sessão precisa apagar ou atualizar o lembrete (`lembrete_alexa_id`). Um lembrete órfão é pior do que nenhum.
- Se o lembrete deve falar o nome do colaborador está em aberto (privacidade: outra pessoa pode estar na sala). Default: sem nome.
**O que a Alexa não faz.** Não existe forma oficial de fazer a Alexa falar um texto livre na hora (ex.: "Ana chegou"). O aviso de chegada em tempo real vai pelo push da PWA. A campainha virtual (anúncio genérico de chegada, via skill Smart Home + Event Gateway + AWS Lambda) é fase futura.
 
## Privacidade e LGPD
 
- Toda fala da Alexa e todo aviso usam só o primeiro nome.
- Queixa ou região de dor do colaborador é dado de saúde (sensível): fora do escopo atual. Se entrar, exige consentimento explícito, tabela separada e criptografia, e nunca aparece em logs, calendário ou voz.
- Logs só com IDs.
## Fora do escopo atual
 
Bots de mensagem (Telegram, WhatsApp, Google Chat), SMS, aplicativo nativo, hardware dedicado (pedal, teclado, botões), campainha virtual da Alexa, Google Calendar, Alexa+.
 
## Questões em aberto que afetam o backend
 
| Questão | Afeta |
| --- | --- |
| ~~TypeORM ou Prisma?~~ Decidido: Prisma | Fase 1 |
| Valores das regras RN-01 a RN-07 | Fases 3 e 4 |
| A Reminders API funciona criada pelo backend? | RF-16 (ID de `docs/requisitos.md`) |
| A Semantix usa Google Workspace ou Microsoft 365? | Login |
| Existe exigência de nuvem corporativa? | Hospedagem |
| Lembrete da Alexa com ou sem nome? | RN-09 |