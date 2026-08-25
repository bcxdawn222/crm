import { expect, test } from '@playwright/test'

import { fixtureNames } from '../support/environment'
import { antText, searchCustomers, tableRow, tableRows } from '../support/ui'

test.describe('模块化页面回归', () => {
  test('客户查看模式只读且编辑模式保留保存入口', async ({ page }) => {
    await page.goto('/customers')
    await searchCustomers(page, fixtureNames.cooperatingCustomer)
    const row = tableRow(page, fixtureNames.cooperatingCustomer)
    await row.getByRole('button', { name: antText('查看') }).click()
    const viewDialog = page.getByRole('dialog', { name: antText('客户详情') })
    await expect(viewDialog).toBeVisible()
    await expect(viewDialog.getByRole('button', { name: antText('更新') })).toHaveCount(0)
    await viewDialog.locator('.ant-modal-close').click()
    await row.getByRole('button', { name: antText('编辑') }).click()
    await expect(page.getByRole('dialog', { name: antText('编辑客户') }).getByRole('button', { name: antText('更新') })).toBeVisible()
  })

  test('合作客户统计、编辑和合同备案入口可达', async ({ page }) => {
    const responsePromise = page.waitForResponse((response) => response.url().includes('/api/customers/cooperating?') && response.status() === 200)
    await page.goto('/customers/cooperating')
    await responsePromise
    await expect(page.getByText('已合作客户管理', { exact: true }).first()).toBeVisible()
    const row = tableRow(page, fixtureNames.cooperatingCustomer)
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: antText('编辑') }).click()
    await expect(page.getByRole('dialog', { name: antText('编辑合作信息') })).toBeVisible()
    await page.getByRole('dialog', { name: antText('编辑合作信息') }).getByRole('button', { name: antText('取消') }).click()
    await row.getByRole('button', { name: antText('合同备案') }).click()
    await expect(page.getByRole('dialog', { name: new RegExp(`合同备案.*${fixtureNames.cooperatingCustomer}`) })).toBeVisible()
  })

  test('提醒中心使用真实分组和统计结构渲染', async ({ page }) => {
    const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/reminders' && response.status() === 200)
    await page.goto('/reminders')
    await responsePromise
    await expect(page.getByText('智能提醒中心', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(fixtureNames.cooperatingCustomer).first()).toBeVisible()
    await expect(page.getByText(/合同金额:.*128,000/)).toBeVisible()
  })

  test('日报、每日客资和电销列表均能读取测试数据', async ({ page }) => {
    await page.goto('/daily-reports')
    await expect(page.getByText('日报管理', { exact: true }).first()).toBeVisible()
    await expect(tableRows(page).first()).toBeVisible()

    await page.goto('/daily-leads')
    await expect(page.getByText('每日新增客资统计', { exact: true }).first()).toBeVisible()
    await expect(tableRows(page).first()).toBeVisible()

    await page.goto('/telemarketing')
    await expect(page.getByText('电销名单管理', { exact: true }).first()).toBeVisible()
    await expect(tableRow(page, fixtureNames.telemarketing)).toBeVisible()
  })
})
