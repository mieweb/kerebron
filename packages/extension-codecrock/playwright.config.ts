import { defineConfig, devices } from '@playwright/test';

const __dirname = import.meta.dirname!;

export default defineConfig({
  testDir: __dirname + '/test',
  testMatch: '**/*.spec.ts',

  fullyParallel: true,
  forbidOnly: !!Deno.env.get('CI'),
  retries: Deno.env.get('CI') ? 2 : 0,
  workers: Deno.env.get('CI') ? 1 : undefined,

  reporter: 'html',

  outputDir: __dirname + '/../../test-results',
  snapshotDir: __dirname + '/../../snapshots',

  use: {
    /* Base URL points to the server-deno-hono which serves all examples */
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'deno task dev',
    url: 'http://localhost:8000',
    reuseExistingServer: !Deno.env.get('CI'),
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
