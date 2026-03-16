import { defineConfig, devices } from '@playwright/test';

const E2E_BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const REUSE_E2E_SERVER = process.env.PW_REUSE_SERVER === '1';

export default defineConfig({
  testDir: './e2e',
  // Run tests serially in CI for stability, parallel locally for speed
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
    // Set localStorage to prevent shepherd tour from appearing
    storageState: {
      cookies: [],
      origins: [
        {
          origin: E2E_BASE_URL,
          localStorage: [
            {
              name: 'hasVisited',
              value: 'true',
            },
          ],
        },
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev:e2e',
    url: E2E_BASE_URL,
    // Default to a fresh server for deterministic runs. Opt in to reuse with PW_REUSE_SERVER=1.
    reuseExistingServer: REUSE_E2E_SERVER && !process.env.CI,
    timeout: 180000,
  },
});
