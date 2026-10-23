// Regras de exibição da agenda. Os horários livres vêm do backend (GET /api/booking/availability, ver api.js).
// Serviço único, oferecido pela empresa; o site não mostra preço.
export const SERVICE = "Massagem clássica";
export const SESSION_MIN = 30; // todas as sessões têm 30 minutos; precisa bater com SESSION_DURATION_MINUTES do backend
export const STEP = 30;        // minutos por slot da grade; precisa bater com SLOT_STEP_MINUTES do backend
export const BOOKING_DAYS = 21; // janela de reserva (BOOKING_HORIZON_DAYS do backend)
// ponytail: expediente fixo igual ao padrão do backend (WORK_DAYS=1..5, WORK_START=09:00, WORK_END=18:00);
// se o RH mudar essas regras, ajustar aqui (a API não expõe as regras para colaboradores).
const HOURS = [9, 18];
const WORK_DAYS = [1, 2, 3, 4, 5];

export const range = n => Array.from({ length: n }, (_, i) => i);
export const dayKey = d => d.toLocaleDateString("sv"); // AAAA-MM-DD no fuso local
export const hoursOf = d => (WORK_DAYS.includes(d.getDay()) ? HOURS : null);
export const slotCount = h => ((h[1] - h[0]) * 60) / STEP;
export const fmt = (h, i) => {
  const m = h[0] * 60 + i * STEP;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const indexOf = (h, d) => (d.getHours() * 60 + d.getMinutes() - h[0] * 60) / STEP;
const matches = (s, day, ther) => dayKey(new Date(s.startsAt)) === dayKey(day) && (ther === "any" || s.therapistId === ther);

// Horários livres do dia como índices da grade (sem repetir quando vários terapeutas estão livres no mesmo horário).
export function startsOn(day, slots, ther) {
  const h = hoursOf(day);
  if (!h) return [];
  const found = new Set();
  for (const s of slots) {
    if (!matches(s, day, ther)) continue;
    const i = indexOf(h, new Date(s.startsAt));
    if (Number.isInteger(i) && i >= 0 && i < slotCount(h)) found.add(i);
  }
  return [...found].sort((a, b) => a - b);
}

// Slot do backend a reservar no horário i: o do terapeuta escolhido ou, sem preferência, o primeiro livre.
export function pickSlot(day, i, slots, ther) {
  const h = hoursOf(day);
  return (h && slots.find(s => matches(s, day, ther) && indexOf(h, new Date(s.startsAt)) === i)) ?? null;
}

export function nextDays(n, from = new Date()) {
  return range(n).map(k => {
    const d = new Date(from);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + k);
    return d;
  });
}
