import { expect, test, type Page } from '@playwright/test'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { accounts, authStatePath, runId } from '../support/environment'
import { prisma } from '../support/database'
import {
  antText,
  clickModalPrimary,
  expectSuccessMessage,
  searchCooperatingCustomers,
  tableRow,
  tableRows,
} from '../support/ui'


const pageSize = 10
const createdIds: string[] = []
const contractKeys: string[] = []

function countToReachLastSingle(total: number): number {
  let target = Math.max(pageSize + 1, total)
  while (target % pageSize !== 1) target += 1
  if (target === total) target += pageSize
  return target - total
}

async function openLastTablePage(page: Page, route: string, apiPath: string, lastPage: number) {
  await page.goto(route)
  await expect(tableRows(page).first()).toBeVisible()
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === apiPath
    && new URL(response.url()).searchParams.get('page') === String(lastPage)
  ))
  await page.locator(`.ant-pagination-item-${lastPage}`).click()
  expect((await responsePromise).status()).toBe(200)
}

test.describe('删除后的列表一致性', () => {
  test.use({ storageState: authStatePath('admin') })

  test.afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.auditEvent.deleteMany({ where: { entityId: { in: createdIds } } })
      await prisma.message.deleteMany({ where: { id: { in: createdIds } } })
      await prisma.contractArchive.deleteMany({ where: { id: { in: createdIds } } })
      await prisma.order.deleteMany({ where: { id: { in: createdIds } } })
      await prisma.telemarketingList.deleteMany({ where: { id: { in: createdIds } } })
    }
    const contractRoot = path.resolve(process.env.CRM_UPLOAD_DIR as string, 'contracts')
    await Promise.all(contractKeys.map((key) => rm(path.resolve(contractRoot, key), { force: true })))
  })

  test('电销名单删除最后一条后回到上一页', async ({ page }) => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: accounts.admin.username } })
    const total = await prisma.telemarketingList.count({ where: { salesId: admin.id } })
    const createCount = countToReachLastSingle(total)
    const records = Array.from({ length: createCount }, (_, index) => ({
      id: randomUUID(),
      name: `E2E删除分页电销-${runId}-${index}`,
      phone: `130${runId.slice(0, 8)}${String(index).padStart(2, '0')}`.slice(0, 20),
      source: `E2E:${runId}`,
      salesId: admin.id,
      createdAt: new Date(Date.UTC(2020, 0, 1, 0, index)),
    }))
    createdIds.push(...records.map((record) => record.id))
    await prisma.telemarketingList.createMany({ data: records })

    const finalTotal = total + createCount
    const lastPage = Math.ceil(finalTotal / pageSize)
    const target = records[0]
    await openLastTablePage(page, '/telemarketing', '/api/telemarketing', lastPage)
    await expect(tableRow(page, target.name)).toHaveCount(1)

    const deleteResponse = page.waitForResponse((response) => (
      response.request().method() === 'DELETE'
      && new URL(response.url()).pathname === '/api/telemarketing'
      && new URL(response.url()).searchParams.get('id') === target.id
    ))
    await tableRow(page, target.name).getByRole('button', { name: antText('删除') }).click()
    await page.locator('.ant-popconfirm .ant-btn-primary').click()
    expect((await deleteResponse).status()).toBe(200)
    await expectSuccessMessage(page, '删除成功')
    await expect(page.locator(`.ant-pagination-item-${lastPage - 1}`)).toHaveClass(/ant-pagination-item-active/)
    await expect(tableRows(page)).toHaveCount(pageSize)
  })

  test('订单删除最后一条后回到上一页', async ({ page }) => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: accounts.admin.username } })
    const customer = await prisma.customer.findFirstOrThrow({ where: { salesId: admin.id, status: 'COOPERATING' } })
    const total = await prisma.order.count()
    const createCount = countToReachLastSingle(total)
    const records = Array.from({ length: createCount }, (_, index) => ({
      id: randomUUID(),
      orderNo: `E2E-DEL-${runId}-${index}`,
      customerId: customer.id,
      salesId: admin.id,
      contractAmount: 100,
      paidAmount: 0,
      unpaidAmount: 100,
      createdAt: new Date(Date.UTC(2020, 0, 2, 0, index)),
    }))
    createdIds.push(...records.map((record) => record.id))
    await prisma.order.createMany({ data: records })

    const finalTotal = total + createCount
    const lastPage = Math.ceil(finalTotal / pageSize)
    const target = records[0]
    await openLastTablePage(page, '/finance/orders', '/api/finance/orders', lastPage)
    await expect(tableRow(page, target.orderNo)).toHaveCount(1)

    const deleteResponse = page.waitForResponse((response) => (
      response.request().method() === 'DELETE'
      && new URL(response.url()).pathname === `/api/finance/orders/${target.id}`
    ))
    await tableRow(page, target.orderNo).getByRole('button', { name: antText('删除') }).click()
    await clickModalPrimary(page)
    expect((await deleteResponse).status()).toBe(200)
    await expectSuccessMessage(page, '删除成功')
    await expect(page.locator(`.ant-pagination-item-${lastPage - 1}`)).toHaveClass(/ant-pagination-item-active/)
    await expect(tableRows(page)).toHaveCount(pageSize)
  })

  test('消息删除后从服务端补齐当前页并同步统计', async ({ page }) => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: accounts.admin.username } })
    const records = Array.from({ length: 21 }, (_, index) => ({
      id: randomUUID(),
      senderId: admin.id,
      receiverId: admin.id,
      title: `E2E删除消息-${runId}-${index}`,
      content: `E2E:${runId}`,
      createdAt: new Date(Date.UTC(2030, 0, 1, 0, index)),
    }))
    createdIds.push(...records.map((record) => record.id))
    await prisma.message.createMany({ data: records })
    const target = records.at(-1)!

    await page.goto('/messages')
    await expect(page.locator('.ant-list-item')).toHaveCount(20)
    const item = page.locator('.ant-list-item').filter({ hasText: target.title })
    const deleteResponse = page.waitForResponse((response) => (
      response.request().method() === 'DELETE'
      && new URL(response.url()).pathname === `/api/messages/${target.id}`
    ))
    await item.getByRole('button', { name: antText('删除') }).click()
    expect((await deleteResponse).status()).toBe(200)
    await expectSuccessMessage(page, '消息已删除')
    await expect(item).toHaveCount(0)
    await expect(page.locator('.ant-list-item')).toHaveCount(20)
    expect(await prisma.message.findUnique({ where: { id: target.id } })).toBeNull()
  })

  test('合同备案删除最后一条后回到上一页', async ({ page }) => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: accounts.admin.username } })
    const customer = await prisma.customer.findFirstOrThrow({ where: { salesId: admin.id, status: 'COOPERATING' } })
    const total = await prisma.contractArchive.count({ where: { customerId: customer.id, isLatest: true } })
    const createCount = countToReachLastSingle(total)
    const contractRoot = path.resolve(process.env.CRM_UPLOAD_DIR as string, 'contracts')
    const file = Buffer.from(`E2E contract deletion ${runId}`)
    const hash = createHash('sha256').update(file).digest('hex')
    const records = Array.from({ length: createCount }, (_, index) => {
      const id = randomUUID()
      const key = `${customer.id}/${id}.txt`
      contractKeys.push(key)
      return {
        id,
        archiveNo: `E2E-ARCH-${runId}-${index}`,
        customerId: customer.id,
        contractName: `E2E删除合同-${runId}-${index}`,
        version: 1,
        isLatest: true,
        fileName: `${id}.txt`,
        ossUrl: key,
        ossKey: key,
        fileSize: file.length,
        fileType: 'txt',
        fileHash: hash,
        archivedBy: admin.id,
        archivedAt: new Date(Date.UTC(2020, 0, 3, 0, index)),
        createdAt: new Date(Date.UTC(2020, 0, 3, 0, index)),
      }
    })
    createdIds.push(...records.map((record) => record.id))
    await Promise.all(records.map(async (record) => {
      const target = path.resolve(contractRoot, record.ossKey)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, file)
    }))
    await prisma.contractArchive.createMany({ data: records })

    await page.goto('/customers/cooperating')
    await searchCooperatingCustomers(page, customer.name)
    const customerRow = tableRow(page, customer.name)
    await customerRow.getByRole('button', { name: antText('合同备案') }).click()
    const dialog = page.getByRole('dialog', { name: new RegExp(`合同备案.*${customer.name}`) })
    const finalTotal = total + createCount
    const lastPage = Math.ceil(finalTotal / pageSize)
    const target = records[0]
    const pageResponse = page.waitForResponse((response) => (
      response.request().method() === 'GET'
      && new URL(response.url()).pathname === `/api/customers/${customer.id}/contract-archives`
      && new URL(response.url()).searchParams.get('page') === String(lastPage)
    ))
    await dialog.locator(`.ant-pagination-item-${lastPage}`).click()
    expect((await pageResponse).status()).toBe(200)
    const archiveRow = dialog.locator('.ant-table-tbody > tr[data-row-key]').filter({ hasText: target.contractName })
    await archiveRow.getByRole('button', { name: antText('删除') }).click()

    const deleteResponse = page.waitForResponse((response) => (
      response.request().method() === 'DELETE'
      && new URL(response.url()).pathname === `/api/contract-archives/${target.id}`
    ))
    await clickModalPrimary(page, '确认删除')
    expect((await deleteResponse).status()).toBe(200)
    await expectSuccessMessage(page, '删除成功')
    await expect(dialog.locator(`.ant-pagination-item-${lastPage - 1}`)).toHaveClass(/ant-pagination-item-active/)
    await expect(dialog.locator('.ant-table-tbody > tr[data-row-key]')).toHaveCount(pageSize)
  })
})
