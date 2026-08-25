import { expect, type Page } from '@playwright/test'


export function antText(text: string): RegExp {
  const escapedCharacters = Array.from(text, (character) => (
    character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ))
  return new RegExp(escapedCharacters.join('\\s*'))
}

export function tableRow(page: Page, text: string) {
  return page.locator('.ant-table-tbody > tr[data-row-key]').filter({ hasText: text })
}

export function tableRows(page: Page) {
  return page.locator('.ant-table-tbody > tr[data-row-key]')
}

export async function searchCustomers(page: Page, keyword: string): Promise<void> {
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
    && response.url().includes('/api/customers?')
    && response.url().includes(`keyword=${encodeURIComponent(keyword)}`)
  ))
  await page.getByPlaceholder('搜索姓名、公司、电话').fill(keyword)
  await page.getByRole('button', { name: antText('搜索') }).click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
}

export async function clickModalPrimary(page: Page, name?: string): Promise<void> {
  const dialog = page.locator('.ant-modal-confirm').filter({ visible: true })
  if (name) {
    await dialog.getByRole('button', { name: antText(name) }).click()
    return
  }
  await dialog.locator('.ant-modal-confirm-btns .ant-btn-primary').click()
}

export async function expectSuccessMessage(page: Page, text: string): Promise<void> {
  await expect(page.locator('.ant-message-notice-content').filter({ hasText: text })).toBeVisible()
}
