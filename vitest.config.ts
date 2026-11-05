import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Los módulos de src/lib son puros, pero el dashboard se renderiza en DOM:
    // jsdom mantiene el entorno fiel al de la app.
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
