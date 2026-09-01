import { expect, test } from '@playwright/test'

import { prisma } from '../support/database'
import { fixtureNames, marker, runId } from '../support/environment'
import { antText, expectSuccessMessage, searchCooperatingCustomers, searchCustomers, tableRow } from '../support/ui'

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const today = new Date()
const contractEnd = new Date(today)
contractEnd.setFullYear(contractEnd.getFullYear() + 1)
const contractEndDate = formatLocalDate(contractEnd)
const signDate = formatLocalDate(today)

test('浏览器完成销售 SOP 并保持数据库与审计一致', async ({ page }) => {
  const customerName = fixtureNames.telemarketing
  const followUpContent = `E2E SOP 跟进-${runId}`
  const cooperationNotes = `E2E SOP 合作维护-${runId}`
  const contractNo = `E2E-SOP-${runId}`

  await page.goto('/telemarketing')
  const telemarketingRow = tableRow(page, customerName)
  await expect(telemarketingRow).toBeVisible()
  const convertResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/telemarketing/convert'
  ))
  await telemarketingRow.getByRole('button', { name: antText('转入客户') }).click()
  await page.getByRole('dialog', { name: antText('转入我的客户') })
    .getByRole('button', { name: antText('确认转入') })
    .click()
  expect((await convertResponse).status()).toBe(201)
  await expectSuccessMessage(page, '已成功转入我的客户')

  const customer = await prisma.customer.findFirstOrThrow({
    where: { name: customerName, notes: { contains: marker } },
  })
  const telemarketing = await prisma.telemarketingList.findFirstOrThrow({
    where: { name: customerName },
  })
  expect(telemarketing.customerId).toBe(customer.id)
  expect(telemarketing.status).toBe('CONVERTED')

  await page.goto('/customers')
  await searchCustomers(page, customerName)
  let customerRow = tableRow(page, customerName)
  const detailResponse = page.waitForResponse((response) => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === `/api/customers/${customer.id}`
  ))
  await customerRow.getByRole('button', { name: antText('查看') }).click()
  expect((await detailResponse).status()).toBe(200)
  const detailDialog = page.getByRole('dialog', { name: antText('客户详情') })
  await detailDialog.getByRole('button', { name: antText('新增跟进') }).click()

  const followUpDialog = page.getByRole('dialog', { name: antText('新增跟进记录') })
  await followUpDialog.getByLabel('跟进内容').fill(followUpContent)
  await followUpDialog.getByLabel('跟进结果').fill('客户确认合作')
  await followUpDialog.getByLabel('下一步动作').fill('签约后创建订单并登记首款')
  const followUpResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === `/api/customers/${customer.id}/follow-ups`
  ))
  await followUpDialog.getByRole('button', { name: antText('保存跟进') }).click()
  expect((await followUpResponse).status()).toBe(200)
  await expectSuccessMessage(page, '跟进记录已保存')

  const followUp = await prisma.followUp.findFirstOrThrow({
    where: { customerId: customer.id, content: followUpContent },
  })
  const followedCustomer = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })
  expect(followedCustomer.lastFollowUpAt).not.toBeNull()

  await searchCustomers(page, customerName)
  customerRow = tableRow(page, customerName)
  await customerRow.getByRole('button', { name: antText('转已合作') }).click()
  const cooperationDialog = page.getByRole('dialog', { name: new RegExp(`标记为已合作.*${customerName}`) })
  const endDateInput = cooperationDialog.getByLabel('合同到期日期')
  await endDateInput.fill(contractEndDate)
  await endDateInput.press('Tab')
  await expect(endDateInput).toHaveValue(contractEndDate)
  await cooperationDialog.getByLabel('合同金额').fill('12000')
  const cooperationResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/customers/cooperating'
  ))
  await cooperationDialog.getByRole('button', { name: antText('确认转为已合作') }).click()
  expect((await cooperationResponse).status()).toBe(200)
  await expectSuccessMessage(page, '客户已转为已合作')

  const cooperatingCustomer = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })
  expect(cooperatingCustomer.status).toBe('COOPERATING')
  expect(Number(cooperatingCustomer.contractAmount)).toBe(12000)

  await page.goto('/customers/cooperating')
  await searchCooperatingCustomers(page, customerName)
  const cooperatingRow = tableRow(page, customerName)
  await expect(cooperatingRow).toBeVisible()
  await cooperatingRow.getByRole('button', { name: antText('编辑') }).click()
  const editDialog = page.getByRole('dialog', { name: antText('编辑合作信息') })
  await editDialog.getByLabel('合作备注').fill(cooperationNotes)
  const updateResponse = page.waitForResponse((response) => (
    response.request().method() === 'PUT'
    && new URL(response.url()).pathname === '/api/customers/cooperating'
  ))
  await editDialog.getByRole('button', { name: antText('保存') }).click()
  expect((await updateResponse).status()).toBe(200)
  await expectSuccessMessage(page, '更新成功')
  expect((await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).cooperationNotes)
    .toBe(cooperationNotes)

  await page.goto('/finance/orders')
  await page.getByRole('button', { name: antText('新增订单') }).click()
  const orderDialog = page.getByRole('dialog', { name: antText('新增订单') })
  const customerInput = orderDialog.getByRole('combobox', { name: /客户/ })
  await customerInput.fill(customerName)
  await page.locator('.ant-select-item-option-content').filter({ hasText: customerName }).click()
  await orderDialog.getByLabel('合同号').fill(contractNo)
  await orderDialog.getByLabel('合同金额').fill('12000')
  await orderDialog.getByLabel('签约日期').fill(signDate)
  const orderResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/finance/orders'
  ))
  await orderDialog.getByRole('button', { name: antText('创建') }).click()
  expect((await orderResponse).status()).toBe(201)
  await expectSuccessMessage(page, '创建成功')

  const order = await prisma.order.findFirstOrThrow({ where: { contractNo } })
  expect(order.customerId).toBe(customer.id)
  expect(Number(order.unpaidAmount)).toBe(12000)

  await page.goto('/finance/payments')
  const orderOptionsResponse = page.waitForResponse((response) => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/finance/orders'
  ))
  await page.getByRole('button', { name: antText('新增收款') }).click()
  expect((await orderOptionsResponse).status()).toBe(200)
  const paymentDialog = page.getByRole('dialog', { name: antText('新增收款记录') })
  await paymentDialog.getByRole('combobox', { name: /订单/ }).click()
  await page.locator('.ant-select-item-option-content').filter({ hasText: order.orderNo }).click()
  await paymentDialog.getByLabel('收款金额').fill('3000')
  const paymentResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/finance/payments'
  ))
  await paymentDialog.getByRole('button', { name: antText('创建') }).click()
  expect((await paymentResponse).status()).toBe(201)
  await expectSuccessMessage(page, '创建成功')

  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } })
  const paidOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
  expect(Number(payment.amount)).toBe(3000)
  expect(Number(paidOrder.paidAmount)).toBe(3000)
  expect(Number(paidOrder.unpaidAmount)).toBe(9000)

  await page.goto('/')
  await expect(page.getByText('本月订单数', { exact: true })).toBeVisible()
  await page.getByRole('link').filter({ has: page.getByRole('button', { name: antText('查看全部') }) }).click()
  await expect(page).toHaveURL(/\/reminders$/)
  await expect(page.getByText('智能提醒中心', { exact: true }).first()).toBeVisible()

  const auditReasons = new Set((await prisma.auditEvent.findMany({
    where: { entityId: { in: [telemarketing.id, customer.id, followUp.id, order.id, payment.id] } },
    select: { reason: true },
  })).map((event) => event.reason))
  for (const reason of [
    'TELEMARKETING_CONVERTED',
    'FOLLOW_UP_CREATED',
    'CUSTOMER_MARKED_COOPERATING',
    'COOPERATING_CUSTOMER_UPDATED',
    'ORDER_CREATED',
    'PAYMENT_CREATED',
  ]) {
    expect(auditReasons.has(reason), `缺少审计事件 ${reason}`).toBe(true)
  }
})
