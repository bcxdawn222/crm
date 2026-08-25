'use client'

import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={zhCN}>
      <NextAuthSessionProvider>
        {children}
      </NextAuthSessionProvider>
    </ConfigProvider>
  )
}
