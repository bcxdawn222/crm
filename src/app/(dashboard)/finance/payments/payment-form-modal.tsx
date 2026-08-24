'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, DatePicker, Form, Input, InputNumber, message, Modal, Select } from 'antd'
import dayjs from 'dayjs'

import { useFormDraft } from '@/hooks/useFormDraft'
import { apiRequest } from '@/lib/http/client'
import type { PaymentFormValues, PaymentOrderOption } from './payment-types'

interface OrdersResponse { success: true; data: { list: PaymentOrderOption[] } }
interface SubmitResponse { success: true }

interface PaymentFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void | Promise<void>
}

interface PaymentDraft {
  orderId?: string
  amount?: number
  paymentMethod?: PaymentFormValues['paymentMethod']
  paymentDate?: string
  invoiceNo?: string
  invoiceType?: PaymentFormValues['invoiceType']
  remarks?: string
}

function isPaymentDraft(value: unknown): value is PaymentDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as PaymentDraft
  return (draft.orderId === undefined || typeof draft.orderId === 'string')
    && (draft.amount === undefined || typeof draft.amount === 'number')
    && (draft.paymentMethod === undefined || typeof draft.paymentMethod === 'string')
    && (draft.paymentDate === undefined || typeof draft.paymentDate === 'string')
    && (draft.invoiceNo === undefined || typeof draft.invoiceNo === 'string')
    && (draft.invoiceType === undefined || typeof draft.invoiceType === 'string')
    && (draft.remarks === undefined || typeof draft.remarks === 'string')
}

export function PaymentFormModal({ open, onClose, onSaved }: PaymentFormModalProps) {
  const [form] = Form.useForm<PaymentFormValues>()
  const [orderOptions, setOrderOptions] = useState<PaymentOrderOption[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submissionIdRef = useRef('')
  const draft = useFormDraft<PaymentFormValues, PaymentDraft>({
    key: 'payments:create',
    enabled: open,
    form,
    serialize: (values) => ({
      orderId: values.orderId,
      amount: values.amount,
      paymentMethod: values.paymentMethod,
      paymentDate: values.paymentDate?.toISOString(),
      invoiceNo: values.invoiceNo,
      invoiceType: values.invoiceType,
      remarks: values.remarks,
    }),
    deserialize: (values) => ({
      ...values,
      paymentDate: values.paymentDate ? dayjs(values.paymentDate) : undefined,
    }),
    validate: isPaymentDraft,
  })

  useEffect(() => {
    if (!open) return

    form.resetFields()
    submissionIdRef.current = crypto.randomUUID()
    if (draft.restore()) message.info('已恢复未提交的回款草稿')
    setOrdersLoading(true)

    void apiRequest<OrdersResponse>('/api/finance/orders?page=1&pageSize=100')
      .then((data) => {
        setOrderOptions(
          data.data.list.filter(
            (order) => order.unpaidAmount > 0 && order.status !== 'CANCELLED'
          )
        )
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : '加载订单失败'
        message.error(errorMessage)
      })
      .finally(() => setOrdersLoading(false))
  }, [form, open])

  async function handleSubmit(values: PaymentFormValues) {
    if (submitting) return
    setSubmitting(true)

    try {
      await apiRequest<SubmitResponse>('/api/finance/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': submissionIdRef.current,
        },
        body: JSON.stringify({
          ...values,
          paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        }),
      }, {
        requestKey: `payment-form-${submissionIdRef.current}`,
      })

      message.success('创建成功')
      draft.clear()
      onClose()
      await onSaved()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '网络错误'
      message.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="新增收款记录"
      open={open}
      onCancel={() => {
        if (!submitting) {
          draft.clear()
          onClose()
        }
      }}
      footer={null}
      width={600}
      closable={!submitting}
      maskClosable={!submitting}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={draft.save}
        initialValues={{ paymentMethod: 'BANK_TRANSFER', paymentDate: dayjs() }}
      >
        <Form.Item name="orderId" label="订单" rules={[{ required: true, message: '请选择订单' }]}>
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

        <Form.Item name="amount" label="收款金额" rules={[{ required: true, message: '请输入收款金额' }]}>
          <InputNumber
            style={{ width: '100%' }}
            placeholder="请输入收款金额"
            prefix="¥"
            min={0}
            precision={2}
          />
        </Form.Item>

        <Form.Item name="paymentMethod" label="收款方式" rules={[{ required: true, message: '请选择收款方式' }]}>
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

        <Form.Item name="paymentDate" label="收款日期" rules={[{ required: true, message: '请选择收款日期' }]}>
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
          <Button type="primary" htmlType="submit" loading={submitting} block>
            创建
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
