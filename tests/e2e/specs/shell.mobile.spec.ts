import { expect, test } from '@playwright/test'

import { emptyFunnelResponse } from '../support/funnel'


test('手机端使用抽屉导航且页面无横向溢出', async ({ page }) => {
  await page.route('**/api/statistics/funnel', async (route) => {
    await route.fulfill({ json: emptyFunnelResponse })
  })
  await page.goto('/')
  await expect(page.locator('.crm-desktop-sidebar')).toBeHidden()
  await expect(page.getByRole('button', { name: '打开导航菜单' })).toBeVisible()
  const funnelCard = page.getByTestId('sales-funnel-card')
  await expect(funnelCard.getByText('销售漏斗', { exact: true })).toHaveCount(1)
  await expect(funnelCard.locator('svg')).toBeVisible()
  await expect(funnelCard.getByText('0个', { exact: true })).toHaveCount(5)
  await expect(funnelCard.getByText('线索客户', { exact: true })).toBeVisible()

  const viewportFits = await page.locator('body').evaluate((body) => (
    body.scrollWidth <= document.documentElement.clientWidth
  ))
  expect(viewportFits).toBe(true)

  await page.getByRole('button', { name: '打开导航菜单' }).click()
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
  await page.getByRole('menuitem', { name: '客户管理' }).click()
  await page.getByRole('link', { name: '我的客户' }).click()
  await expect(page).toHaveURL(/\/customers$/)
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeHidden()

  await page.getByRole('button', { name: '打开导航菜单' }).click()
  await page.getByRole('menuitem', { name: '系统管理' }).click()
  await page.getByRole('link', { name: '角色管理' }).click()
  await expect(page).toHaveURL(/\/admin\/roles$/)
  await expect(page.getByText('No permission to access')).toHaveCount(0)
  await expect.poll(async () => page.locator('.ant-table-tbody tr').count()).toBeGreaterThan(0)

  const rolePageFits = await page.locator('body').evaluate((body) => (
    body.scrollWidth <= document.documentElement.clientWidth
  ))
  expect(rolePageFits).toBe(true)
})
