// Dados de exemplo e regras da agenda. Tudo aqui vira resposta do backend depois.
// Serviço único, oferecido pela empresa; o site não mostra preço.
export const SERVICE = "Massagem clássica";
export const DURATIONS = [30, 60, 90];
export const THERAPISTS = [
  { id: "any", name: "Sem preferência" },
  { id: "ana", name: "Ana" }, { id: "bruno", name: "Bruno" }, { id: "carla", name: "Carla" },
];
export const STEP = 30; // minutos por slot
const HOURS = { weekday: [9, 20], sat: [9, 14] }; // domingo fechado

export const range = n => Array.from({ length: n }, (_, i) => i);
export const dayKey = d => d.toLocaleDateString("sv"); // AAAA-MM-DD no fuso local
export const hoursOf = d => (d.getDay() === 0 ? null : d.getDay() === 6 ? HOURS.sat : HOURS.weekday);
export const slotCount = h => ((h[1] - h[0]) * 60) / STEP;
export const fmt = (h, i) => {
  const m = h[0] * 60 + i * STEP;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// ponytail: agenda fake determinística por hash; trocar por GET /disponibilidade quando o backend existir
function rnd(s) {
  let x = 2166136261;
  for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); }
  return (x >>> 0) / 4294967296;
}
export const isBusy = (d, t, i) => rnd(dayKey(d) + t + Math.floor(i / 2)) < 0.38;

const pool = ther => (ther === "any" ? THERAPISTS.slice(1).map(t => t.id) : [ther]);
export const allBusy = (d, i, ther) => pool(ther).every(t => isBusy(d, t, i));

// Primeiro terapeuta livre para n slots a partir do slot i, ou null.
export function freeTherapist(d, i, n, ther, now = new Date()) {
  const h = hoursOf(d);
  if (!h || i < 0 || i + n > slotCount(h)) return null;
  const start = new Date(d);
  start.setHours(h[0], i * STEP, 0, 0);
  if (start < now) return null;
  return pool(ther).find(t => range(n).every(k => !isBusy(d, t, i + k))) ?? null;
}

export function starts(d, n, ther, now) {
  const h = hoursOf(d);
  return h ? range(slotCount(h)).filter(i => freeTherapist(d, i, n, ther, now)) : [];
}

export function nextDays(n, from = new Date()) {
  return range(n).map(k => {
    const d = new Date(from);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + k);
    return d;
  });
}
