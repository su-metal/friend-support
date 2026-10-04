import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(".") } },
  test: {
    include: ["tests/firestore/**/*.test.ts"],
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
    env: {
      APP_MODE: "demo",
      APP_URL: "http://127.0.0.1:3000",
      FIREBASE_PROJECT_ID: "demo-friend-support",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085",
    },
  },
});
