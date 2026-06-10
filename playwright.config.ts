import { defineConfig } from '@playwright/test';

// Run `npm run build` first; the webServer below only serves dist/.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4321'
  },
  webServer: {
    command: 'npm run preview -- --port 4321',
    port: 4321,
    reuseExistingServer: true
  }
});
