'use client'

import { useEffect, useState } from 'react'
import { Button, Card, message, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

import { apiRequest } from '@/lib/http/client'
import { PaymentFormModal } from './payment-form-modal'
import type { PaymentRecord } from './payment-types'

export default function PaymentsPage() {
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalVisible, setModalVisible] = useState(false)

  // 加载收款记录列表
  const loadPayments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })

      const data = await apiRequest<{
        success: true
        data: { list: PaymentRecord[]; total: number }
      }>(`/api/finance/payments?${params}`)
      setPayments(data.data.list)
      setTotal(data.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载收款记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [page, pageSize])

  // 支付方式映射
  const paymentMethodMap: Record<string, { text: string; color: string }> = {
    BANK_TRANSFER: { text: '银行转账', color: 'blue' },
    ALIPAY: { text: '支付宝', color: 'cyan' },
    WECHAT_PAY: { text: '微信', color: 'green' },
    CASH: { text: '现金', color: 'orange' },
    CHECK: { text: '支票', color: 'purple' },
    OTHER: { text: '其他', color: 'default' },
  }

  // 表格列定义
  const columns: ColumnsType<PaymentRecord> = [
    {
      title: '收款单号',
      dataIndex: 'paymentNo',
      key: 'paymentNo',
      width: 150,
    },
    {
      title: '订单号',
      dataIndex: 'order',
      key: 'orderNo',
      render: (_, record) => (
        <div>
          <div>{record.order?.orderNo}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.order?.contractNo}</div>
        </div>
      ),
    },
    {
      title: '客户',
      dataIndex: ['order', 'customer'],
      key: 'customer',
      render: (_, record) => (
        <div>
          <div>{record.order?.customer?.name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.order?.customer?.company}</div>
        </div>
      ),
    },
    {
      title: '收款金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      render: (amount) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>¥{amount.toLocaleString()}</span>,
    },
    {
      title: '收款方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (text) => (
        <Tag color={paymentMethodMap[text]?.color || 'default'}>
          {paymentMethodMap[text]?.text || text}
        </Tag>
      ),
    },
    {
      title: '收款日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '发票号',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      width: 130,
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
      render: (_, record) => record.operator?.realName || '-',
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
    },
  ]

  return (
    <div>
      <Card
        title="收款管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            新增收款
          </Button>
        }
      >
        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={payments}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: 1300 }}
        />
      </Card>

      <PaymentFormModal
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={loadPayments}
      />
    </div>
  )
}
