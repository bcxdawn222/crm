'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Input, message, Modal, Select, Space, Table, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dynamic from 'next/dynamic'

import { PermissionGuard } from '@/components/common/PermissionGuard'
import { apiRequest } from '@/lib/http/client'
import type { OrderRecord, OrderStatus } from './order-types'

const OrderFormModal = dynamic(
  () => import('./order-form-modal').then((module) => module.OrderFormModal),
  { ssr: false },
)

const STATUS_MAP: Record<OrderStatus, { text: string; color: string }> = {
  PENDING: { text: '待处理', color: 'orange' },
  CONFIRMED: { text: '已确认', color: 'blue' },
  DELIVERING: { text: '交付中', color: 'cyan' },
  COMPLETED: { text: '已完成', color: 'green' },
  CANCELLED: { text: '已取消', color: 'red' },
}

const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([value, config]) => ({
  value,
  label: config.text,
}))

interface OrderListResponse {
  success: true
  data: { list: OrderRecord[]; total: number }
}

export default function OrdersPage() {
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<OrderStatus>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null)

  async function loadOrders(
    targetPage = page,
    targetKeyword = keyword,
    targetStatus = status
  ) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        pageSize: pageSize.toString(),
      })
      if (targetKeyword.trim()) params.set('keyword', targetKeyword.trim())
      if (targetStatus) params.set('status', targetStatus)

      const result = await apiRequest<OrderListResponse>(`/api/finance/orders?${params}`)
      setOrders(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载订单失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrders()
  }, [page, pageSize])

  function handleSearch() {
    setPage(1)
    void loadOrders(1)
  }

  function handleReset() {
    setKeyword('')
    setStatus(undefined)
    setPage(1)
    void loadOrders(1, '', undefined)
  }

  function handleOpenModal(order?: OrderRecord) {
    setEditingOrder(order || null)
    setModalVisible(true)
  }

  function handleDelete(id: string) {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该订单吗?',
      onOk: async () => {
        try {
          await apiRequest<{ success: true }>(`/api/finance/orders/${id}`, { method: 'DELETE' }, {
            requestKey: `order-delete-${id}`,
          })
          message.success('删除成功')
          if (orders.length === 1 && page > 1) setPage((current) => current - 1)
          else await loadOrders()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '删除订单失败')
        }
      },
    })
  }

  const columns: ColumnsType<OrderRecord> = [
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 150 },
    { title: '合同号', dataIndex: 'contractNo', key: 'contractNo', width: 130 },
    {
      title: '客户',
      key: 'customer',
      render: (_, record) => (
        <div>
          <div>{record.customer?.name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.customer?.company}</div>
        </div>
      ),
    },
    {
      title: '合同金额',
      dataIndex: 'contractAmount',
      key: 'contractAmount',
      width: 120,
      render: (amount: number) => `¥${amount.toLocaleString()}`,
    },
    {
      title: '已付金额',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      width: 120,
      render: (amount: number) => <span style={{ color: '#52c41a' }}>¥{amount.toLocaleString()}</span>,
    },
    {
      title: '未付金额',
      dataIndex: 'unpaidAmount',
      key: 'unpaidAmount',
      width: 120,
      render: (amount: number) => <span style={{ color: '#ff4d4f' }}>¥{amount.toLocaleString()}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: OrderStatus) => <Tag color={STATUS_MAP[value].color}>{STATUS_MAP[value].text}</Tag>,
    },
    {
      title: '收款次数',
      key: 'payments',
      width: 100,
      render: (_, record) => record._count?.payments || 0,
    },
    {
      title: '签约日期',
      dataIndex: 'signDate',
      key: 'signDate',
      width: 120,
      render: (date?: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenModal(record)}>查看</Button>
          <PermissionGuard action="update" subject="order">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)}>编辑</Button>
          </PermissionGuard>
          <PermissionGuard action="delete" subject="order">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
          </PermissionGuard>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title="订单管理"
        extra={
          <PermissionGuard action="create" subject="order">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>新增订单</Button>
          </PermissionGuard>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索订单号、合同号、客户"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 250 }}
            onPressEnter={handleSearch}
          />
          <Select<OrderStatus>
            placeholder="选择状态"
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            allowClear
            options={STATUS_OPTIONS}
          />
          <Button type="primary" onClick={handleSearch}>搜索</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage)
              setPageSize(nextPageSize)
            },
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <OrderFormModal
        open={modalVisible}
        order={editingOrder}
        onClose={() => setModalVisible(false)}
        onSaved={() => void loadOrders()}
      />
    </div>
  )
}
