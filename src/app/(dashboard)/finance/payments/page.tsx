'use client'

import { useState, useEffect } from 'react'
import { Card, Table, Button, Select, Modal, Form, message, Tag, InputNumber, DatePicker, Input } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'

interface Payment {
  id: string
  paymentNo: string
  orderId: string
  amount: number
  paymentMethod: string
  paymentDate: string
  invoiceNo?: string
  invoiceType?: string
  remarks?: string
  operatorId: string
  createdAt: string
  order?: {
    orderNo: string
    contractNo?: string
    customer?: {
      name: string
      company?: string
    }
  }
  operator?: {
    realName: string
  }
}

interface OrderOption {
  id: string
  orderNo: string
  contractNo?: string
  unpaidAmount: number
  status: string
  customer?: {
    name: string
  }
}

interface PaymentFormValues {
  orderId: string
  amount: number
  paymentMethod: string
  paymentDate: Dayjs
  invoiceNo?: string
  invoiceType?: string
  remarks?: string
}

export default function PaymentsPage() {
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [orderOptions, setOrderOptions] = useState<OrderOption[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  // 加载收款记录列表
  const loadPayments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })

      const res = await fetch(`/api/finance/payments?${params}`)
      const data = await res.json()

      if (data.success) {
        setPayments(data.data.list)
        setTotal(data.data.total)
      } else {
        message.error(data.error || '加载失败')
      }
    } catch (error) {
      message.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [page, pageSize])

  // 打开新增弹窗
  const loadOrderOptions = async () => {
    setOrdersLoading(true)
    try {
      const res = await fetch('/api/finance/orders?page=1&pageSize=100')
      const data = await res.json()
      if (!data.success) {
        message.error(data.error || '加载订单失败')
        return
      }
      setOrderOptions(
        data.data.list.filter(
          (order: OrderOption) => order.unpaidAmount > 0 && order.status !== 'CANCELLED'
        )
      )
    } catch {
      message.error('加载订单失败')
    } finally {
      setOrdersLoading(false)
    }
  }

  const handleOpenModal = () => {
    form.resetFields()
    void loadOrderOptions()
    setModalVisible(true)
  }

  // 提交表单
  const handleSubmit = async (values: PaymentFormValues) => {
    try {
      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        }),
      })

      const data = await res.json()

      if (data.success) {
        message.success('创建成功')
        setModalVisible(false)
        loadPayments()
      } else {
        message.error(data.error || '操作失败')
      }
    } catch (error) {
      message.error('网络错误')
    }
  }

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
  const columns: ColumnsType<Payment> = [
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
            onClick={() => handleOpenModal()}
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

      {/* 新增弹窗 */}
      <Modal
        title="新增收款记录"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            paymentMethod: 'BANK_TRANSFER',
            paymentDate: dayjs(),
          }}
        >
          <Form.Item
            name="orderId"
            label="订单"
            rules={[{ required: true, message: '请选择订单' }]}
          >
            <Select
              showSearch
              loading={ordersLoading}
              placeholder="请选择有未收金额的订单"
              optionFilterProp="label"
              options={orderOptions.map((order) => ({
                value: order.id,
                label: `${order.orderNo} - ${order.customer?.name ?? '未知客户'} - 待收 ¥${order.unpaidAmount.toLocaleString()}`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="amount"
            label="收款金额"
            rules={[{ required: true, message: '请输入收款金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入收款金额"
              prefix="¥"
              min={0}
              precision={2}
            />
          </Form.Item>

          <Form.Item
            name="paymentMethod"
            label="收款方式"
            rules={[{ required: true, message: '请选择收款方式' }]}
          >
            <Select
              options={[
                { label: '银行转账', value: 'BANK_TRANSFER' },
                { label: '支付宝', value: 'ALIPAY' },
                { label: '微信', value: 'WECHAT_PAY' },
                { label: '现金', value: 'CASH' },
                { label: '支票', value: 'CHECK' },
                { label: '其他', value: 'OTHER' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="paymentDate"
            label="收款日期"
            rules={[{ required: true, message: '请选择收款日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="invoiceNo" label="发票号">
            <Input placeholder="请输入发票号" />
          </Form.Item>

          <Form.Item name="invoiceType" label="发票类型">
            <Select
              allowClear
              options={[
                { label: '增值税专用发票', value: 'VAT_SPECIAL' },
                { label: '增值税普通发票', value: 'VAT_NORMAL' },
                { label: '收据', value: 'RECEIPT' },
              ]}
            />
          </Form.Item>

          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={4} placeholder="请输入备注" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
