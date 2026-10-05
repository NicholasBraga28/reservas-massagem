# reservas-massagem

Aplicação de reservas de massagens para a empresa.

- `frontend/` — React + Vite + Tailwind v4 + Motion. Hero em tela cheia com a logo em 3D ao fundo (traço com linhas internas animadas, three.js), barra fixa com contorno sólido e CTA que digita o próximo horário livre. Um único seletor de tema (Auto / Claro / Escuro / Alto contraste) na barra muda o site inteiro. Transição em degradê do hero para a agenda; a agenda entra acompanhando a rolagem. Agenda com visual baseado na referência Calendly (Refero) com paleta roxa #5A179A / #A07BF6 / #CBBAFF / #DED6FF / #FFFFFF. Agenda e reservas ainda simuladas no navegador.
  - `src/Hero.jsx` — hero: navbar, título, CTA animado
  - `src/Diamond.jsx` — diamante lapidado em WebGL (GUARDADO: fora do hero, pronto para reusar)
  - `src/ThemeSwitch.jsx` — seletor de tema único (fica na barra)
  - `src/LogoWire.jsx` — logo da Pausa em 3D (contorno + linhas internas que deslizam), atrás do texto do hero
  - `src/three-canvas.js` — base comum das cenas 3D (three carregado sob demanda, pausa fora da tela, reduzir movimento)
  - `src/App.jsx` — agenda e componentes do agendamento (animações com Motion)
  - `src/index.css` — Tailwind e fontes
  - `src/agenda.js` — serviço, durações, terapeutas, horários e regras de disponibilidade (vira API no backend)
  - `src/agenda.check.js` — checagem das regras (`npm run check`)
  - `src/styles.css` — tokens de cor/tipo de todos os temas e estilos da barra, do hero e da agenda (camada `components` do Tailwind)
- Backend: a definir.

Rodar: `cd frontend && npm install && npm run dev` → http://localhost:5173

## _paralelos
_(nenhum ainda)_
