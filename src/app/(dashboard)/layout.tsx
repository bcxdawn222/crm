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
  const mobileOpen = useUIStore((state) => state.mobileSidebarOpen)
  const closeMobileSidebar = useUIStore((state) => state.closeMobileSidebar)

  return (
    <Layout className="crm-app-shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobileSidebar}
      />
      <Layout className={`crm-main-layout${collapsed ? ' crm-main-layout--collapsed' : ''}`}>
        <AppHeader />
        <Content className="crm-page-content">
          <NetworkRecoveryBoundary>{children}</NetworkRecoveryBoundary>
        </Content>
      </Layout>
    </Layout>
  )
}
