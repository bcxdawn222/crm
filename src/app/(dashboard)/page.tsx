'use client'

import { Row, Col } from 'antd'
import dynamic from 'next/dynamic'
import KPICards from '@/components/dashboard/KPICards'
import SmartReminders from '@/components/dashboard/SmartReminders'

const RevenueTrendChart = dynamic(() => import('@/components/dashboard/RevenueTrendChart'), {
  ssr: false,
  loading: () => <div aria-hidden style={{ minHeight: 472 }} />,
})
const FunnelChart = dynamic(() => import('@/components/dashboard/FunnelChart'), {
  ssr: false,
  loading: () => <div aria-hidden style={{ minHeight: 472 }} />,
})

export default function DashboardPage() {
  return (
    <div style={{ padding: 24 }}>
      {/* 第一层: KPI核心指标卡片 */}
      <KPICards />
      
      {/* 第二层: 主要图表区 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <RevenueTrendChart />
        </Col>
        <Col xs={24} lg={8}>
          <FunnelChart />
        </Col>
      </Row>
      
      {/* 第三层: 智能提醒 */}
      <Row>
        <Col span={24}>
          <SmartReminders />
        </Col>
      </Row>
    </div>
  )
}
