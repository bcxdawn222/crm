import { expect, test } from '@playwright/test'

import { accounts, authStatePath } from '../support/environment'

test.describe('每日新增客资销售筛选', () => {
  test.describe('普通销售', () => {
    test.use({ storageState: authStatePath('sales') })

    test('销售人员下拉至少显示当前销售本人', async ({ page }) => {
      await page.goto('/daily-leads')
      const salesSelect = page.locator('.ant-select').filter({
        has: page.getByText('选择销售人员', { exact: true }),
      })
      await salesSelect.click()

      await expect(
        page.locator('.ant-select-item-option-content').filter({ hasText: accounts.sales.realName })
      ).toBeVisible()
    })
  })

  test.describe('销售主管', () => {
    test.use({ storageState: authStatePath('manager') })

    test('销售人员下拉显示主管本人和下属销售', async ({ page }) => {
      await page.goto('/daily-leads')
      const salesSelect = page.locator('.ant-select').filter({
        has: page.getByText('选择销售人员', { exact: true }),
      })
      await salesSelect.click()

      await expect(
        page.locator('.ant-select-item-option-content').filter({ hasText: accounts.manager.realName })
      ).toBeVisible()
      await expect(
        page.locator('.ant-select-item-option-content').filter({ hasText: accounts.sales.realName })
      ).toBeVisible()
      await expect(
        page.locator('.ant-select-item-option-content').filter({ hasText: accounts.admin.realName })
      ).toHaveCount(0)
    })
  })
})
