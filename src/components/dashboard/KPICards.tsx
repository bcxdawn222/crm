'use client'

import { Card, Row, Col, Statistic, Spin } from 'antd'
import { 
  DollarOutlined, 
  ShoppingCartOutlined, 
  TeamOutlined,
  RiseOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { apiRequest } from '@/lib/http/client'

interface KPIData {
  monthlyRevenue: number
  monthlyOrders: number
  monthlyNewCustomers: number
  revenueGrowth: number
}

export default function KPICards() {
  const [data, setData] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadKPIData()
  }, [])

  const loadKPIData = async () => {
    try {
      setLoading(true)
      // 复用销售业绩总览API
      const result = await apiRequest<{ success: true; data: KPIData }>(
        '/api/statistics/sales-overview'
      )
      setData(result.data)
    } catch (error) {
      console.error('Failed to load KPI data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <Col key={i} span={6}>
            <Card loading />
          </Col>
        ))}
      </Row>
    )
  }

  if (!data) {
    return null
  }

  const kpiCards = [
    {
      title: '本月合同金额',
      value: data.monthlyRevenue,
      prefix: <DollarOutlined />,
      suffix: '元',
      trend: data.revenueGrowth,
      accent: '#1677ff',
    },
    {
      title: '本月订单数',
      value: data.monthlyOrders,
      prefix: <ShoppingCartOutlined />,
      suffix: '单',
      accent: '#0f766e',
    },
    {
      title: '新增客户',
      value: data.monthlyNewCustomers,
      prefix: <TeamOutlined />,
      suffix: '个',
      accent: '#b45309',
    },
    {
      title: '订单 / 新增客户',
      value: data.monthlyNewCustomers > 0
        ? data.monthlyOrders / data.monthlyNewCustomers
        : 0,
      prefix: <RiseOutlined />,
      suffix: '单/客',
      precision: 2,
      accent: '#475569',
    }
  ]

  return (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      {kpiCards.map((card, index) => (
        <Col key={index} xs={24} sm={12} md={12} lg={6}>
          <Card 
            className="kpi-card"
            style={{
              border: '1px solid #e2e8f0',
              borderTop: `3px solid ${card.accent}`,
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            bodyStyle={{ padding: '20px' }}
            hoverable
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: 14, 
                  color: '#64748b',
                  marginBottom: 8 
                }}>
                  {card.title}
                </div>
                <div style={{ 
                  fontSize: 32, 
                  fontWeight: 'bold', 
                  color: '#0f172a',
                  marginBottom: 8
                }}>
                  {card.prefix}
                  {' '}
                  {typeof card.value === 'number' && card.precision 
                    ? card.value.toFixed(card.precision)
                    : typeof card.value === 'number'
                    ? card.value.toLocaleString()
                    : card.value
                  }
                  {' '}
                  {card.suffix}
                </div>
                <div style={{ 
                  fontSize: 13, 
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  {typeof card.trend === 'number' && card.trend > 0 ? (
                    <>
                      <ArrowUpOutlined />
                      <span>↑ {Math.abs(card.trend)}% 较上月</span>
                    </>
                  ) : typeof card.trend === 'number' && card.trend < 0 ? (
                    <>
                      <ArrowDownOutlined />
                      <span>↓ {Math.abs(card.trend)}% 较上月</span>
                    </>
                  ) : (
                    <span>{typeof card.trend === 'number' ? '- 持平' : '按当前月份数据计算'}</span>
                  )}
                </div>
              </div>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: 12,
                background: `${card.accent}12`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                color: card.accent
              }}>
                {card.prefix}
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  )
}
