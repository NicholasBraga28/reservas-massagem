import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { RadioGroup, Radio, Button, Form, TextField, Label, Input, FieldError, I18nProvider } from "react-aria-components";
import { ArrowDown } from "lucide-react";
import Hero, { Navbar } from "./Hero.jsx";
import {
  SERVICE, SESSION_MIN, STEP, BOOKING_DAYS, range, dayKey, hoursOf, slotCount,
  fmt, startsOn, pickSlot, nextDays,
} from "./agenda.js";
import { getEmployees, getAvailability, reserve } from "./api.js";

const DAYS = nextDays(BOOKING_DAYS);
const EASE = [0.16, 1, 0.3, 1];
const SPRING = { type: "spring", stiffness: 500, damping: 38 };
const FADE = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.25, ease: EASE } };
// Título da agenda: cada palavra sobe de dentro de uma máscara.
const TITLE = [["Escolha"], ["o"], ["seu"], ["momento", true]];
const WORDS = { show: { transition: { staggerChildren: 0.09 } } };
const WORD = { hidden: { y: "110%" }, show: { y: 0, transition: { duration: 0.9, ease: EASE } } };
// Esmaecer ao rolar: cada bloco aparece (e sobe um pouco) quando entra na tela, uma vez só.
const REVEAL = { initial: { opacity: 0, y: 32 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.2 } };
const revealIn = (delay = 0) => ({ ...REVEAL, transition: { duration: 0.9, ease: EASE, delay } });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const date = (d, opts) => d.toLocaleDateString("pt-BR", opts);

function relDay(d) {
  const t = new Date(), tm = new Date(); tm.setDate(t.getDate() + 1);
  if (dayKey(d) === dayKey(t)) return "hoje";
  if (dayKey(d) === dayKey(tm)) return "amanhã";
  return date(d, { weekday: "long", day: "numeric" });
}

export default function App() {
  const [ther, setTher] = useState("any");
  const [pickedDay, setPickedDay] = useState(null);
  const [pickedStart, setPickedStart] = useState(null);
  const [done, setDone] = useState(null);
  // Dados do backend: colaboradores (quem reserva) e horários livres dos próximos dias.
  const [employees, setEmployees] = useState([]);
  const [userId, setUserId] = useState(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getEmployees();
        if (!list.length) throw new Error("Nenhum colaborador ativo no backend. Rode o seed de demonstração (npm run db:seed-demo).");
        const from = new Date(), to = new Date(from.getTime() + BOOKING_DAYS * 86_400_000);
        const availability = await getAvailability(list[0].id, from, to, SESSION_MIN);
        if (cancelled) return;
        setEmployees(list); setData(availability); setLoadError(null);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const slots = useMemo(() => data?.slots ?? [], [data]);
  const actor = userId ?? employees[0]?.id;
  const n = SESSION_MIN / STEP; // slots ocupados por uma sessão
  const counts = useMemo(() => DAYS.map(d => startsOn(d, slots, ther).length), [slots, ther]);
  // Dia escolhido some se ficar lotado com a nova combinação; cai no primeiro dia livre.
  const day = (pickedDay && counts[DAYS.indexOf(pickedDay)]) ? pickedDay
    : DAYS[counts.findIndex(Boolean)] ?? DAYS.find(hoursOf);
  const free = useMemo(() => startsOn(day, slots, ther), [day, slots, ther]);
  const start = free.includes(pickedStart) ? pickedStart : null;

  // Próxima sessão livre (qualquer terapeuta) para o CTA do hero.
  const next = useMemo(() => {
    for (const d of DAYS) {
      const s = startsOn(d, slots, "any");
      if (s.length) return { day: d, start: s[0], label: `${relDay(d)}, ${fmt(hoursOf(d), s[0])}` };
    }
    return null;
  }, [slots]);

  const reserveFromHero = useCallback(nx => {
    if (nx) {
      setTher("any");
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

  // Reserva no backend; erros (horário tomado, limite de reservas, antecedência…) voltam como mensagem para o formulário.
  async function confirm({ email }) {
    const slot = pickSlot(day, start, slots, ther);
    if (!slot) throw new Error("Esse horário não está mais livre. Escolha outro.");
    const created = await reserve(actor, slot);
    setDone({
      code: String(created?.id ?? "").slice(0, 8).toUpperCase(),
      name: employees.find(u => u.id === actor)?.name ?? "",
      email,
      when: `${date(day, { weekday: "long", day: "numeric", month: "long" })} às ${fmt(hoursOf(day), start)}`,
      what: `${SERVICE} · ${SESSION_MIN} min`,
      ther: slot.therapistName,
    });
    setReload(r => r + 1); // atualiza os horários livres
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
          <p className="lede">{SERVICE}, sessões de {SESSION_MIN} minutos. Escolha o terapeuta e um horário livre; a confirmação chega por e-mail.</p>
        </motion.div>

        <div className="stage">
          {!data ? (
            <div className="notice" role={loadError ? "alert" : "status"}>
              {loadError
                ? <><p>Não foi possível carregar os horários: {loadError}</p>
                    <Button className="ghost-btn" onPress={() => { setLoadError(null); setReload(r => r + 1); }}>Tentar de novo</Button></>
                : <p>Carregando horários…</p>}
            </div>
          ) : (
          <div className="booking">
            <div className="flow">
              <Step n="01" title="Terapeuta" id="terapeutas">
                <RadioGroup className="chips" aria-labelledby="terapeutas-t" orientation="horizontal"
                  value={ther} onChange={setTher}>
                  {[{ id: "any", name: "Sem preferência" }, ...data.therapists].map(t => <Chip key={t.id} group="ther" value={t.id}>{t.name}</Chip>)}
                </RadioGroup>
              </Step>

              <Step n="02" title="Dia" id="horarios" aside={date(day, { month: "long", year: "numeric" })}>
                <DayStrip day={day} counts={counts} onPick={chooseDay} />
              </Step>

              <Step n="03" title="Horário" id="horario" aside={`${date(day, { weekday: "long", day: "numeric" })} · ${hoursOf(day)[0]}h às ${hoursOf(day)[1]}h`}>
                <div className="bar-wrap">
                  <DayBar day={day} n={n} free={free} start={start} onPick={setPickedStart} />
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

            <motion.aside className="summary" id="dados" aria-live="polite" {...revealIn(0.15)}>
              <AnimatePresence mode="wait" initial={false}>
                {done
                  ? <motion.div key="done" {...FADE}>
                      <Done booking={done} onAgain={() => { setDone(null); setPickedStart(null); }} />
                    </motion.div>
                  : <motion.div key="form" {...FADE}>
                      <Summary day={day} start={start}
                        therapist={start != null ? pickSlot(day, start, slots, ther)?.therapistName : data.therapists.find(t => t.id === ther)?.name}
                        employees={employees} userId={actor} onUser={setUserId} onConfirm={confirm} />
                    </motion.div>}
              </AnimatePresence>
            </motion.aside>
          </div>
          )}
        </div>
      </main>
    </MotionConfig>
    </I18nProvider>
  );
}

// Etapa numerada do fluxo de reserva; esmaece ao entrar na tela.
function Step({ n, title, id, aside, delay = 0, children }) {
  return (
    <motion.section className="step" id={id} aria-labelledby={`${id}-t`} {...revealIn(delay)}>
      <header className="step-head">
        <span className="step-n" aria-hidden="true">{n}</span>
        <h3 id={`${id}-t`}>{title}</h3>
        {aside && <span className="step-aside">{aside}</span>}
      </header>
      {children}
    </motion.section>
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
          <motion.div key={k} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }} transition={{ duration: 0.5, ease: EASE, delay: Math.min(k, 10) * 0.035 }}>
          <Radio value={dayKey(d)} isDisabled={!c} className="day"
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
          </motion.div>
        );
      })}
    </RadioGroup>
  );
}

// Barra do dia: passar o mouse mostra a sessão "fantasma", clicar escolhe. Os horários (Slots) são o caminho acessível.
function DayBar({ day, n, free, start, onPick }) {
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
  const ok = i => free.includes(i);

  return (
    <>
      <div className="bar" aria-hidden="true"
        onMouseMove={e => { const i = idxAt(e); setHover(ok(i) ? i : null); }}
        onMouseLeave={() => setHover(null)}
        onClick={e => { const i = idxAt(e); if (ok(i)) onPick(i); }}>
        {range(span - 1).map(k => <div key={`h${k}`} className="hr" style={{ left: pct(((k + 1) * 60) / STEP) }} />)}
        <div key={`${dayKey(day)}-${free.join()}`} className="bar-layer">
          {range(N).filter(i => !ok(i)).map(i =>
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

const LIST = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const ITEM = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };

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
      <motion.div className="periods" variants={LIST} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
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
function Summary({ day, start, therapist, employees, userId, onUser, onConfirm }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const dayTxt = date(day, { weekday: "long", day: "numeric", month: "short" });

  async function submit(e) {
    e.preventDefault();
    setSending(true); setSendError(null);
    try { await onConfirm({ email: email.trim(), phone }); }
    catch (err) { setSendError(err.message); }
    finally { setSending(false); }
  }

  return (
    <div className="sum">
      <header className="step-head">
        <span className="step-n" aria-hidden="true">04</span>
        <h3>Seus dados</h3>
      </header>
      <div className="recap">
        <p className="sum-line">
          {SERVICE}, {SESSION_MIN} min<br />
          <Swap k={start == null ? "none" : `${dayKey(day)}-${start}`}>
            {start != null
              ? <span>{dayTxt}, {fmt(hoursOf(day), start)}</span>
              : <span className="dim">escolha um horário</span>}
          </Swap>
        </p>
        <p className="sum-meta">{therapist ? `com ${therapist}` : "terapeuta disponível no horário"}</p>
      </div>
      <Form className="form" onSubmit={submit}>
        {/* Modo de demonstração do backend (AUTH_MODE=header): escolher o colaborador cadastrado identifica quem reserva. */}
        <div className="field">
          <label htmlFor="f-name">Nome</label>
          <select id="f-name" value={userId ?? ""} onChange={e => onUser(e.target.value)}>
            {employees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <TextField className="field" name="email" type="email" isRequired autoComplete="email" value={email} onChange={setEmail}
          validate={v => (EMAIL.test(v.trim()) ? null : "Informe um e-mail válido, ex.: nome@empresa.com.br.")}>
          <Label>E-mail</Label>
          <Input inputMode="email" placeholder="nome@empresa.com.br" />
          <FieldError className="field-error" />
        </TextField>
        <TextField className="field" name="phone" type="tel" isRequired autoComplete="tel" value={phone} onChange={setPhone}
          validate={v => (v.replace(/\D/g, "").length >= 10 ? null : "Informe o número de telefone com DDD, ex.: (11) 91234-5678.")}>
          <Label>Número de telefone</Label>
          <Input inputMode="tel" placeholder="(11) 90000-0000" />
          <FieldError className="field-error" />
        </TextField>
        {sendError && <p className="field-error" role="alert">{sendError}</p>}
        <Button className="cta" type="submit" isDisabled={start == null || sending}>
          {start == null ? "Escolha um horário para confirmar" : sending ? "Reservando…" : "Confirmar reserva"}
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
