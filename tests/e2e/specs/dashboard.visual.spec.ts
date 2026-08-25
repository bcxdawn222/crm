import { expect, test } from '@playwright/test'

import { emptyFunnelResponse } from '../support/funnel'

const stageColors = [
  'rgb(37, 99, 235)',
  'rgb(15, 118, 110)',
  'rgb(217, 119, 6)',
  'rgb(220, 38, 38)',
  'rgb(71, 85, 105)',
]

test('销售漏斗全零时仍显示清晰阶梯且不改变真实标签', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.route('**/api/statistics/funnel', async (route) => {
    await route.fulfill({ json: emptyFunnelResponse })
  })

  await page.goto('/')
  const card = page.getByTestId('sales-funnel-card')
  await expect(card.getByText('销售漏斗', { exact: true })).toHaveCount(1)
  await expect(card.getByText('当前暂无客户', { exact: true })).toBeVisible()
  await expect(card.getByText('0个', { exact: true })).toHaveCount(5)
  await expect(card.getByText('线索客户', { exact: true })).toBeVisible()

  const widths = await card.locator('svg path').evaluateAll((paths, colors) => {
    const colorSet = new Set(colors as string[])
    return paths
      .filter((element) => colorSet.has(getComputedStyle(element).fill))
      .map((element) => element.getBoundingClientRect().width)
  }, stageColors)
  expect(widths).toHaveLength(5)
  expect(widths.at(-1)).toBeGreaterThan(70)
  for (let index = 1; index < widths.length; index += 1) {
    expect(widths[index]).toBeLessThan(widths[index - 1])
  }
})

test('仪表盘在关键宽度切换侧栏且没有横向溢出', async ({ page }) => {
  await page.route('**/api/statistics/funnel', async (route) => {
    await route.fulfill({ json: emptyFunnelResponse })
  })

  for (const viewport of [
    { width: 1280, height: 900, desktopSidebar: true },
    { width: 1024, height: 900, desktopSidebar: true },
    { width: 768, height: 900, desktopSidebar: false },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByTestId('sales-funnel-card')).toBeVisible()
    if (viewport.desktopSidebar) {
      await expect(page.locator('.crm-desktop-sidebar')).toBeVisible()
    } else {
      await expect(page.locator('.crm-desktop-sidebar')).toBeHidden()
      await expect(page.getByRole('button', { name: '打开导航菜单' })).toBeVisible()
    }
    const viewportFits = await page.locator('body').evaluate((body) => (
      body.scrollWidth <= document.documentElement.clientWidth
    ))
    expect(viewportFits, `${viewport.width}px 视口出现横向溢出`).toBe(true)
  }
})
