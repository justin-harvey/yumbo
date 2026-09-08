import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Standalone from vite.config so the app's React/PWA plugins don't load during
// unit tests. Only the @/ alias is needed.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
