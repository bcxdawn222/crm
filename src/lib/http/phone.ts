const MOBILE = /^1[3-9]\d{9}$/
const LANDLINE = /^0\d{2,3}-?\d{7,8}$/

export const CRM_PHONE_MESSAGE = '请输入有效的手机号或座机号'

export function normalizeCrmPhone(value: string): string {
  return value.replace(/\s+/g, '')
}

export function isCrmPhone(value: string): boolean {
  const phone = normalizeCrmPhone(value)
  return MOBILE.test(phone) || LANDLINE.test(phone)
}
