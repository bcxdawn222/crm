import { expect, test } from '@playwright/test'

import { authStatePath, fixtureNames } from '../support/environment'
import { antText, searchCustomers, tableRow } from '../support/ui'


test.describe('销售页面权限与导航', () => {
  test.use({ storageState: authStatePath('sales') })

  test('销售可导航到文件页且客户动作按权限隐藏', async ({ page }) => {
    await page.goto('/customers')
    await searchCustomers(page, `${fixtureNames.salesPrefix}-05`)
    const row = tableRow(page, `${fixtureNames.salesPrefix}-05`)
    await expect(row.getByRole('button', { name: antText('编辑') })).toBeVisible()
    await expect(row.getByRole('button', { name: antText('归档') })).toBeVisible()
    await expect(row.getByRole('button', { name: antText('删除') })).toHaveCount(0)
    await expect(row.getByRole('button', { name: antText('转移') })).toHaveCount(0)

    await page.getByRole('link', { name: '文件共享' }).click()
    await expect(page).toHaveURL(/\/files$/)
    await expect(page.getByRole('main').getByText('文件共享', { exact: true })).toBeVisible()
  })

  test('销售无法读取管理员客户', async ({ page }) => {
    const response = await page.request.get(`/api/customers?page=1&pageSize=10&keyword=${encodeURIComponent(fixtureNames.adminCustomer)}`)
    expect(response.status()).toBe(200)
    expect((await response.json()).data.total).toBe(0)
  })
})

test.describe('主管数据范围', () => {
  test.use({ storageState: authStatePath('manager') })

  test('主管可读取本人和下属客户', async ({ page }) => {
    for (const name of [fixtureNames.managerCustomer, `${fixtureNames.salesPrefix}-06`]) {
      const response = await page.request.get(`/api/customers?page=1&pageSize=10&keyword=${encodeURIComponent(name)}`)
      expect(response.status()).toBe(200)
      expect((await response.json()).data.total).toBe(1)
    }
  })
})

test.describe('受限用户权限', () => {
  test.use({ storageState: authStatePath('restricted') })

  test('客户接口返回 403 且页面转到无权限页', async ({ page }) => {
    const response = await page.request.get('/api/customers?page=1&pageSize=10')
    expect(response.status()).toBe(403)
    expect(response.headers()['x-request-id']).toBeTruthy()

    await page.goto('/customers')
    await expect(page).toHaveURL(/\/403(?:\?|$)/)
    await expect(page.getByText('没有权限访问此页面', { exact: false })).toBeVisible()
  })
})
