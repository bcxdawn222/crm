import { z } from 'zod'

const customerIdSchema = z.string().uuid('客户 ID 格式不正确')

export const disableReminderSchema = z.object({
  customerId: customerIdSchema,
  reason: z.preprocess(
    (value) => value === '' || value === null ? undefined : value,
    z.string().trim().max(500, '禁用原因不能超过 500 个字符').optional(),
  ),
})

export const enableReminderSchema = z.object({
  customerId: customerIdSchema,
})
