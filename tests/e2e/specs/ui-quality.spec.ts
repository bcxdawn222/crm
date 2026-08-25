import { expect, test } from '@playwright/test'


const routes = [
  '/',
  '/reminders',
  '/statistics',
  '/customers',
  '/public-pool',
  '/daily-leads',
  '/telemarketing',
  '/customers/cooperating',
  '/finance/orders',
  '/finance/payments',
  '/finance/reports',
  '/daily-reports',
  '/messages',
  '/tasks',
  '/files',
  '/admin/users',
  '/admin/roles',
  '/admin/settings',
]

const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 900 },
  { width: 1024, height: 900 },
  { width: 768, height: 900 },
  { width: 390, height: 844 },
]


test('18 个页面在五档视口无整体溢出且按钮名称可读', async ({ page }) => {
  test.setTimeout(240_000)
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('main')).toBeVisible()
      const result = await page.evaluate(() => {
        const width = document.documentElement.clientWidth
        const bodyFits = document.body.scrollWidth <= width + 1
        const unnamedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
          .filter((button) => {
            const style = getComputedStyle(button)
            if (style.display === 'none' || style.visibility === 'hidden') return false
            const box = button.getBoundingClientRect()
            if (box.width === 0 || box.height === 0) return false
            return !(
              button.innerText.trim()
              || button.getAttribute('aria-label')
              || button.title
              || button.querySelector('[aria-label]')
            )
          })
          .map((button) => button.outerHTML.slice(0, 160))
        return { bodyFits, unnamedButtons }
      })
      expect(result.bodyFits, `${viewport.width}px ${route} 页面整体横向溢出`).toBe(true)
      expect(result.unnamedButtons, `${viewport.width}px ${route} 存在无名称按钮`).toEqual([])
    }
  }
})

test('键盘焦点、表单标签和 reduced-motion 状态可识别', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/admin/settings')
  await expect(page.getByLabel('系统名称')).toBeVisible()
  await expect(page.getByLabel('公司名称')).toBeVisible()

  const menuButton = page.getByRole('button', { name: '收起侧边栏' })
  await menuButton.focus()
  await expect(menuButton).toBeFocused()
  const focusStyle = await menuButton.evaluate((element) => {
    const style = getComputedStyle(element)
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }
  })
  expect(focusStyle.outlineStyle).not.toBe('none')
  expect(focusStyle.outlineWidth).not.toBe('0px')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const transition = await page.locator('.crm-main-layout').evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(transition).toBe('0s')
})
