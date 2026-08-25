'use client'

import '@ant-design/v5-patch-for-react-19'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'
import { crmTheme } from '@/theme/crmTheme'

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={zhCN} theme={crmTheme}>
      <NextAuthSessionProvider>
        {children}
      </NextAuthSessionProvider>
    </ConfigProvider>
  )
}
