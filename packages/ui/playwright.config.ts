import { defineConfig, devices } from '@playwright/test';

const __dirname = import.meta.dirname!;

export default defineConfig({
  testDir: __dirname + '/test',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!Deno.env.get('CI'),

  /* Retry on CI only */
  retries: Deno.env.get('CI') ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: Deno.env.get('CI') ? 1 : undefined,

  /* Reporter to use */
  reporter: 'html',

  outputDir: __dirname + '/../../test-results',
  snapshotDir: __dirname + '/../../snapshots',

  /* Shared settings for all the projects below */
  use: {
    /* Base URL points to the server-deno-hono which serves all examples */
    baseURL: 'http://localhost:8000',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
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
