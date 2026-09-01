import { expect, test } from '@playwright/test'

import { accounts, authStatePath, fixtureNames, marker, runId } from '../support/environment'
import { prisma } from '../support/database'
import { antText, clickModalPrimary, expectSuccessMessage, searchCustomers, tableRow, tableRows } from '../support/ui'


test.describe('客户列表与客户写操作', () => {
  test.use({ storageState: authStatePath('sales') })

  test('搜索、重置和分页使用真实服务端数据', async ({ page }) => {
    await page.goto('/customers')
    await searchCustomers(page, `${fixtureNames.salesPrefix}-01`)
    await expect(tableRow(page, `${fixtureNames.salesPrefix}-01`)).toHaveCount(1)

    const resetResponse = page.waitForResponse((response) => (
      response.request().method() === 'GET'
      && response.url().includes('/api/customers?')
      && !response.url().includes('keyword=')
    ))
    await page.getByRole('button', { name: antText('重置') }).click()
    expect((await resetResponse).status()).toBe(200)
    await expect(tableRows(page)).toHaveCount(10)

    const nextPageResponse = page.waitForResponse((response) => (
      response.request().method() === 'GET' && response.url().includes('/api/customers?page=2')
    ))
    await page.locator('.ant-pagination-item-2').click()
    expect((await nextPageResponse).status()).toBe(200)
    await expect(page.locator('.ant-pagination-item-2')).toHaveClass(/ant-pagination-item-active/)
  })

  test('新增客户重复点击只写入一次并记录审计', async ({ page }) => {
    const name = `E2E新增客户-${runId}`
    const phone = `139${parseInt(runId.slice(0, 8), 16)}`.slice(0, 20)
    let postCount = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/customers') postCount += 1
    })

    await page.goto('/customers')
    await page.getByRole('button', { name: antText('新增客户') }).click()
    await page.getByLabel('客户姓名').fill(name)
    await page.getByLabel('公司名称').fill('E2E新增公司')
    await page.getByLabel('联系电话').fill(phone)
    await page.getByLabel('备注信息').fill(marker)
    const responsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/customers'
    ))
    await page.getByRole('button', { name: antText('创建') }).dblclick()
    expect((await responsePromise).status()).toBe(200)
    await expectSuccessMessage(page, '创建成功')
    await page.waitForTimeout(500)
    expect(postCount).toBe(1)

    const customer = await prisma.customer.findFirst({ where: { name, notes: marker } })
    expect(customer).not.toBeNull()
    expect(await prisma.customer.count({ where: { name, notes: marker } })).toBe(1)
    expect(await prisma.auditEvent.count({
      where: { entityId: customer?.id, action: 'CREATE', reason: 'CUSTOMER_CREATED' },
    })).toBe(1)
  })

  test('编辑客户同步更新页面、数据库和审计', async ({ page }) => {
    const name = `${fixtureNames.salesPrefix}-02`
    const company = `E2E编辑公司-${runId}`
    await page.goto('/customers')
    await searchCustomers(page, name)
    await tableRow(page, name).getByRole('button', { name: antText('编辑') }).click()
    await page.getByLabel('公司名称').fill(company)
    const responsePromise = page.waitForResponse((response) => (
      response.request().method() === 'PUT' && /\/api\/customers\/[^/]+$/.test(new URL(response.url()).pathname)
    ))
    await page.getByRole('button', { name: antText('更新') }).click()
    expect((await responsePromise).status()).toBe(200)
    await expectSuccessMessage(page, '更新成功')

    const customer = await prisma.customer.findFirstOrThrow({ where: { name, notes: marker } })
    expect(customer.company).toBe(company)
    expect(await prisma.auditEvent.count({
      where: { entityId: customer.id, action: 'UPDATE', reason: 'CUSTOMER_UPDATED' },
    })).toBe(1)
  })

  test('归档客户进入公海且流转可追溯', async ({ page }) => {
    const name = `${fixtureNames.salesPrefix}-03`
    await page.goto('/customers')
    await searchCustomers(page, name)
    await tableRow(page, name).getByRole('button', { name: antText('归档') }).click()
    const responsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/archive')
    ))
    await clickModalPrimary(page, '确认归档')
    expect((await responsePromise).status()).toBe(200)
    await expectSuccessMessage(page, '归档成功')

    const customer = await prisma.customer.findFirstOrThrow({ where: { name, notes: marker } })
    expect(customer.isPublic).toBe(true)
    expect(customer.status).toBe('INACTIVE')
    expect(customer.publicPoolEnteredAt).not.toBeNull()
    expect(await prisma.auditEvent.count({
      where: { entityId: customer.id, action: 'ARCHIVE_TO_PUBLIC_POOL' },
    })).toBe(1)
  })

})

test.describe('管理员客户删除', () => {
  test.use({ storageState: authStatePath('admin') })

  test('删除客户执行软删除且保留审计', async ({ page }) => {
    const name = fixtureNames.adminCustomer
    await page.goto('/customers')
    await searchCustomers(page, name)
    await tableRow(page, name).getByRole('button', { name: antText('删除') }).click()
    const responsePromise = page.waitForResponse((response) => (
      response.request().method() === 'DELETE' && /\/api\/customers\/[^/]+$/.test(new URL(response.url()).pathname)
    ))
    await clickModalPrimary(page)
    expect((await responsePromise).status()).toBe(200)
    await expectSuccessMessage(page, '删除成功')
    await expect(tableRow(page, name)).toHaveCount(0)

    const customer = await prisma.customer.findFirstOrThrow({ where: { name, notes: marker } })
    expect(customer.status).toBe('INACTIVE')
    expect(await prisma.auditEvent.count({
      where: { entityId: customer.id, action: 'DELETE', reason: 'CUSTOMER_SOFT_DELETED' },
    })).toBe(1)
  })
})

test.describe('主管客户转移', () => {
  test.use({ storageState: authStatePath('manager') })

  test('转移按钮写入目标销售并记录审计', async ({ page }) => {
    await page.goto('/customers')
    await searchCustomers(page, fixtureNames.managerCustomer)
    await tableRow(page, fixtureNames.managerCustomer).getByRole('button', { name: antText('转移') }).click()
    await page.getByLabel('目标销售').click()
    await page.getByText(accounts.sales.realName, { exact: false }).click()
    await page.getByLabel('转移原因').fill(marker)
    const responsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/transfer')
    ))
    await page.getByRole('button', { name: antText('确认转移') }).click()
    expect((await responsePromise).status()).toBe(200)
    await expectSuccessMessage(page, '客户转移成功')

    const customer = await prisma.customer.findFirstOrThrow({ where: { name: fixtureNames.managerCustomer } })
    const sales = await prisma.user.findUniqueOrThrow({ where: { username: accounts.sales.username } })
    expect(customer.salesId).toBe(sales.id)
    expect(await prisma.auditEvent.count({ where: { entityId: customer.id, action: 'TRANSFER' } })).toBe(1)
  })
})

test.describe('公海认领', () => {
  test.use({ storageState: authStatePath('sales') })

  test('销售认领公海客户并更新归属与审计', async ({ page }) => {
    await page.goto('/public-pool')
    await page.getByPlaceholder('搜索姓名、公司、电话').fill(fixtureNames.publicCustomer)
    const listResponse = page.waitForResponse((response) => (
      response.request().method() === 'GET' && response.url().includes('/api/public-pool?')
    ))
    await page.getByRole('button', { name: antText('搜索') }).click()
    expect((await listResponse).status()).toBe(200)
    await tableRow(page, fixtureNames.publicCustomer).getByRole('button', { name: antText('认领') }).click()
    const claimResponse = page.waitForResponse((response) => (
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/public-pool/claim'
    ))
    await clickModalPrimary(page)
    expect((await claimResponse).status()).toBe(200)
    await expectSuccessMessage(page, '认领成功')

    const customer = await prisma.customer.findFirstOrThrow({ where: { name: fixtureNames.publicCustomer } })
    const sales = await prisma.user.findUniqueOrThrow({ where: { username: accounts.sales.username } })
    expect(customer.salesId).toBe(sales.id)
    expect(customer.isPublic).toBe(false)
    expect(await prisma.auditEvent.count({
      where: { entityId: customer.id, action: 'CLAIM', reason: 'PUBLIC_POOL_CLAIM' },
    })).toBe(1)
  })
})
