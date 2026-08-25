import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'


function requireTestEnvironment(): void {
  if (process.env.CRM_PROFILE !== 'test') {
    throw new Error('Playwright E2E 只允许 CRM_PROFILE=test')
  }
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('Playwright E2E 缺少 DATABASE_URL')
  const database = new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase()
  if (!database.endsWith('_test')) {
    throw new Error('Playwright E2E 只允许连接名称以 _test 结尾的数据库')
  }
  if (!process.env.CRM_E2E_RUN_ID || !process.env.CRM_E2E_PASSWORD) {
    throw new Error('Playwright E2E 缺少本次运行标识或临时密码')
  }
}

requireTestEnvironment()

const outputRoot = path.resolve('output', 'playwright')
const adminState = path.join(outputRoot, 'auth', 'admin.json')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.(spec|setup)\.ts/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  preserveOutput: 'failures-only',
  outputDir: path.join(outputRoot, 'results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(outputRoot, 'report'), open: 'never' }],
    ['json', { outputFile: path.join(outputRoot, 'report.json') }],
  ],
  use: {
    baseURL: process.env.CRM_E2E_BASE_URL || 'http://localhost:3001',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  globalTeardown: './tests/e2e/global-teardown.ts',
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminState,
      },
    },
  ],
})
