'use client'

import { Layout } from 'antd'
import Sidebar from '@/components/common/Sidebar'
import AppHeader from '@/components/common/Header'
import NetworkRecoveryBoundary from '@/components/common/NetworkRecoveryBoundary'
import { useUIStore } from '@/stores/uiStore'

const { Content } = Layout

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const collapsed = useUIStore((state) => state.sidebarCollapsed)

  return (
    <Layout className="crm-app-shell" style={{ minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} />
      <Layout className="crm-main-layout" style={{ marginLeft: collapsed ? 80 : 200 }}>
        <AppHeader userName="用户" />
        <Content
          className="crm-page-content"
          style={{
            margin: '84px 16px 16px',
            padding: 24,
            minHeight: 280,
          }}
        >
          <NetworkRecoveryBoundary>{children}</NetworkRecoveryBoundary>
        </Content>
      </Layout>
    </Layout>
  )
}
