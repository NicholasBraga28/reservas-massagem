// npm run check — falha se as regras da agenda quebrarem
import assert from "node:assert/strict";
import { nextDays, starts, freeTherapist, isBusy, hoursOf, slotCount, STEP } from "./agenda.js";

const days = nextDays(14, new Date(2026, 9, 5)); // segunda, 5/out/2026
const past = new Date(2026, 0, 1);
const sunday = days.find(d => d.getDay() === 0), saturday = days.find(d => d.getDay() === 6);

assert.deepEqual(starts(sunday, 2, "any", past), [], "domingo fechado");

const sat = starts(saturday, 2, "any", past);
assert.ok(Math.max(...sat) + 2 <= slotCount(hoursOf(saturday)), "sessão termina até o fechamento");

for (const d of days.filter(hoursOf)) for (const i of starts(d, 3, "any", past)) {
  const t = freeTherapist(d, i, 3, "any", past);
  assert.ok([0, 1, 2].every(k => !isBusy(d, t, i + k)), "terapeuta livre a sessão toda");
}

const monday = new Date(days[0]); monday.setHours(15, 0, 0, 0);
assert.ok(starts(days[0], 1, "any", monday).every(i => 9 * 60 + i * STEP >= 15 * 60), "sem horários no passado");

console.log("agenda ok");
