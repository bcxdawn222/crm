'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Form, Input, message, Modal, Select, Spin } from 'antd'

import type { OrderRecord } from './order-types'

interface CustomerOption {
  id: string
  name: string
  company?: string | null
}

interface CustomerResponse {
  success?: boolean
  data?: { list: CustomerOption[] }
  error?: string
}

interface SubmitResponse {
  success?: boolean
  error?: string
}

interface OrderFormValues {
  customerId: string
  contractNo?: string
  contractAmount: number | string
  currency: string
  signDate: string
  deliveryDate?: string
  remarks?: string
}

interface OrderFormModalProps {
  open: boolean
  order: OrderRecord | null
  onClose: () => void
  onSaved: () => void
}

function mergeCustomerOptions(
  options: CustomerOption[],
  preserved?: CustomerOption
): CustomerOption[] {
  if (!preserved || options.some((option) => option.id === preserved.id)) return options
  return [preserved, ...options]
}

export function OrderFormModal({ open, order, onClose, onSaved }: OrderFormModalProps) {
  const [form] = Form.useForm<OrderFormValues>()
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [customerLoadError, setCustomerLoadError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const requestSequenceRef = useRef(0)
  const submissionIdRef = useRef('')

  const preservedCustomer = order?.customer
    ? {
        id: order.customerId,
        name: order.customer.name,
        company: order.customer.company,
      }
    : undefined

  async function loadCustomers(keyword = '') {
    const requestSequence = ++requestSequenceRef.current
    setIsLoadingCustomers(true)
    setCustomerLoadError(false)

    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '20',
        status: 'ACTIVE',
      })
      if (keyword.trim()) params.set('keyword', keyword.trim())

      const response = await fetch(`/api/customers?${params}`)
      const result = await response.json() as CustomerResponse
      if (requestSequence !== requestSequenceRef.current) return
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || '客户加载失败')
      }

      setCustomers(mergeCustomerOptions(result.data.list, preservedCustomer))
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current) return
      setCustomerLoadError(true)
      setCustomers(preservedCustomer ? [preservedCustomer] : [])
    } finally {
      if (requestSequence === requestSequenceRef.current) setIsLoadingCustomers(false)
    }
  }

  useEffect(() => {
    if (!open) return

    form.resetFields()
    submissionIdRef.current = crypto.randomUUID()
    form.setFieldsValue(order
      ? {
          customerId: order.customerId,
          contractNo: order.contractNo,
          contractAmount: order.contractAmount,
          currency: order.currency,
          signDate: order.signDate?.slice(0, 10) || '',
          deliveryDate: order.deliveryDate?.slice(0, 10),
          remarks: order.remarks,
        }
      : { currency: 'CNY' })
    setCustomers(preservedCustomer ? [preservedCustomer] : [])
    void loadCustomers()

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [open, order?.id])

  function handleCustomerSearch(value: string) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => void loadCustomers(value), 300)
  }

  async function handleSubmit(values: OrderFormValues) {
    setIsSubmitting(true)
    try {
      const response = await fetch(
        order ? `/api/finance/orders/${order.id}` : '/api/finance/orders',
        {
          method: order ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-request-id': submissionIdRef.current,
          },
          body: JSON.stringify(values),
        }
      )
      const result = await response.json() as SubmitResponse
      if (!response.ok || !result.success) {
        message.error(result.error || '操作失败')
        return
      }

      message.success(order ? '更新成功' : '创建成功')
      onClose()
      onSaved()
    } catch (error) {
      message.error('网络错误')
    } finally {
      setIsSubmitting(false)
    }
  }

  const customerOptions = customers.map((customer) => ({
    value: customer.id,
    label: customer.company ? `${customer.name} - ${customer.company}` : customer.name,
  }))

  return (
    <Modal
      title={order ? '编辑订单' : '新增订单'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="customerId" label="客户" rules={[{ required: true, message: '请选择客户' }]}>
          <Select
            showSearch
            filterOption={false}
            placeholder="输入客户名称或公司搜索"
            options={customerOptions}
            loading={isLoadingCustomers}
            onSearch={handleCustomerSearch}
            onDropdownVisibleChange={(visible) => visible && void loadCustomers()}
            notFoundContent={
              isLoadingCustomers
                ? <Spin size="small" />
                : customerLoadError ? '客户加载失败，请重新打开下拉框' : '暂无可选客户'
            }
          />
        </Form.Item>

        <Form.Item name="contractNo" label="合同号">
          <Input placeholder="请输入合同号" />
        </Form.Item>
        <Form.Item name="contractAmount" label="合同金额" rules={[{ required: true, message: '请输入合同金额' }]}>
          <Input type="number" min="0.01" step="0.01" placeholder="请输入合同金额" prefix="¥" />
        </Form.Item>
        <Form.Item name="currency" label="币种">
          <Select options={[
            { label: '人民币', value: 'CNY' },
            { label: '美元', value: 'USD' },
            { label: '欧元', value: 'EUR' },
          ]} />
        </Form.Item>
        <Form.Item name="signDate" label="签约日期" rules={[{ required: true, message: '请选择签约日期' }]}>
          <Input type="date" />
        </Form.Item>
        <Form.Item name="deliveryDate" label="交付日期">
          <Input type="date" />
        </Form.Item>
        <Form.Item name="remarks" label="备注">
          <Input.TextArea rows={4} placeholder="请输入备注" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isSubmitting} block>
            {order ? '更新' : '创建'}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
