import { expect, test } from '@playwright/test'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

import { accounts, authStatePath, runId } from '../support/environment'
import { prisma } from '../support/database'
import { antText, expectSuccessMessage, tableRow } from '../support/ui'


const fileBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test.describe('文件共享按钮', () => {
  test.use({ storageState: authStatePath('admin') })

  test('上传、下载和删除文件均写入真实存储、数据库和审计', async ({ page }) => {
    const originalName = `e2e-file-${runId}.png`
    let uploadCount = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/files') uploadCount += 1
    })

    await page.goto('/files')
    const uploadResponse = page.waitForResponse((response) => (
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/files'
    ))
    await page.locator('input[type="file"]').setInputFiles({
      name: originalName,
      mimeType: 'image/png',
      buffer: fileBytes,
    })
    expect((await uploadResponse).status()).toBe(201)
    await expectSuccessMessage(page, '文件上传成功')
    expect(uploadCount).toBe(1)
    await expect(tableRow(page, originalName)).toHaveCount(1)

    const admin = await prisma.user.findUniqueOrThrow({ where: { username: accounts.admin.username } })
    const file = await prisma.file.findFirstOrThrow({ where: { originalName, uploadedBy: admin.id } })
    const storedPath = path.resolve(process.env.CRM_UPLOAD_DIR as string, file.path)
    await expect(access(storedPath)).resolves.toBeUndefined()
    expect(await prisma.auditEvent.count({
      where: { entityId: file.id, action: 'FILE_UPLOADED', actorId: admin.id },
    })).toBe(1)

    const downloadPromise = page.waitForEvent('download')
    await tableRow(page, originalName).getByRole('link', { name: antText('下载') }).click()
    const download = await downloadPromise
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()
    expect(await readFile(downloadPath as string)).toEqual(fileBytes)
    await expect.poll(async () => (
      await prisma.file.findUniqueOrThrow({ where: { id: file.id } })
    ).downloadCount).toBe(1)

    await tableRow(page, originalName).getByRole('button', { name: antText('删除') }).click()
    const deleteResponse = page.waitForResponse((response) => (
      response.request().method() === 'DELETE'
      && new URL(response.url()).pathname === `/api/files/${file.id}`
    ))
    await page.locator('.ant-popconfirm .ant-btn-primary').click()
    expect((await deleteResponse).status()).toBe(200)
    await expectSuccessMessage(page, '文件已删除')
    expect(await prisma.file.findUnique({ where: { id: file.id } })).toBeNull()
    await expect(access(storedPath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await prisma.auditEvent.count({
      where: { entityId: file.id, action: 'FILE_DELETED', actorId: admin.id },
    })).toBe(1)
  })
})

test.describe('销售文件权限', () => {
  test.use({ storageState: authStatePath('sales') })

  test('销售可上传并下载自己的文件但看不到删除按钮', async ({ page }) => {
    const originalName = `e2e-sales-file-${runId}.png`
    await page.goto('/files')
    const uploadResponse = page.waitForResponse((response) => (
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/files'
    ))
    await page.locator('input[type="file"]').setInputFiles({
      name: originalName,
      mimeType: 'image/png',
      buffer: fileBytes,
    })
    expect((await uploadResponse).status()).toBe(201)
    const row = tableRow(page, originalName)
    await expect(row).toHaveCount(1)
    await expect(row.getByRole('link', { name: antText('下载') })).toBeVisible()
    await expect(row.getByRole('button', { name: antText('删除') })).toHaveCount(0)
  })
})
