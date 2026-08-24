'use client'

import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Button, Space, message } from 'antd'
import { DollarOutlined, RiseOutlined, FileTextOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

import { apiRequest } from '@/lib/http/client'

const { RangePicker } = DatePicker

interface FinanceSummary {
  totalOrders: number
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
  completionRate: number
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [summary, setSummary] = useState<FinanceSummary>({
    totalOrders: 0,
    totalAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    completionRate: 0,
  })

  // 加载统计数据
  const loadSummary = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
      })

      const data = await apiRequest<{ success: true; data: FinanceSummary }>(
        `/api/finance/reports/summary?${params}`,
      )
      setSummary(data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载财务报表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [dateRange])

  return (
    <div>
      <Card title="财务报表">
        {/* 日期筛选 */}
        <Space style={{ marginBottom: 24 }}>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]])
              }
            }}
          />
          <Button type="primary" onClick={loadSummary}>
            查询
          </Button>
        </Space>

        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="订单总数"
                value={summary.totalOrders}
                prefix={<FileTextOutlined />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="合同总金额"
                value={summary.totalAmount}
                precision={2}
                prefix={<DollarOutlined />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已收金额"
                value={summary.paidAmount}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#52c41a' }}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="未收金额"
                value={summary.unpaidAmount}
                precision={2}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>

        {/* 完成率 */}
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="收款完成率"
                value={summary.completionRate}
                precision={2}
                suffix="%"
                prefix={<RiseOutlined />}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  )
}
