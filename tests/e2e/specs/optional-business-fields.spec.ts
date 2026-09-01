import { expect, test } from '@playwright/test'

import { accounts, authStatePath, fixtureNames } from '../support/environment'
import { prisma } from '../support/database'

test.describe('业务表单字段可留空', () => {
  test.use({ storageState: authStatePath('sales') })

  test('普通业务内容为空时仍可保存', async ({ page }) => {
    const sales = await prisma.user.findFirstOrThrow({
      where: { username: accounts.sales.username },
    })
    const customer = await prisma.customer.findFirstOrThrow({
      where: { name: fixtureNames.salesPrefix + '-01' },
    })
    const reportDate = new Date('2030-01-01T00:00:00.000Z')
    await prisma.dailyReport.deleteMany({ where: { userId: sales.id, reportDate } })

    const telemarketing = await page.request.post('/api/telemarketing', {
      data: { name: '', phone: '' },
    })
    expect(telemarketing.status()).toBe(201)

    const followUp = await page.request.post(`/api/customers/${customer.id}/follow-ups`, {
      data: { type: 'PHONE', content: '' },
    })
    expect(followUp.status()).toBe(200)

    const task = await page.request.post('/api/tasks', {
      data: { title: '', assigneeId: sales.id },
    })
    expect(task.status()).toBe(200)

    const report = await page.request.post('/api/daily-reports', {
      data: { reportDate: '2030-01-01', content: '' },
    })
    expect(report.status()).toBe(200)

    const telemarketingId = (await telemarketing.json() as { data: { id: string } }).data.id
    const followUpId = (await followUp.json() as { data: { id: string } }).data.id
    const taskId = (await task.json() as { data: { id: string } }).data.id
    const reportId = (await report.json() as { data: { id: string } }).data.id
    await prisma.$transaction([
      prisma.telemarketingList.delete({ where: { id: telemarketingId } }),
      prisma.followUp.delete({ where: { id: followUpId } }),
      prisma.task.delete({ where: { id: taskId } }),
      prisma.dailyReport.delete({ where: { id: reportId } }),
    ])
  })
})
