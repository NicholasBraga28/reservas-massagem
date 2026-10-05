import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import { Flower2, ArrowRight, Check, ChevronDown } from "lucide-react";
import LogoWire from "./LogoWire.jsx";
import ThemeSwitch from "./ThemeSwitch.jsx";
// Diamond.jsx (diamante 3D lapidado) está guardado para uso futuro; não aparece no hero no momento.

const EASE = [0.16, 1, 0.3, 1];
const LINKS = [["#terapeutas", "Terapeutas"], ["#horarios", "Horários"], ["#dados", "Seus dados"]];

// Barra fixa no topo do site inteiro, com contorno sólido que segue o tema.
export function Navbar() {
  return (
    <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="nav" aria-label="Principal">
      <div className="nav-in">
        <div className="flex items-center gap-8">
          <a href="#top" className="flex items-center gap-2 font-semibold text-lg">
            <Flower2 className="w-6 h-6" aria-hidden="true" />Pausa
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            {LINKS.map(([href, label]) => <a key={href} href={href} className="nav-link">{label}</a>)}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeSwitch />
          <a href="#agenda" className="nav-cta">Reservar</a>
        </div>
      </div>
    </motion.nav>
  );
}

function useTypewriter(text, speed = 60) {
  const [out, setOut] = useState("");
  useEffect(() => {
    setOut("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return out;
}

// CTA: o botão vira uma pílula que "digita" o próximo horário livre; a seta leva à agenda com ele já escolhido.
function NextSlotCta({ next, onReserve }) {
  const [mode, setMode] = useState("button"); // button | open | done
  const typed = useTypewriter(
    mode === "open" ? `Próximo horário livre: ${next?.label}` : mode === "done" ? "Horário separado, é só confirmar" : "",
  );

  useEffect(() => {
    if (mode !== "done") return;
    const go = setTimeout(() => onReserve(next), 700);
    const reset = setTimeout(() => setMode("button"), 4000);
    return () => { clearTimeout(go); clearTimeout(reset); };
  }, [mode, next, onReserve]);

  const pop = { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, transition: { duration: 0.2 } };
  return (
    <AnimatePresence mode="wait">
      {mode === "button" ? (
        <motion.button key="button" {...pop} onClick={() => (next ? setMode("open") : onReserve(null))} className="hero-btn">
          Reservar uma sessão
        </motion.button>
      ) : (
        <motion.form key="form" {...pop} onSubmit={e => { e.preventDefault(); if (mode === "open") setMode("done"); }} className="hero-pill">
          <span aria-live="polite" className="flex-1 min-w-0 text-left truncate">
            {typed}<span className="animate-pulse opacity-60">|</span>
          </span>
          <button type="submit" autoFocus aria-label="Reservar este horário" className="hero-go">
            {mode === "done" ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

export default function Hero({ next, onReserve }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const logoY = useTransform(scrollYProgress, [0, 1], [0, 90]);

  return (
    <header id="top" ref={ref} className="hero relative h-svh min-h-[620px] w-full flex flex-col overflow-hidden shrink-0">
      {/* logo 3D na metade de baixo: entra e sai por degradês, com pouca opacidade para não competir com o texto */}
      <motion.div style={{ y: logoY }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, delay: 0.4 }}
        className="hero-logo absolute inset-0 pointer-events-none">
        <LogoWire className="w-full h-full" />
      </motion.div>
      {/* véu atrás do texto, para leitura */}
      <div className="hero-shield absolute inset-0 pointer-events-none" />

      <motion.section style={{ y: contentY, opacity: contentOpacity }} className="relative flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-10">
        <div className="relative z-10 text-center max-w-5xl mx-auto flex flex-col items-center justify-center w-full gap-8">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="hero-tagline text-[10px] md:text-[11px] font-medium tracking-[0.2em] uppercase mb-4">
            Massoterapia · agenda online
          </motion.p>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE }}
            style={{ fontFamily: "'Instrument Serif', serif" }}
            className="hero-title text-4xl md:text-[64px] font-medium tracking-[-0.01em] leading-[1.1] mb-6 max-w-4xl">
            Uma <em>pausa</em> no seu dia, marcada <br className="hidden md:block" />em poucos segundos
          </motion.h1>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="min-h-[50px] mt-2 w-full flex justify-center">
            <NextSlotCta next={next} onReserve={onReserve} />
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
            <a href="#agenda" className="hero-link inline-flex flex-col items-center gap-2 text-[13px] font-medium tracking-wide">
              Ver todos os horários
              <motion.span animate={{ y: [0, 4, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                <ChevronDown className="w-4 h-4" />
              </motion.span>
            </a>
          </motion.div>
        </div>
      </motion.section>
    </header>
  );
}
