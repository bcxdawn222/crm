'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Form, Input, message, Modal, Select, Space } from 'antd'

import { apiRequest } from '@/lib/http/client'

interface TransferCustomer {
  id: string
  name: string
  salesId: string
}

interface TransferTarget {
  id: string
  realName: string
  username: string
  department?: string | null
  position?: string | null
}

interface TransferFormValues {
  targetSalesId: string
  reason?: string
}

interface TransferOptionsResponse {
  success?: boolean
  data?: TransferTarget[]
  error?: string
}

interface TransferResponse {
  success?: boolean
  replayed?: boolean
  error?: string
}

interface CustomerTransferModalProps {
  customer: TransferCustomer | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function CustomerTransferModal({
  customer,
  onClose,
  onSaved,
}: CustomerTransferModalProps) {
  const [form] = Form.useForm<TransferFormValues>()
  const [targets, setTargets] = useState<TransferTarget[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const requestIdRef = useRef('')

  useEffect(() => {
    if (!customer) return
    requestIdRef.current = crypto.randomUUID()
    form.resetFields()
    setLoadingTargets(true)
    void apiRequest<TransferOptionsResponse>('/api/customers/transfer-options')
      .then((data) => {
        if (!data.data) throw new Error('加载目标销售失败')
        setTargets(data.data.filter((target) => target.id !== customer.salesId))
      })
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : '加载目标销售失败')
      })
      .finally(() => setLoadingTargets(false))
  }, [customer, form])

  async function handleSubmit(values: TransferFormValues) {
    if (!customer || submitting) return
    setSubmitting(true)
    try {
      const data = await apiRequest<TransferResponse>(`/api/customers/${customer.id}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestIdRef.current,
        },
        body: JSON.stringify(values),
      }, {
        requestKey: `customer-transfer-${customer.id}-${requestIdRef.current}`,
      })

      message.success(data.replayed ? '该转移请求已完成' : '客户转移成功')
      onClose()
      await onSaved()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={customer ? `转移客户：${customer.name}` : '转移客户'}
      open={Boolean(customer)}
      onCancel={onClose}
      footer={null}
      width={520}
      closable={!submitting}
      maskClosable={!submitting}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="targetSalesId"
          label="目标销售"
          rules={[{ required: true, message: '请选择目标销售' }]}
        >
          <Select
            showSearch
            loading={loadingTargets}
            optionFilterProp="label"
            placeholder="请选择接收客户的销售"
            options={targets.map((target) => ({
              value: target.id,
              label: [
                target.realName,
                target.department,
                target.position,
              ].filter(Boolean).join(' · '),
            }))}
          />
        </Form.Item>

        <Form.Item name="reason" label="转移原因">
          <Input.TextArea rows={3} maxLength={500} showCount placeholder="填写本次转移原因" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              确认转移
            </Button>
            <Button onClick={onClose} disabled={submitting}>
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
