'use client'

import { useState, useEffect } from 'react'
import { Card, Table, DatePicker, Select, Space, Statistic, Row, Col, Tag, Button, Typography, message, Modal } from 'antd'
import { SearchOutlined, ReloadOutlined, UserAddOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import { Resizable } from 'react-resizable'
import 'react-resizable/css/styles.css'

const { RangePicker } = DatePicker
const { Text } = Typography

// 可拖动的表头组件
const ResizableTitle = (props: any) => {
  const { onResize, width, ...restProps } = props

  if (!width) {
    return <th {...restProps} />
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          style={{
            position: 'absolute',
            right: -5,
            top: 0,
            bottom: 0,
            width: 10,
            cursor: 'col-resize',
            zIndex: 100,
            padding: 0,
            margin: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th 
        {...restProps} 
        style={{ 
          position: 'relative', 
          overflow: 'visible',
          paddingRight: 8,
        }} 
      />
    </Resizable>
  )
}

interface Customer {
  id: string
  name: string
  company?: string
  phone?: string
  email?: string
  level: string
  source?: string
  notes?: string
  createdAt: string
  isPublic?: boolean
  sales?: {
    id: string
    realName: string
    username: string
  }
}

interface DailyLeadStat {
  date: string
  count: number
  customers: Customer[]
  byLevel: {
    POTENTIAL: number
    NORMAL: number
    IMPORTANT: number
    VIP: number
  }
  bySource: Record<string, number>
}

export default function DailyLeadsPage() {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<DailyLeadStat[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [salesId, setSalesId] = useState<string | undefined>(undefined)
  const [salesList, setSalesList] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    date: 120,
    count: 100,
    byLevel: 250,
    bySource: 250,
    action: 100,
  })

  // Load sales list
  useEffect(() => {
    loadSalesList()
  }, [])

  const loadSalesList = async () => {
    try {
      const res = await fetch('/api/users?role=sales')
      if (res.ok) {
        const data = await res.json()
        setSalesList(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load sales list:', error)
    }
  }

  // Load daily leads statistics
  const loadStats = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })

      if (dateRange) {
        params.append('startDate', dateRange[0].format('YYYY-MM-DD'))
        params.append('endDate', dateRange[1].format('YYYY-MM-DD'))
      }

      if (salesId) {
        params.append('salesId', salesId)
      }

      const res = await fetch(`/api/daily-leads?${params}`)
      const data = await res.json()

      if (data.success) {
        setStats(data.data)
        setTotal(data.total)
      } else {
        throw new Error(data.error || 'Failed to load data')
      }
    } catch (error: any) {
      console.error('Failed to load daily leads:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [page, pageSize, dateRange, salesId])

  // 处理列宽度调整
  const handleResize = (key: string) => (_: any, { size }: { size: { width: number } }) => {
    setColumnWidths((prev) => ({
      ...prev,
      [key]: size.width,
    }))
  }

  // Calculate summary statistics
  const totalLeads = stats.reduce((sum, stat) => sum + stat.count, 0)
  const avgPerDay = stats.length > 0 ? Math.round(totalLeads / stats.length) : 0

  // Table columns for daily stats
  const columns: ColumnsType<DailyLeadStat> = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: columnWidths.date,
      fixed: 'left',
      render: (text) => dayjs(text).format('YYYY-MM-DD'),
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '新增数量',
      dataIndex: 'count',
      key: 'count',
      width: columnWidths.count,
      sorter: (a, b) => a.count - b.count,
      render: (count) => (
        <Statistic value={count} valueStyle={{ fontSize: 16 }} />
      ),
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '客户等级分布',
      key: 'byLevel',
      width: columnWidths.byLevel,
      render: (_, record) => (
        <Space wrap>
          {record.byLevel.POTENTIAL > 0 && (
            <Tag color="default">潜在: {record.byLevel.POTENTIAL}</Tag>
          )}
          {record.byLevel.NORMAL > 0 && (
            <Tag color="blue">普通: {record.byLevel.NORMAL}</Tag>
          )}
          {record.byLevel.IMPORTANT > 0 && (
            <Tag color="orange">重要: {record.byLevel.IMPORTANT}</Tag>
          )}
          {record.byLevel.VIP > 0 && (
            <Tag color="red">VIP: {record.byLevel.VIP}</Tag>
          )}
        </Space>
      ),
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '来源分布',
      key: 'bySource',
      width: columnWidths.bySource,
      render: (_, record) => (
        <Space wrap>
          {Object.entries(record.bySource).map(([source, count]) => (
            <Tag key={source}>
              {getSourceLabel(source)}: {count}
            </Tag>
          ))}
        </Space>
      ),
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '操作',
      key: 'action',
      width: columnWidths.action,
      fixed: 'right',
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            setSelectedCustomers(record.customers)
            setSelectedDate(record.date)
            setModalVisible(true)
          }}
        >
          查看详情 ({record.count}个客户)
        </Button>
      ),
    },
  ]

  return (
    <div>
      {/* 自定义样式 */}
      <style jsx global>{`
        .react-resizable-handle {
          position: absolute !important;
          right: -5px !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 10px !important;
          cursor: col-resize !important;
          z-index: 100 !important;
          background-color: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .react-resizable-handle:hover {
          background-color: rgba(24, 144, 255, 0.5) !important;
          border-left: 2px solid #1890ff !important;
        }
        .react-resizable-handle::before {
          content: '' !important;
          position: absolute !important;
          left: 50% !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 1px !important;
          background-color: #e8e8e8 !important;
        }
        th.ant-table-cell {
          position: relative !important;
          overflow: visible !important;
        }
      `}</style>
      
      <Card title="每日新增客资统计">
        {/* Summary Statistics */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="总新增客资"
                value={totalLeads}
                suffix="个"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="统计天数"
                value={stats.length}
                suffix="天"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="日均新增"
                value={avgPerDay}
                suffix="个/天"
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              setDateRange(dates as [Dayjs, Dayjs] | null)
              setPage(1)
            }}
            placeholder={['开始日期', '结束日期']}
          />
          <Select
            placeholder="选择销售人员"
            style={{ width: 200 }}
            allowClear
            value={salesId}
            onChange={(value) => {
              setSalesId(value)
              setPage(1)
            }}
          >
            {salesList.map(sales => (
              <Select.Option key={sales.id} value={sales.id}>
                {sales.realName} ({sales.username})
              </Select.Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              setPage(1)
              loadStats()
            }}
          >
            搜索
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setDateRange(null)
              setSalesId(undefined)
              setPage(1)
            }}
          >
            重置
          </Button>
        </Space>

        {/* Data Table */}
        <Table
          columns={columns}
          dataSource={stats}
          rowKey="date"
          loading={loading}
          components={{
            header: {
              cell: ResizableTitle,
            },
          }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 天`,
            onChange: (newPage, newPageSize) => {
              setPage(newPage)
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize)
                setPage(1)
              }
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Modal for customer details */}
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
          onTransfer={(customerId) => {
            // Refresh the stats after transfer
            loadStats()
          }}
        />
      </Modal>
    </div>
  )
}

// Sub-component for customer detail table
function CustomerDetailTable({ customers, onTransfer }: { customers: Customer[], onTransfer?: (customerId: string) => void }) {
  const [transferring, setTransferring] = useState<string | null>(null)

  const handleTransfer = async (customerId: string) => {
    Modal.confirm({
      title: '确认转入我的客户',
      content: '确定要将此客户转入您的名下吗?',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setTransferring(customerId)
        try {
          const res = await fetch('/api/customers/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId }),
          })
          const data = await res.json()
          if (data.success) {
            message.success('客户已成功转入您的名下')
            onTransfer?.(customerId)
          } else {
            message.error(data.error || '转移失败')
          }
        } catch (error) {
          console.error('Transfer failed:', error)
          message.error('网络错误,请稍后重试')
        } finally {
          setTransferring(null)
        }
      },
    })
  }

  const customerColumns: ColumnsType<Customer> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      width: 150,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 180,
    },
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level) => (
        <Tag color={getLevelColor(level)}>
          {getLevelLabel(level)}
        </Tag>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source) => getSourceLabel(source),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      ellipsis: true,
      render: (notes) => (
        <Typography.Text ellipsis={{ tooltip: notes }} style={{ maxWidth: 200 }}>
          {notes || '-'}
        </Typography.Text>
      ),
    },
    {
      title: '销售',
      dataIndex: 'sales',
      key: 'sales',
      width: 100,
      render: (sales) => sales?.realName || '-',
    },
    {
      title: '状态',
      dataIndex: 'isPublic',
      key: 'isPublic',
      width: 80,
      render: (isPublic) => (
        <Tag color={isPublic ? 'orange' : 'green'}>
          {isPublic ? '公海池' : '我的客户'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<UserAddOutlined />}
          loading={transferring === record.id}
          disabled={!record.isPublic}
          onClick={() => handleTransfer(record.id)}
        >
          转入我的客户
        </Button>
      ),
    },
  ]

  return (
    <Table
      columns={customerColumns}
      dataSource={customers}
      rowKey="id"
      size="small"
      pagination={false}
      scroll={{ x: 1200 }}
    />
  )
}

// Helper functions
function getLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    POTENTIAL: '潜在',
    NORMAL: '普通',
    IMPORTANT: '重要',
    VIP: 'VIP',
  }
  return labels[level] || level
}

function getLevelColor(level: string): string {
  const colors: Record<string, string> = {
    POTENTIAL: 'default',
    NORMAL: 'blue',
    IMPORTANT: 'orange',
    VIP: 'red',
  }
  return colors[level] || 'default'
}

function getSourceLabel(source?: string): string {
  if (!source) return '其他'
  const labels: Record<string, string> = {
    WEBSITE: '官网',
    REFERRAL: '转介绍',
    ADVERTISEMENT: '广告',
    EXHIBITION: '展会',
    COLD_CALL: '电销',
    SOCIAL_MEDIA: '社交媒体',
    OTHER: '其他',
  }
  return labels[source] || source
}

