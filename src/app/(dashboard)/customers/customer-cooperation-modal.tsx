'use client'

import { Button, DatePicker, Form, InputNumber, Modal, Space } from 'antd'
import type { Dayjs } from 'dayjs'
import { useEffect } from 'react'

interface CooperationFormValues {
  contractStartDate?: Dayjs | null
  contractEndDate?: Dayjs | null
  contractAmount?: number
}

interface CustomerCooperationModalProps {
  open: boolean
  customerName?: string
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: CooperationFormValues) => void
}

export function CustomerCooperationModal(props: CustomerCooperationModalProps) {
  const [form] = Form.useForm<CooperationFormValues>()

  useEffect(() => {
    if (props.open) form.resetFields()
  }, [form, props.open])

  return (
    <Modal
      title={`标记为已合作${props.customerName ? `：${props.customerName}` : ''}`}
      open={props.open}
      footer={null}
      onCancel={props.onCancel}
      closable={!props.submitting}
      maskClosable={!props.submitting}
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={props.onSubmit}
        initialValues={{ contractStartDate: null }}
      >
        <Form.Item name="contractStartDate" label="合同开始日期">
          <DatePicker style={{ width: '100%' }} placeholder="选择开始日期" />
        </Form.Item>
        <Form.Item
          name="contractEndDate"
          label="合同到期日期"
        >
          <DatePicker style={{ width: '100%' }} placeholder="选择到期日期" />
        </Form.Item>
        <Form.Item name="contractAmount" label="合同金额">
          <InputNumber<number>
            style={{ width: '100%' }}
            min={0}
            precision={2}
            placeholder="可选，填写合同金额"
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={props.submitting}>
              确认转为已合作
            </Button>
            <Button onClick={props.onCancel} disabled={props.submitting}>
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
