import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { RadioGroup, Radio } from "react-aria-components";
import { Monitor, Sun, Moon, Contrast } from "lucide-react";

const THEMES = [
  ["auto", "Automático (segue o sistema)", Monitor],
  ["light", "Claro", Sun],
  ["dark", "Escuro", Moon],
  ["contrast", "Alto contraste", Contrast],
];

// Único seletor de tema do site: muda a página inteira (hero e agenda) via data-theme no <html>.
// RadioGroup do React Aria: setas do teclado trocam o tema, leitor de tela anuncia "Tema, Escuro, 3 de 4".
export default function ThemeSwitch() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("theme") || "auto"; } catch { return "auto"; } });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") delete root.dataset.theme; else root.dataset.theme = theme;
    try { localStorage.setItem("theme", theme === "auto" ? "" : theme); } catch { /* sem storage, segue sem lembrar */ }
  }, [theme]);

  return (
    <RadioGroup className="theme" aria-label="Tema" orientation="horizontal" value={theme} onChange={setTheme}>
      {THEMES.map(([v, label, Icon]) => (
        <Radio key={v} value={v} aria-label={label} className="theme-opt">
          {({ isSelected }) => (
            <span className="theme-body" title={label}>
              {isSelected && <motion.span layoutId="pill-theme" className="pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <Icon aria-hidden="true" />
            </span>
          )}
        </Radio>
      ))}
    </RadioGroup>
  );
}
