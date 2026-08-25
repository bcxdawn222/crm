'use client'

import { Card, Col, Progress, Row, Statistic } from 'antd'

import type { QuotaStatus } from './types'

export function QuotaCard({ status }: { status: QuotaStatus | null }) {
  if (!status || status.isAdmin) return null
  const usagePercent = (status.usage.activeCount / status.quota.maxActiveCustomers) * 100
  return (
    <Card style={{ marginBottom: 16, background: '#f0f5ff' }} size="small">
      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title="当前活跃客户"
            value={status.usage.activeCount}
            suffix={`/ ${status.quota.maxActiveCustomers}`}
            valueStyle={{ color: usagePercent >= 90 ? '#ff4d4f' : '#3f8600' }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="今日已认领"
            value={status.usage.todayClaims}
            suffix={`/ ${status.quota.maxDailyClaims}`}
            valueStyle={{ color: status.usage.todayClaims >= status.quota.maxDailyClaims ? '#ff4d4f' : '#3f8600' }}
          />
        </Col>
        <Col span={8}>
          <div style={{ marginTop: 8 }}>
            <Progress percent={usagePercent} size="small" status={usagePercent >= 100 ? 'exception' : 'normal'} format={(percent) => `${percent?.toFixed(0)}%`} />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>客户容量使用率</div>
          </div>
        </Col>
      </Row>
    </Card>
  )
}
