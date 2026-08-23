'use client'

import { useEffect, useState } from 'react'

interface NetworkStatus {
  online: boolean
  restored: boolean
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({ online: true, restored: false })

  useEffect(() => {
    const updateOnline = () => setStatus({ online: true, restored: true })
    const updateOffline = () => setStatus({ online: false, restored: false })
    setStatus({ online: navigator.onLine, restored: false })
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOffline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOffline)
    }
  }, [])

  useEffect(() => {
    if (!status.restored) return
    const timer = window.setTimeout(() => setStatus((current) => ({ ...current, restored: false })), 5000)
    return () => window.clearTimeout(timer)
  }, [status.restored])

  return status
}
