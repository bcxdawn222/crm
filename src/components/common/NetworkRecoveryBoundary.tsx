'use client'

import { Fragment, type ReactNode, useEffect, useState } from 'react'

import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import NetworkStatusBanner from './NetworkStatusBanner'

export default function NetworkRecoveryBoundary({ children }: { children: ReactNode }) {
  const { online, restored } = useNetworkStatus()
  const [refreshRevision, setRefreshRevision] = useState(0)

  useEffect(() => {
    if (restored) setRefreshRevision((current) => current + 1)
  }, [restored])

  return (
    <>
      <NetworkStatusBanner online={online} restored={restored} />
      <Fragment key={refreshRevision}>{children}</Fragment>
    </>
  )
}
