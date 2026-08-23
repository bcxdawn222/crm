'use client'

import { Row, Col } from 'antd'
import KPICards from '@/components/dashboard/KPICards'
import RevenueTrendChart from '@/components/dashboard/RevenueTrendChart'
import FunnelChart from '@/components/dashboard/FunnelChart'
import SmartReminders from '@/components/dashboard/SmartReminders'

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