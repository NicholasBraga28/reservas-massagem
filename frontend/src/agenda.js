// Dados de exemplo e regras da agenda. Tudo aqui vira resposta do backend depois.
export const SERVICES = [
  { id: "relax",   name: "Relaxante",          desc: "Pressão leve, ritmo lento, óleo morno",    base: 170 },
  { id: "sport",   name: "Desportiva",         desc: "Pressão firme, foco em grupos musculares", base: 190 },
  { id: "shiatsu", name: "Shiatsu",            desc: "Pressão por pontos, sem óleo, de roupa",   base: 180 },
  { id: "stones",  name: "Pedras quentes",     desc: "Basalto aquecido a cerca de 50 °C",        base: 220, min: 60 },
  { id: "lymph",   name: "Drenagem linfática", desc: "Movimentos leves e ritmados",              base: 180 },
];
export const DURATIONS = [30, 60, 90];
export const THERAPISTS = [
  { id: "any", name: "Sem preferência" },
  { id: "ana", name: "Ana" }, { id: "bruno", name: "Bruno" }, { id: "carla", name: "Carla" },
];
export const STEP = 30; // minutos por slot
const PRICE_FACTOR = { 30: 0.6, 60: 1, 90: 1.4 };
const HOURS = { weekday: [9, 20], sat: [9, 14] }; // domingo fechado

export const range = n => Array.from({ length: n }, (_, i) => i);
export const dayKey = d => d.toLocaleDateString("sv"); // AAAA-MM-DD no fuso local
export const hoursOf = d => (d.getDay() === 0 ? null : d.getDay() === 6 ? HOURS.sat : HOURS.weekday);
export const slotCount = h => ((h[1] - h[0]) * 60) / STEP;
export const price = (svc, dur) => svc.base * PRICE_FACTOR[dur];
export const brl = n => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
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
