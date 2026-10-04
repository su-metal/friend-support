import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(".") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: { APP_MODE: "demo", APP_URL: "http://127.0.0.1:3000" },
  },
});
