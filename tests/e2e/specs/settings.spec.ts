import { expect, test } from '@playwright/test'

import { accounts, authStatePath, runId } from '../support/environment'
import { prisma } from '../support/database'
import { antText, expectSuccessMessage } from '../support/ui'


test.describe('系统设置按钮', () => {
  test.use({ storageState: authStatePath('admin') })

  test('保存设置重复点击只写入一次并在刷新后回显', async ({ page }) => {
    const systemName = `E2E CRM ${runId}`
    const companyName = `E2E公司 ${runId}`
    let putCount = 0
    page.on('request', (request) => {
      if (request.method() === 'PUT' && new URL(request.url()).pathname === '/api/settings') putCount += 1
    })

    await page.goto('/admin/settings')
    await expect(page.locator('.ant-spin-spinning')).toHaveCount(0)
    await page.getByLabel('系统名称').fill(systemName)
    await page.getByLabel('公司名称').fill(companyName)
    const responsePromise = page.waitForResponse((response) => (
      response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/settings'
    ))
    await page.getByRole('button', { name: antText('保存设置') }).dblclick()
    expect((await responsePromise).status()).toBe(200)
    await expectSuccessMessage(page, '设置保存成功')
    expect(putCount).toBe(1)

    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ['systemName', 'companyName'] } },
    })
    expect(new Map(rows.map((row) => [row.key, row.value]))).toEqual(new Map([
      ['systemName', systemName],
      ['companyName', companyName],
    ]))
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: accounts.admin.username } })
    expect(await prisma.auditEvent.count({
      where: { actorId: admin.id, action: 'SETTINGS_UPDATED', entityId: 'global' },
    })).toBe(1)

    await page.reload()
    await expect(page.getByLabel('系统名称')).toHaveValue(systemName)
    await expect(page.getByLabel('公司名称')).toHaveValue(companyName)
  })
})

test.describe('受限设置权限', () => {
  test.use({ storageState: authStatePath('restricted') })

  test('受限用户直达页面和接口均被拒绝', async ({ page }) => {
    const response = await page.request.get('/api/settings')
    expect(response.status()).toBe(403)
    expect(await response.json()).toMatchObject({ error: '无权查看系统设置' })

    await page.goto('/admin/settings')
    await expect(page).toHaveURL(/\/403(?:\?|$)/)
    await expect(page.getByRole('button', { name: antText('保存设置') })).toHaveCount(0)
  })
})
