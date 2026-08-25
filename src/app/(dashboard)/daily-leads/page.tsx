'use client'

import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Col, DatePicker, message, Modal, Row, Select, Space, Statistic } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'

import { usePermission } from '@/hooks/usePermission'
import { apiRequest } from '@/lib/http/client'
import { useTablePagination } from '@/hooks/useTablePagination'

import { CustomerDetailTable } from './customer-detail-table'
import { StatsTable } from './stats-table'
import type { DailyLeadCustomer, DailyLeadResponse, DailyLeadStat, SalesOption } from './types'

const { RangePicker } = DatePicker

export default function DailyLeadsPage() {
  const { can } = usePermission()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<DailyLeadStat[]>([])
  const [total, setTotal] = useState(0)
  const { page, pageSize, setPage, changePage } = useTablePagination()
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [salesId, setSalesId] = useState<string>()
  const [salesList, setSalesList] = useState<SalesOption[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<DailyLeadCustomer[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [modalVisible, setModalVisible] = useState(false)

  const loadSalesList = async () => {
    try {
      const response = await apiRequest<{ success: true; data: SalesOption[] }>('/api/users?role=sales&pageSize=100')
      setSalesList(response.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载销售人员失败')
    }
  }

  const loadStats = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (dateRange) {
        params.append('startDate', dateRange[0].format('YYYY-MM-DD'))
        params.append('endDate', dateRange[1].format('YYYY-MM-DD'))
      }
      if (salesId) params.append('salesId', salesId)
      const response = await apiRequest<DailyLeadResponse>(`/api/daily-leads?${params}`)
      setStats(response.data)
      setTotal(response.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载每日客资失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadSalesList() }, [])
  useEffect(() => { void loadStats() }, [page, pageSize, dateRange, salesId])

  const totalLeads = stats.reduce((sum, stat) => sum + stat.count, 0)
  const avgPerDay = stats.length > 0 ? Math.round(totalLeads / stats.length) : 0

  return (
    <Card title="每日新增客资统计">
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}><Card><Statistic title="总新增客资" value={totalLeads} suffix="个" valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={8}><Card><Statistic title="统计天数" value={stats.length} suffix="天" valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={8}><Card><Statistic title="日均新增" value={avgPerDay} suffix="个/天" valueStyle={{ color: '#cf1322' }} /></Card></Col>
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker
          value={dateRange}
          onChange={(dates) => { setDateRange(dates as [Dayjs, Dayjs] | null); setPage(1) }}
          placeholder={['开始日期', '结束日期']}
        />
        <Select
          placeholder="选择销售人员"
          style={{ width: 200 }}
          allowClear
          value={salesId}
          onChange={(value) => { setSalesId(value); setPage(1) }}
          options={salesList.map((sales) => ({ label: `${sales.realName} (${sales.username})`, value: sales.id }))}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={() => { setPage(1); void loadStats() }}>搜索</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setDateRange(null); setSalesId(undefined); setPage(1) }}>重置</Button>
      </Space>

      <StatsTable
        data={stats}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={changePage}
        onView={(record) => {
          setSelectedCustomers(record.customers)
          setSelectedDate(record.date)
          setModalVisible(true)
        }}
      />

      <Modal
        title={`${selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : ''} - ${selectedCustomers.length}个客户`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={1400}
        footer={null}
        destroyOnClose
      >
        <CustomerDetailTable
          customers={selectedCustomers}
          canUpdateCustomer={can('update', 'customer')}
          onTransfer={() => { void loadStats() }}
        />
      </Modal>
    </Card>
  )
}
