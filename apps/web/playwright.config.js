import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'] }
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
      use: { ...devices['Desktop Chrome'] }
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
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command: 'yarn dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
})
