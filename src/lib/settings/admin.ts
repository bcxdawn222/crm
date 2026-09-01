import { z } from 'zod'


export const systemSettingKeys = ['systemName', 'companyName'] as const
export type SystemSettingKey = (typeof systemSettingKeys)[number]

export interface SystemSettings {
  systemName: string
  companyName: string
}

export const defaultSystemSettings: SystemSettings = {
  systemName: 'CRM客户管理系统',
  companyName: '公司名称',
}

export const updateSystemSettingsSchema = z.object({
  systemName: z.string().trim().max(100, '系统名称不能超过 100 个字符'),
  companyName: z.string().trim().max(200, '公司名称不能超过 200 个字符'),
}).strict('设置字段不受支持')

export function systemSettingsFromRows(rows: Array<{ key: string; value: string }>): SystemSettings {
  const settings = { ...defaultSystemSettings }
  rows.forEach((row) => {
    if (row.key === 'systemName' || row.key === 'companyName') {
      settings[row.key] = row.value
    }
  })
  return settings
}
