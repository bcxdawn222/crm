import { expect, test as setup } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

import { ensureE2EFixtures } from './support/database'
import { accounts, authRoot, authStatePath, baseURL, password } from './support/environment'


setup('准备夹具并生成四个角色的认证状态', async ({ browser }) => {
  await ensureE2EFixtures()
  await mkdir(authRoot, { recursive: true })
  for (const account of Object.values(accounts)) {
    const context = await browser.newContext({ baseURL, locale: 'zh-CN' })
    const page = await context.newPage()
    const sessionReady = page.waitForResponse((response) => (
      response.request().method() === 'GET'
      && new URL(response.url()).pathname === '/api/auth/session'
    ), { timeout: 30_000 })
    await page.goto('/login')
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await sessionReady
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('用户名').fill(account.username)
    await page.getByPlaceholder('密码').fill(password)
    await page.locator('button[type="submit"]').click()
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/)
    await expect(page.getByRole('menuitem', { name: '仪表盘' })).toBeVisible()
    await context.storageState({ path: authStatePath(account.role) })
    await context.close()
  }
})
