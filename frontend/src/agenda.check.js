// npm run check — falha se a leitura dos horários do backend quebrar
import assert from "node:assert/strict";
import { startsOn, pickSlot, hoursOf, fmt } from "./agenda.js";

const monday = new Date(2026, 9, 26, 12), sunday = new Date(2026, 9, 25, 12);
const at = (h, m) => new Date(2026, 9, 26, h, m).toISOString();
const slot = (h, m, therapistId) => ({ startsAt: at(h, m), endsAt: at(h, m + 30), therapistId, therapistName: therapistId, roomId: "sala" });
const slots = [slot(9, 0, "t1"), slot(9, 0, "t2"), slot(9, 30, "t2"), slot(9, 10, "t1"), slot(13, 0, "t1")];

assert.equal(hoursOf(sunday), null, "domingo fechado");
assert.deepEqual(startsOn(sunday, slots, "any"), [], "sem horários fora do expediente");
assert.deepEqual(startsOn(monday, slots, "any"), [0, 1, 8], "sem repetir horário com vários terapeutas; ignora fora da grade");
assert.deepEqual(startsOn(monday, slots, "t1"), [0, 8], "filtra pelo terapeuta escolhido");
assert.equal(fmt(hoursOf(monday), 8), "13:00", "índice vira horário");
assert.equal(pickSlot(monday, 1, slots, "any").therapistId, "t2", "sem preferência pega quem está livre");
assert.equal(pickSlot(monday, 1, slots, "t1"), null, "terapeuta escolhido ocupado no horário");

console.log("agenda ok");
