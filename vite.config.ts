import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Rutas relativas: el mismo build funciona en la raíz y en usuario.github.io/<repo>/.
  // La app usa rutas con hash (#/customers), así que no necesita reescrituras del servidor.
  base: "./",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173 },
});
