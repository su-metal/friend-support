import { defineConfig } from "@playwright/test";
const port = 3101;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: {
      APP_MODE: "demo",
      APP_URL: `http://127.0.0.1:${port}`,
      ENABLE_RECIPIENT_ACCESS: "true",
      PLAYWRIGHT_TEST_MODE: "true",
    },
    timeout: 120000,
  },
});
