'use client'

import { BellOutlined } from '@ant-design/icons'
import { Alert, Col, Row, Statistic } from 'antd'
import dayjs from 'dayjs'

import type { CooperatingCustomer } from './types'

export function CooperatingSummary(props: { data: CooperatingCustomer[]; reminders: CooperatingCustomer[]; total: number }) {
  const visitsThisMonth = props.data.filter((customer) => {
    if (!customer.nextVisitAt) return false
    const nextVisit = dayjs(customer.nextVisitAt)
    const today = dayjs()
    return nextVisit.month() === today.month() && nextVisit.year() === today.year()
  }).length
  const currentPageAmount = props.data.reduce((sum, customer) => sum + Number(customer.contractAmount || 0), 0)

  return (
    <>
      {props.reminders.length > 0 && (
        <Alert message={`有 ${props.reminders.length} 个客户合同即将到期`} description="请及时联系客户进行续签" type="warning" showIcon icon={<BellOutlined />} style={{ marginBottom: 16 }} />
      )}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}><Statistic title="已合作客户总数" value={props.total} valueStyle={{ color: '#3f8600' }} /></Col>
        <Col xs={12} lg={6}><Statistic title="即将到期" value={props.reminders.length} valueStyle={{ color: props.reminders.length > 0 ? '#cf1322' : '#3f8600' }} /></Col>
        <Col xs={12} lg={6}><Statistic title="本月需回访" value={visitsThisMonth} valueStyle={{ color: '#1890ff' }} /></Col>
        <Col xs={12} lg={6}><Statistic title="当前页合同金额" value={currentPageAmount} precision={2} prefix="¥" valueStyle={{ color: '#722ed1' }} /></Col>
      </Row>
    </>
  )
}
