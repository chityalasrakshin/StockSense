import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 300_000, // 5 minutes overall test timeout for walkthrough recording
  expect: {
    timeout: 15_000,
  },
  reporter: 'list',
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:3000',
    viewport: { width: 1920, height: 1080 },
    channel: 'chrome',
    headless: false,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        viewport: { width: 1920, height: 1080 },
        channel: 'chrome',
      },
    },
  ],
});
