import path from 'node:path'


export type RoleKey = 'admin' | 'manager' | 'sales' | 'restricted'

export interface TestAccount {
  role: RoleKey
  username: string
  realName: string
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`缺少 ${name}`)
  return value
}

export function assertTestEnvironment(): void {
  if (required('CRM_PROFILE') !== 'test') throw new Error('E2E 只允许 test profile')
  const database = new URL(required('DATABASE_URL')).pathname.replace(/^\//, '').toLowerCase()
  if (!database.endsWith('_test')) throw new Error('E2E 数据库名称必须以 _test 结尾')
}

export const runId = required('CRM_E2E_RUN_ID')
if (!/^[a-f0-9]{12}$/i.test(runId)) throw new Error('CRM_E2E_RUN_ID 格式不正确')

export const marker = `E2E:${runId}`
export const password = required('CRM_E2E_PASSWORD')
export const baseURL = process.env.CRM_E2E_BASE_URL || 'http://localhost:3001'
export const outputRoot = path.resolve('output', 'playwright')
export const authRoot = path.join(outputRoot, 'auth')
export const settingsSnapshotPath = path.join(outputRoot, `settings-${runId}.json`)

export const accounts: Record<RoleKey, TestAccount> = {
  admin: { role: 'admin', username: `e2e_${runId}_admin`, realName: `E2E管理员-${runId}` },
  manager: { role: 'manager', username: `e2e_${runId}_manager`, realName: `E2E主管-${runId}` },
  sales: { role: 'sales', username: `e2e_${runId}_sales`, realName: `E2E销售-${runId}` },
  restricted: { role: 'restricted', username: `e2e_${runId}_restricted`, realName: `E2E受限-${runId}` },
}

export const fixtureNames = {
  salesPrefix: `E2E销售客户-${runId}`,
  managerCustomer: `E2E主管客户-${runId}`,
  adminCustomer: `E2E管理员客户-${runId}`,
  publicCustomer: `E2E公海客户-${runId}`,
}

export function authStatePath(role: RoleKey): string {
  return path.join(authRoot, `${role}.json`)
}
