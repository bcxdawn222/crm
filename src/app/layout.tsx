import type { Metadata } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { SessionProvider } from '@/components/providers/SessionProvider'
import PageLoadRecovery from '@/components/common/PageLoadRecovery'
import './globals.css'

export const metadata: Metadata = {
  title: 'CRM系统',
  description: '企业级客户关系管理系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <SessionProvider>
            <PageLoadRecovery />
            {children}
          </SessionProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
