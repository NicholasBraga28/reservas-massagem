import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // three é importado sob demanda (Diamond.jsx); pré-otimiza para o dev server não recarregar no primeiro acesso.
  optimizeDeps: { include: ["three", "three/addons/environments/RoomEnvironment.js"] },
});
