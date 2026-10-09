import { useCallback, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig, useScroll, useTransform, useReducedMotion } from "motion/react";
import { RadioGroup, Radio, Button, Form, TextField, Label, Input, FieldError, I18nProvider } from "react-aria-components";
import { ArrowDown } from "lucide-react";
import Hero, { Navbar } from "./Hero.jsx";
import {
  SERVICE, DURATIONS, THERAPISTS, STEP, range, dayKey, hoursOf, slotCount,
  fmt, freeTherapist, starts, allBusy, nextDays,
} from "./agenda.js";

const DAYS = nextDays(21);
const EASE = [0.16, 1, 0.3, 1];
const SPRING = { type: "spring", stiffness: 500, damping: 38 };
const FADE = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.25, ease: EASE } };
// Título da agenda: cada palavra sobe de dentro de uma máscara.
const TITLE = [["Escolha"], ["o"], ["seu"], ["momento", true]];
const WORDS = { show: { transition: { staggerChildren: 0.09 } } };
const WORD = { hidden: { y: "110%" }, show: { y: 0, transition: { duration: 0.9, ease: EASE } } };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameOf = id => THERAPISTS.find(t => t.id === id).name;
const date = (d, opts) => d.toLocaleDateString("pt-BR", opts);

function relDay(d) {
  const t = new Date(), tm = new Date(); tm.setDate(t.getDate() + 1);
  if (dayKey(d) === dayKey(t)) return "hoje";
  if (dayKey(d) === dayKey(tm)) return "amanhã";
  return date(d, { weekday: "long", day: "numeric" });
}

export default function App() {
  const [dur, setDur] = useState(60);
  const [ther, setTher] = useState("any");
  const [pickedDay, setPickedDay] = useState(null);
  const [pickedStart, setPickedStart] = useState(null);
  const [done, setDone] = useState(null);

  // Entrada da agenda ligada à rolagem: o conteúdo sobe, endireita e cresce enquanto entra na tela.
  const stageRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress: enter } = useScroll({ target: stageRef, offset: ["start end", "start 0.25"] });
  const cardY = useTransform(enter, [0, 1], [160, 0]);
  const cardScale = useTransform(enter, [0, 1], [0.9, 1]);
  const cardTilt = useTransform(enter, [0, 1], [12, 0]);
  const cardOpacity = useTransform(enter, [0, 0.55], [0, 1]);

  const n = dur / STEP;
  const counts = useMemo(() => DAYS.map(d => starts(d, n, ther).length), [n, ther]);
  // Dia escolhido some se ficar lotado com a nova combinação; cai no primeiro dia livre.
  const day = (pickedDay && counts[DAYS.indexOf(pickedDay)]) ? pickedDay
    : DAYS[counts.findIndex(Boolean)] ?? DAYS.find(hoursOf);
  const free = useMemo(() => starts(day, n, ther), [day, n, ther]);
  const start = free.includes(pickedStart) ? pickedStart : null;

  // Próxima sessão padrão (60 min, qualquer terapeuta) para o CTA do hero.
  const next = useMemo(() => {
    for (const d of DAYS) {
      const s = starts(d, 60 / STEP, "any");
      if (s.length) return { day: d, start: s[0], label: `${relDay(d)}, ${fmt(hoursOf(d), s[0])}` };
    }
    return null;
  }, []);

  const reserveFromHero = useCallback(nx => {
    if (nx) {
      setDur(60); setTher("any");
      setPickedDay(nx.day); setPickedStart(nx.start); setDone(null);
    }
    document.getElementById("agenda")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  function chooseDay(key) { setPickedDay(DAYS.find(d => dayKey(d) === key)); setPickedStart(null); }
  function goToForm() {
    const f = document.getElementById("f-name");
    f?.scrollIntoView({ behavior: "smooth", block: "center" });
    f?.focus({ preventScroll: true });
  }

  function confirm({ name, email }) {
    const h = hoursOf(day);
    // ponytail: sem backend, a reserva só existe nesta tela; POST /reservas entra aqui
    setDone({
      code: Math.random().toString(36).slice(2, 7).toUpperCase(),
      name, email,
      when: `${date(day, { weekday: "long", day: "numeric", month: "long" })} às ${fmt(h, start)}`,
      what: `${SERVICE} · ${dur} min`,
      ther: nameOf(freeTherapist(day, start, n, ther)),
    });
  }

  return (
    <I18nProvider locale="pt-BR">
    <MotionConfig reducedMotion="user">
      <Navbar />
      <Hero next={next} onReserve={reserveFromHero} />

      <main id="agenda" className="agenda">
        <motion.div className="agenda-head"
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: EASE }}>
          <span className="badge">Agenda aberta para as próximas 3 semanas</span>
          <motion.h2 className="display" variants={WORDS} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.6 }}>
            {TITLE.map(([w, italic]) => (
              <span key={w} className="word"><motion.span variants={WORD}>{italic ? <em>{w}</em> : w}</motion.span></span>
            ))}
          </motion.h2>
          <p className="lede">{SERVICE}. Escolha a duração, o terapeuta e um horário livre. A confirmação chega por e-mail e WhatsApp.</p>
        </motion.div>

        <div className="stage" ref={stageRef}>
          <motion.div className="booking"
            style={reduceMotion ? undefined : { y: cardY, scale: cardScale, rotateX: cardTilt, opacity: cardOpacity, transformPerspective: 1400, transformOrigin: "50% 0%" }}>
            <div className="flow">
              <div className="options">
                <Step n="01" title="Duração" id="duracao">
                  <RadioGroup className="chips" aria-labelledby="duracao-t" orientation="horizontal"
                    value={String(dur)} onChange={v => setDur(Number(v))}>
                    {DURATIONS.map(v => <Chip key={v} group="dur" value={String(v)}>{v} min</Chip>)}
                  </RadioGroup>
                </Step>
                <Step n="02" title="Terapeuta" id="terapeutas">
                  <RadioGroup className="chips" aria-labelledby="terapeutas-t" orientation="horizontal"
                    value={ther} onChange={setTher}>
                    {THERAPISTS.map(t => <Chip key={t.id} group="ther" value={t.id}>{t.name}</Chip>)}
                  </RadioGroup>
                </Step>
              </div>

              <Step n="03" title="Dia" id="horarios" aside={date(day, { month: "long", year: "numeric" })}>
                <DayStrip day={day} counts={counts} onPick={chooseDay} />
              </Step>

              <Step n="04" title="Horário" id="horario" aside={`${date(day, { weekday: "long", day: "numeric" })} · ${hoursOf(day)[0]}h às ${hoursOf(day)[1]}h`}>
                <div className="bar-wrap">
                  <DayBar day={day} n={n} ther={ther} start={start} onPick={setPickedStart} />
                  <div className="legend" aria-hidden="true">
                    <span><i className="l-busy" />Ocupado</span><span><i className="l-sel" />Sua sessão</span>
                  </div>
                </div>
                <Slots key={`${dayKey(day)}-${n}-${ther}`} day={day} free={free} start={start} onPick={setPickedStart} />
                <AnimatePresence>
                  {start != null && !done && (
                    <motion.div key="to-form" className="to-form" {...FADE}>
                      <Button className="ghost-btn" onPress={goToForm}>
                        Seguir para seus dados <ArrowDown className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Step>
            </div>

            <aside className="summary" id="dados" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                {done
                  ? <motion.div key="done" {...FADE}>
                      <Done booking={done} onAgain={() => { setDone(null); setPickedStart(null); }} />
                    </motion.div>
                  : <motion.div key="form" {...FADE}>
                      <Summary dur={dur} day={day} start={start}
                        therapist={start != null ? freeTherapist(day, start, n, ther) : ther === "any" ? null : ther}
                        onConfirm={confirm} />
                    </motion.div>}
              </AnimatePresence>
            </aside>
          </motion.div>
        </div>
      </main>
    </MotionConfig>
    </I18nProvider>
  );
}

// Etapa numerada do fluxo de reserva.
function Step({ n, title, id, aside, children }) {
  return (
    <section className="step" id={id} aria-labelledby={`${id}-t`}>
      <header className="step-head">
        <span className="step-n" aria-hidden="true">{n}</span>
        <h3 id={`${id}-t`}>{title}</h3>
        {aside && <span className="step-aside">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

// Troca de texto com um leve fade quando o valor muda.
function Swap({ k, children }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={k} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

// Opção em pílula (Radio do React Aria); o fundo da escolhida desliza entre as opções (layoutId).
function Chip({ group, value, children }) {
  return (
    <Radio value={value} className="chip">
      {({ isSelected }) => (
        <span className="chip-body">
          {isSelected && <motion.span layoutId={`pill-${group}`} className="pill" transition={SPRING} />}
          <span className="txt">{children}</span>
        </span>
      )}
    </Radio>
  );
}

function DayStrip({ day, counts, onPick }) {
  return (
    <RadioGroup className="days" aria-labelledby="horarios-t" orientation="horizontal" value={dayKey(day)} onChange={onPick}>
      {DAYS.map((d, k) => {
        const c = counts[k];
        return (
          <Radio key={k} value={dayKey(d)} isDisabled={!c} className="day"
            aria-label={`${date(d, { weekday: "long", day: "numeric", month: "long" })}, ${c ? `${c} horários livres` : "sem horários"}`}>
            {({ isSelected }) => (
              <>
                <span className="wd">{date(d, { weekday: "short" }).replace(".", "")}</span>
                <span className="dn">
                  {isSelected && <motion.span layoutId="pill-day" className="pill" transition={SPRING} />}
                  <span className="txt">{d.getDate()}</span>
                </span>
                <span className="av">{!hoursOf(d) ? "fechado" : c ? `${c} livres` : "lotado"}</span>
              </>
            )}
          </Radio>
        );
      })}
    </RadioGroup>
  );
}

// Barra do dia: passar o mouse mostra a sessão "fantasma", clicar escolhe. Os horários (Slots) são o caminho acessível.
function DayBar({ day, n, ther, start, onPick }) {
  const [hover, setHover] = useState(null);
  const h = hoursOf(day), N = slotCount(h), span = h[1] - h[0];
  const pct = i => `${(i / N) * 100}%`;
  const now = new Date();
  const past = dayKey(day) === dayKey(now)
    ? Math.max(0, Math.min(N, ((now.getHours() - h[0]) * 60 + now.getMinutes()) / STEP)) : 0;
  const idxAt = e => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(N - n, Math.floor(((e.clientX - r.left) / r.width) * N)));
  };
  const ok = i => freeTherapist(day, i, n, ther);

  return (
    <>
      <div className="bar" aria-hidden="true"
        onMouseMove={e => { const i = idxAt(e); setHover(ok(i) ? i : null); }}
        onMouseLeave={() => setHover(null)}
        onClick={e => { const i = idxAt(e); if (ok(i)) onPick(i); }}>
        {range(span - 1).map(k => <div key={`h${k}`} className="hr" style={{ left: pct(((k + 1) * 60) / STEP) }} />)}
        <div key={`${dayKey(day)}-${ther}`} className="bar-layer">
          {range(N).filter(i => allBusy(day, i, ther)).map(i =>
            <div key={i} className="busy" style={{ left: pct(i), width: pct(1) }} />)}
          {past > 0 && <div className="past" style={{ width: pct(past) }} />}
        </div>
        {hover != null && hover !== start && <div className="ghost" style={{ left: pct(hover), width: pct(n) }} />}
        <AnimatePresence>
          {start != null && (
            <motion.div key="sel" className="sel"
              initial={{ opacity: 0, scaleY: 0.6 }} animate={{ opacity: 1, scaleY: 1, left: pct(start), width: pct(n) }}
              exit={{ opacity: 0, scaleY: 0.6 }} transition={SPRING}
              style={{ left: pct(start), width: pct(n) }}>
              {fmt(h, start)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="axis" aria-hidden="true">
        {range(span + 1).filter(k => k % 2 === 0 || k === span).map(k =>
          <span key={k} style={{ left: pct((k * 60) / STEP) }}>{h[0] + k}h</span>)}
      </div>
    </>
  );
}

const LIST = { hidden: {}, show: { transition: { staggerChildren: 0.015 } } };
const ITEM = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } } };

// Horários do dia: um único grupo de rádio (setas do teclado navegam entre todos), separado em manhã/tarde/noite.
function Slots({ day, free, start, onPick }) {
  const h = hoursOf(day), min = i => h[0] * 60 + i * STEP;
  const groups = [
    ["Manhã", i => min(i) < 720],
    ["Tarde", i => min(i) >= 720 && min(i) < 1020],
    ["Noite", i => min(i) >= 1020],
  ];
  return (
    <RadioGroup aria-labelledby="horario-t" value={start == null ? null : String(start)} onChange={v => onPick(Number(v))}>
      <motion.div className="periods" variants={LIST} initial="hidden" animate="show">
        {groups.map(([name, f]) => {
          const g = free.filter(f);
          if (!g.length && name === "Noite") return null;
          return (
            <div className="period" key={name}>
              <h4 aria-hidden="true">{name}</h4>
              {g.length
                ? <div className="slots">{g.map(i => (
                    <motion.div key={i} variants={ITEM}>
                      <Radio value={String(i)} className="slot" aria-label={`${name}, ${fmt(h, i)}`}>
                        {({ isSelected }) => (
                          <>
                            {isSelected && <motion.span layoutId="pill-slot" className="pill" transition={SPRING} />}
                            <span className="txt">{fmt(h, i)}</span>
                          </>
                        )}
                      </Radio>
                    </motion.div>
                  ))}</div>
                : <motion.p variants={ITEM} className="none">Nenhum horário livre.</motion.p>}
            </div>
          );
        })}
      </motion.div>
    </RadioGroup>
  );
}

// Formulário com validação do React Aria: cada campo mostra o próprio erro e o primeiro inválido recebe o foco.
function Summary({ dur, day, start, therapist, onConfirm }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const dayTxt = date(day, { weekday: "long", day: "numeric", month: "short" });

  function submit(e) {
    e.preventDefault();
    onConfirm({ name: name.trim(), email: email.trim(), phone });
  }

  return (
    <div className="sum">
      <header className="step-head">
        <span className="step-n" aria-hidden="true">05</span>
        <h3>Seus dados</h3>
      </header>
      <div className="recap">
        <p className="sum-line">
          {SERVICE}, {dur} min<br />
          <Swap k={start == null ? "none" : `${dayKey(day)}-${start}`}>
            {start != null
              ? <span>{dayTxt}, {fmt(hoursOf(day), start)}</span>
              : <span className="dim">escolha um horário</span>}
          </Swap>
        </p>
        <p className="sum-meta">{therapist ? `com ${nameOf(therapist)}` : "terapeuta disponível no horário"}</p>
      </div>
      <Form className="form" onSubmit={submit}>
        <TextField className="field" id="f-name" name="name" isRequired autoComplete="name" value={name} onChange={setName}
          validate={v => (v.trim() ? null : "Informe seu nome.")}>
          <Label>Nome</Label>
          <Input />
          <FieldError className="field-error" />
        </TextField>
        <TextField className="field" name="email" type="email" isRequired autoComplete="email" value={email} onChange={setEmail}
          validate={v => (EMAIL.test(v.trim()) ? null : "Informe um e-mail válido, ex.: nome@empresa.com.br.")}>
          <Label>E-mail</Label>
          <Input inputMode="email" placeholder="nome@empresa.com.br" />
          <FieldError className="field-error" />
        </TextField>
        <TextField className="field" name="phone" type="tel" isRequired autoComplete="tel" value={phone} onChange={setPhone}
          validate={v => (v.replace(/\D/g, "").length >= 10 ? null : "Informe o WhatsApp com DDD, ex.: (11) 91234-5678.")}>
          <Label>WhatsApp</Label>
          <Input inputMode="tel" placeholder="(11) 90000-0000" />
          <FieldError className="field-error" />
        </TextField>
        <Button className="cta" type="submit" isDisabled={start == null}>
          {start == null ? "Escolha um horário para confirmar" : "Confirmar reserva"}
        </Button>
      </Form>
    </div>
  );
}

function Done({ booking, onAgain }) {
  return (
    <div className="done">
      <span className="badge">RESERVA {booking.code}</span>
      <p className="sum-line">Até {booking.when}, {booking.name.split(" ")[0]}.</p>
      <p className="sum-meta">{booking.what} · com {booking.ther}</p>
      <p className="hint">A confirmação vai para {booking.email}. Chegue 10 minutos antes.</p>
      <Button className="ghost-btn" onPress={onAgain}>Fazer outra reserva</Button>
    </div>
  );
}
