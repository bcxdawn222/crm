'use client'

import { Card, Statistic, Row, Col, Progress } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

interface SalesOverviewData {
  monthlyRevenue: number
  monthlyOrders: number
  monthlyPayments: number
  monthlyNewCustomers: number
  revenueGrowth: number
  yearlyRevenue: number
  yearlyTarget: number
  targetCompletion: number
}

export default function SalesOverview({ data }: { data: SalesOverviewData }) {
  return (
    <div>
      {/* 本月业绩卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="本月合同金额" 
              value={data.monthlyRevenue} 
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
            {data.revenueGrowth !== 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                环比上月 
                <span style={{ color: data.revenueGrowth > 0 ? '#52c41a' : '#ff4d4f', marginLeft: 4 }}>
                  {data.revenueGrowth > 0 ? '+' : ''}{data.revenueGrowth}%
                </span>
              </div>
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="本月订单数" 
              value={data.monthlyOrders}
              suffix="单"
              valueStyle={{ fontSize: 24 }}
              prefix={data.revenueGrowth > 0 ? <ArrowUpOutlined /> : data.revenueGrowth < 0 ? <ArrowDownOutlined /> : null}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="本月收款" 
              value={data.monthlyPayments}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="新增客户" 
              value={data.monthlyNewCustomers}
              suffix="个"
              valueStyle={{ color: '#faad14', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 年度目标进度 */}
      <Card title="年度目标完成度">
        <Row gutter={16}>
          <Col span={16}>
            <Progress 
              percent={Math.min(data.targetCompletion, 100)} 
              status={data.targetCompletion >= 100 ? 'success' : 'active'}
              format={() => `${data.targetCompletion.toFixed(1)}%`}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                已完成: ¥{data.yearlyRevenue.toLocaleString()}
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>
                目标: ¥{data.yearlyTarget.toLocaleString()}
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  )
}
