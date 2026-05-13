import { defineConfig, devices } from '@playwright/test'

/** Isolated runner sets `E2E_WEB_PORT`; plain `yarn playwright test` defaults to 3000 */
const webPort = process.env.E2E_WEB_PORT || process.env.PORT || '3000'
const webOrigin = `http://localhost:${webPort}`

/**
 * CI / isolated stack: 4 workers — one Sails + one Vite; higher counts can race lift (EADDRINUSE).
 * Plain local `yarn test:e2e`: 8 workers (override with E2E_PLAYWRIGHT_WORKERS).
 */
function resolvePlaywrightWorkers () {
  const raw = process.env.E2E_PLAYWRIGHT_WORKERS
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 1) {
      return Math.min(32, Math.floor(n))
    }
  }
  if (process.env.CI === 'true' || process.env.E2E_ISOLATED === '1') {
    return 4
  }
  return 8
}

/** Unauth projects must never inherit a session from another worker or a reused profile */
const noSessionStorageState = { cookies: [], origins: [] }

const reporters = process.env.CI
  ? [
      ['html'],
      ['github'],
      ['junit', { outputFile: 'test-results/junit.xml' }]
    ]
  : 'html'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: resolvePlaywrightWorkers(),
  reporter: reporters,
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
      // Worst-case single `gotoLoginAndWaitForEmail` is capped (~8m hard ceiling with env defaults); keep headroom over 600s project timeout.
      timeout: 720000,
      retries: 2
    },
    {
      name: 'setup-session-mutate',
      testMatch: /auth\.session-mutate\.setup\.js/,
      // Must run after `setup`: parallel setups hit Vite during cold dep-prebundle and can cancel the
      // dev build (lazy routes fail; #email never mounts). One warm navigation first avoids that race.
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
      timeout: 720000,
      retries: 2
    },
    {
      name: 'setup-track-viewer',
      testMatch: /auth\.track-viewer\.setup\.js/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
      timeout: 720000,
      retries: 2
    },
    {
      name: 'chromium',
      testIgnore: [
        '**/unauthenticated.routes.spec.js',
        '**/unauthenticated.invitation-links-about.spec.js',
        '**/authenticated.auth-session.spec.js',
        '**/authenticated.track-paywall.spec.js'
      ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/session.json'
      },
      dependencies: ['setup']
    },
    {
      name: 'chromium-unauth',
      testMatch: [
        '**/unauthenticated.routes.spec.js',
        '**/unauthenticated.invitation-links-about.spec.js'
      ],
      use: { ...devices['Desktop Chrome'], storageState: noSessionStorageState },
      timeout: 120000,
      dependencies: ['setup']
    },
    // Real mobile UA + viewport so ismobilejs / util/mobile (isMobileDevice) behave like phone web, not desktop-with-narrow-window
    {
      name: 'chromium-track-paywall',
      testMatch: '**/authenticated.track-paywall.spec.js',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/track-viewer-session.json'
      },
      dependencies: ['setup-track-viewer'],
      timeout: 120000
    },
    {
      name: 'mobile-chrome',
      testIgnore: [
        '**/unauthenticated.routes.spec.js',
        '**/unauthenticated.invitation-links-about.spec.js',
        '**/authenticated.auth-session.spec.js',
        '**/authenticated.track-paywall.spec.js'
      ],
      use: {
        ...devices['Pixel 5'],
        storageState: './e2e/.auth/session.json'
      },
      dependencies: ['setup']
    },
    {
      name: 'chromium-session-mutate',
      testMatch: '**/authenticated.auth-session.spec.js',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './e2e/.auth/session-mutate-user.json'
      },
      dependencies: ['setup', 'setup-session-mutate'],
      timeout: 120000
    },
    {
      name: 'mobile-session-mutate',
      testMatch: '**/authenticated.auth-session.spec.js',
      use: {
        ...devices['Pixel 5'],
        storageState: './e2e/.auth/session-mutate-user.json'
      },
      dependencies: ['setup', 'setup-session-mutate'],
      timeout: 120000
    },
    {
      name: 'mobile-unauth',
      testMatch: [
        '**/unauthenticated.routes.spec.js',
        '**/unauthenticated.invitation-links-about.spec.js'
      ],
      use: { ...devices['Pixel 5'], storageState: noSessionStorageState },
      timeout: 120000,
      dependencies: ['setup']
    },
    {
      name: 'mobile-track-paywall',
      testMatch: '**/authenticated.track-paywall.spec.js',
      use: {
        ...devices['Pixel 5'],
        storageState: './e2e/.auth/track-viewer-session.json'
      },
      dependencies: ['setup-track-viewer'],
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
    // First Vite cold compile can exceed 120s on slow CI / busy laptops.
    timeout: 180000,
    env: {
      ...process.env,
      VITE_API_HOST: process.env.VITE_API_HOST || 'http://localhost:3001',
      PORT: webPort
    }
  }
})
