import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Monitor, Sun, Moon, Contrast } from "lucide-react";

const THEMES = [
  ["", "Automático (segue o sistema)", Monitor],
  ["light", "Claro", Sun],
  ["dark", "Escuro", Moon],
  ["contrast", "Alto contraste", Contrast],
];

// Único seletor de tema do site: muda a página inteira (hero e agenda) via data-theme no <html>.
export default function ThemeSwitch() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("theme") || ""; } catch { return ""; } });
  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.dataset.theme = theme; else delete root.dataset.theme;
    try { localStorage.setItem("theme", theme); } catch { /* sem storage, segue sem lembrar */ }
  }, [theme]);

  return (
    <div className="theme" role="radiogroup" aria-label="Tema">
      {THEMES.map(([v, label, Icon]) => (
        <label key={v} title={label}>
          <input type="radio" name="theme" checked={theme === v} onChange={() => setTheme(v)} aria-label={label} />
          <span className="theme-body">
            {theme === v && <motion.span layoutId="pill-theme" className="pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <Icon aria-hidden="true" />
          </span>
        </label>
      ))}
    </div>
  );
}
