'use client'

import { useEffect } from 'react'

const RECOVERY_PREFIX = 'crm:page-load-recovery:'
const RECOVERY_WINDOW_MS = 30_000
const CHUNK_FAILURE = /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i

function errorText(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`
  return typeof value === 'string' ? value : ''
}

function isStaticAssetFailure(event: ErrorEvent): boolean {
  if (CHUNK_FAILURE.test(`${event.message} ${errorText(event.error)}`)) return true
  const target = event.target
  if (target instanceof HTMLScriptElement) return target.src.includes('/_next/static/')
  if (target instanceof HTMLLinkElement) return target.href.includes('/_next/static/')
  return false
}

export default function PageLoadRecovery() {
  useEffect(() => {
    const recover = () => {
      try {
        const key = `${RECOVERY_PREFIX}${window.location.pathname}`
        const recoveredAt = Number(sessionStorage.getItem(key) || '0')
        if (Date.now() - recoveredAt < RECOVERY_WINDOW_MS) return
        sessionStorage.setItem(key, String(Date.now()))
      } catch {
        return
      }
      window.location.reload()
    }
    const handleError = (event: ErrorEvent) => {
      if (isStaticAssetFailure(event)) recover()
    }
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (CHUNK_FAILURE.test(errorText(event.reason))) recover()
    }
    window.addEventListener('error', handleError, true)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError, true)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}
