# Issue tracker: Markdown local

Specs e tickets vivem como arquivos markdown em `backend/docs/`, seguindo o fluxo spec → tickets → implement do `docs/roadmap.md` (decisão D-11). Caminhos relativos a `backend/`.

## Convenções

- Uma spec por épico: `docs/specs/EP-NN-<nome>.md` (conteúdo definido em `docs/roadmap.md`, seção "Como usar").
- Um arquivo por ticket: `docs/tickets/EP-NN/TK-NN.MM-<slug>.md`, nunca um arquivo com vários tickets. O ID vem da tabela do épico no `docs/roadmap.md`; não invente IDs: ticket novo entra primeiro no roadmap.
- Cabeçalho de cada ticket:

  ```
  Status: ⬜
  Épico: EP-NN · Spec: docs/specs/EP-NN-<nome>.md
  Depende de: TK-NN.MM, TK-NN.MM
  Tamanho: P | M | G
  Requisitos: RF-NN, RN-NN
  ```

- `Status:` usa a legenda do roadmap: ✅ feito · 🟡 legado a refatorar · ⬜ a fazer · 🔒 bloqueado por decisão. Ao mudar o status no ticket, mude também na tabela do `docs/roadmap.md`, no mesmo PR.
- Comentários e histórico vão no fim do arquivo, sob `## Comentários`.

## Quando uma skill disser "publish to the issue tracker"

Spec: crie `docs/specs/EP-NN-<nome>.md`. Ticket: crie `docs/tickets/EP-NN/TK-NN.MM-<slug>.md` (crie a pasta se preciso).

## Quando uma skill disser "fetch the relevant ticket"

Leia `docs/tickets/EP-NN/TK-NN.MM-*.md`; o usuário normalmente passa o ID ou o caminho. Se o arquivo ainda não existir, use a linha do ticket na tabela do épico em `docs/roadmap.md` e a spec do épico.
