import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'

import { accounts, authStatePath, marker, password, runId } from '../support/environment'
import { prisma } from '../support/database'
import { antText, searchCustomers, tableRow, tableRows } from '../support/ui'


test.describe('列表状态与网络恢复', () => {
  test.use({ storageState: authStatePath('sales') })

  test('空状态、慢响应、断网恢复和浏览器刷新均可用', async ({ context, page }) => {
    await page.route('**/api/customers?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_200))
      await route.continue()
    })
    await page.goto('/customers')
    await expect(page.locator('.ant-spin-spinning')).toBeVisible()
    await expect(tableRows(page)).toHaveCount(10)

    const missingName = `不存在-${runId}`
    await searchCustomers(page, missingName)
    await expect(tableRows(page)).toHaveCount(0)
    await expect(page.locator('.ant-empty-description')).toContainText('暂无数据')

    await context.setOffline(true)
    await page.getByPlaceholder('搜索姓名、公司、电话').fill('离线搜索')
    await page.getByRole('button', { name: antText('搜索') }).click()
    await expect(page.locator('.ant-message-notice-content')).toContainText('离线状态')
    await context.setOffline(false)
    await searchCustomers(page, `${runId}-07`)
    await expect(tableRow(page, `${runId}-07`)).toHaveCount(1)

    await page.reload()
    await expect(tableRows(page)).toHaveCount(10)
  })
})

test.describe('会话过期恢复', () => {
  test.use({ storageState: authStatePath('sales') })

  test('会话失效后重新登录返回原页面', async ({ page }) => {
    await page.goto('/customers')
    await expect(tableRows(page)).toHaveCount(10)
    const sales = await prisma.user.findUniqueOrThrow({ where: { username: accounts.sales.username } })
    await prisma.user.update({ where: { id: sales.id }, data: { status: 'INACTIVE' } })
    try {
      await page.getByPlaceholder('搜索姓名、公司、电话').fill(runId)
      await page.getByRole('button', { name: antText('搜索') }).click()
      await expect(page).toHaveURL(/\/login\?reason=session-expired&callbackUrl=/)
    } finally {
      await prisma.user.update({ where: { id: sales.id }, data: { status: 'ACTIVE' } })
    }
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.getByPlaceholder('用户名').fill(accounts.sales.username)
    await expect(page.getByPlaceholder('用户名')).toHaveValue(accounts.sales.username)
    await page.getByPlaceholder('密码').fill(password)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/customers$/)
    await expect(tableRows(page)).toHaveCount(10)
  })
})

test.describe('真实服务端 500', () => {
  test.use({ storageState: authStatePath('admin') })

  test('下载对象缺失时按钮返回 500、带请求号且不误改数据', async ({ page }) => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: accounts.admin.username } })
    const file = await prisma.file.create({
      data: {
        id: randomUUID(),
        name: `e2e-missing-${runId}.png`,
        originalName: `e2e-missing-${runId}.png`,
        url: '/api/files/missing',
        path: `missing/${runId}.png`,
        size: 12,
        mimeType: 'image/png',
        category: 'IMAGE',
        uploadedBy: admin.id,
        description: marker,
      },
    })

    await page.goto('/files')
    const row = tableRow(page, file.originalName)
    await expect(row).toHaveCount(1)
    const responsePromise = page.waitForResponse((response) => (
      new URL(response.url()).pathname === `/api/files/${file.id}`
    ))
    await row.getByRole('link', { name: antText('下载') }).click()
    const response = await responsePromise
    expect(response.status()).toBe(500)
    expect(response.headers()['x-request-id']).toBeTruthy()
    expect(await response.json()).toMatchObject({ error: '服务器处理失败，请稍后重试' })
    expect(await prisma.file.findUnique({ where: { id: file.id } })).toMatchObject({ downloadCount: 0 })
    expect(await prisma.auditEvent.count({ where: { entityId: file.id } })).toBe(0)
  })
})
