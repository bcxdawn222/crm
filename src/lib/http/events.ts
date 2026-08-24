'use client'

export const SESSION_EXPIRED_EVENT = 'crm:session-expired'

export function notifySessionExpired(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}
