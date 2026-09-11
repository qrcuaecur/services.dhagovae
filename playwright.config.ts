import { defineConfig } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3002";
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // The suite shares one document and walks it through its lifecycle, so it
  // must run in order in a single worker.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
  },
  // Starts the dev server unless one is already running on this port.
  // The port must match NEXT_PUBLIC_APP_URL, since the QR test asserts on
  // the address the code encodes.
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
