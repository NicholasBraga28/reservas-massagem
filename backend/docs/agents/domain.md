# Domain docs

Layout single-context, dentro de `backend/`. Caminhos relativos a `backend/`.

## Antes de explorar, leia

- `CONTEXT.md`: domínio, decisões, regras de negócio, Alexa.
- `docs/requisitos.md`: o contrato (RF, RN, RNF). Se divergir do `CONTEXT.md` ou do `CLAUDE.md`, o `requisitos.md` vence; aponte a divergência em vez de escolher.
- `docs/adr/`: ADRs que tocam a área em que vai trabalhar.

Se algum não existir, siga em silêncio: não aponte a ausência nem sugira criar. A skill `/domain-modeling` cria esses arquivos quando um termo ou decisão é de fato resolvido.

## Estrutura

```
backend/
├── CLAUDE.md          ← como trabalhar + glossário PT→EN
├── CONTEXT.md
├── docs/
│   ├── requisitos.md
│   ├── roadmap.md
│   └── adr/
│       └── 0001-<decisao>.md
└── src/
```

## Use o vocabulário do glossário

Docs em português, código em inglês. O glossário PT→EN fica em `CLAUDE.md` ("Glossário de domínio"). Ao nomear um conceito (título de ticket, proposta de refatoração, nome de teste), use o termo do glossário (`Appointment`, não `Booking`). Conceito fora do glossário é sinal: ou é linguagem inventada (reconsidere) ou é uma lacuna real (anote para `/domain-modeling`).

## Sinalize conflitos com ADRs

Se a saída contradiz um ADR, diga explicitamente em vez de sobrescrever:

> _Contradiz o ADR-0007 (…), mas vale reabrir porque…_
