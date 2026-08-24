'use client'

const DRAFT_PREFIX = 'crm:form-draft:'
const DRAFT_VERSION = 1
export const DEFAULT_DRAFT_TTL_MS = 12 * 60 * 60 * 1000

interface DraftEnvelope {
  version: number
  expiresAt: number
  payload: unknown
}

function storageKey(key: string): string {
  return `${DRAFT_PREFIX}${key}`
}

function isDraftEnvelope(value: unknown): value is DraftEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<DraftEnvelope>
  return candidate.version === DRAFT_VERSION
    && typeof candidate.expiresAt === 'number'
    && 'payload' in candidate
}

export function saveDraft<T>(key: string, payload: T, ttlMs = DEFAULT_DRAFT_TTL_MS): void {
  if (typeof window === 'undefined') return
  try {
    const envelope: DraftEnvelope = {
      version: DRAFT_VERSION,
      expiresAt: Date.now() + ttlMs,
      payload,
    }
    window.sessionStorage.setItem(storageKey(key), JSON.stringify(envelope))
  } catch (error) {
    console.warn('表单草稿保存失败', error)
  }
}

export function readDraft<T>(key: string, validate: (value: unknown) => value is T): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isDraftEnvelope(parsed) || parsed.expiresAt <= Date.now() || !validate(parsed.payload)) {
      window.sessionStorage.removeItem(storageKey(key))
      return null
    }
    return parsed.payload
  } catch (error) {
    console.warn('表单草稿读取失败', error)
    window.sessionStorage.removeItem(storageKey(key))
    return null
  }
}

export function clearDraft(key: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(storageKey(key))
}

export function clearAllDrafts(): void {
  if (typeof window === 'undefined') return
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index)
    if (key?.startsWith(DRAFT_PREFIX)) window.sessionStorage.removeItem(key)
  }
}
