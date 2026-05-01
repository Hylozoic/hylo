import { defineConfig, devices } from '@playwright/test'

/** Isolated runner sets `E2E_WEB_PORT`; plain `yarn playwright test` defaults to 3000 */
const webPort = process.env.E2E_WEB_PORT || process.env.PORT || '3000'
const webOrigin = `http://localhost:${webPort}`

/** Unauth projects must never inherit a session from another worker or a reused profile */
const noSessionStorageState = { cookies: [], origins: [] }

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: webOrigin,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
      timeout: 120000
    },
    {
      name: 'chromium',
      testIgnore: '**/unauthenticated.routes.spec.js',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/session.json'
      },
      dependencies: ['setup']
    },
    {
      name: 'chromium-unauth',
      testMatch: '**/unauthenticated.routes.spec.js',
      use: { ...devices['Desktop Chrome'], storageState: noSessionStorageState },
      timeout: 120000
    },
    // Real mobile UA + viewport so ismobilejs / util/mobile (isMobileDevice) behave like phone web, not desktop-with-narrow-window
    {
      name: 'mobile-chrome',
      testIgnore: '**/unauthenticated.routes.spec.js',
      use: {
        ...devices['Pixel 5'],
        storageState: './e2e/.auth/session.json'
      },
      dependencies: ['setup']
    },
    {
      name: 'mobile-unauth',
      testMatch: '**/unauthenticated.routes.spec.js',
      use: { ...devices['Pixel 5'], storageState: noSessionStorageState },
      timeout: 120000
    }
  ],
  webServer: {
    command: 'yarn dev',
    url: webOrigin,
    // A dev server already on this port was started with its own VITE_API_HOST; reusing it breaks
    // isolated E2E (proxy would still point at :3001 while the test API runs on E2E_BACKEND_PORT).
    reuseExistingServer:
      !process.env.CI && process.env.E2E_ISOLATED !== '1',
    timeout: 120000,
    env: {
      ...process.env,
      VITE_API_HOST: process.env.VITE_API_HOST || 'http://localhost:3001',
      PORT: webPort
    }
  }
})
