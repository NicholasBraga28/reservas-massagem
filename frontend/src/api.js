// Cliente da API do backend (NestJS, prefixo /api). Em dev, o Vite repassa /api para http://localhost:3000 (vite.config.js).
const BASE = import.meta.env.VITE_API_URL ?? "/api";

const OFFLINE = "Servidor indisponível. Verifique se o backend está rodando (porta 3000).";

async function request(path, { userId, ...init } = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    // Modo "header" do backend (AUTH_MODE=header): quem age é identificado pelo UUID em x-user-id.
    headers: { "Content-Type": "application/json", ...(userId ? { "x-user-id": userId } : {}) },
  }).catch(() => { throw new Error(OFFLINE); });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
    // Sem corpo JSON e erro 5xx = o proxy do Vite não alcançou o backend.
    throw new Error(message || (res.status >= 500 ? OFFLINE : `O servidor respondeu com erro ${res.status}.`));
  }
  return body;
}

// Só colaboradores (EMPLOYEE) podem reservar.
export const getEmployees = async () => (await request("/auth/demo-users")).filter(u => u.role === "EMPLOYEE");

// { therapists: [{ id, name }], slots: [{ startsAt, endsAt, therapistId, therapistName, roomId, ... }] }
export const getAvailability = (userId, from, to, durationMinutes) => {
  const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), durationMinutes: String(durationMinutes) });
  return request(`/booking/availability?${query}`, { userId });
};

export const reserve = (userId, slot) =>
  request("/booking/appointments", {
    method: "POST",
    userId,
    body: JSON.stringify({ startsAt: slot.startsAt, endsAt: slot.endsAt, therapistId: slot.therapistId, roomId: slot.roomId }),
  });
