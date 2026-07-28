import { defineConfig, devices } from '@playwright/test'

// Бэкенд (порт 8010) не поднимается отсюда — нужен отдельно запущенный
// локальный dev-сервер (см. память oinarri-local-dev-environment), только
// фронтовый dev-сервер стартует автоматически.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
