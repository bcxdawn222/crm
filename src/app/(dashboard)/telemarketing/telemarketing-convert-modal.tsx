'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Form, Input, message, Modal, Select, Space } from 'antd'

interface ConvertRecord {
  id: string
  notes?: string
}

interface ConvertFormValues {
  level: string
  source: string
  notes?: string
}

interface ConvertResponse {
  success?: boolean
  replayed?: boolean
  error?: string
}

interface TelemarketingConvertModalProps {
  record: ConvertRecord | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function TelemarketingConvertModal({
  record,
  onClose,
  onSaved,
}: TelemarketingConvertModalProps) {
  const [form] = Form.useForm<ConvertFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const requestIdRef = useRef('')

  useEffect(() => {
    if (!record) return
    requestIdRef.current = crypto.randomUUID()
    form.setFieldsValue({
      level: 'POTENTIAL',
      source: 'COLD_CALL',
      notes: record.notes,
    })
  }, [form, record])

  async function handleSubmit(values: ConvertFormValues) {
    if (!record || submitting) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/telemarketing/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestIdRef.current,
        },
        body: JSON.stringify({ telemarketingId: record.id, ...values }),
      })
      const data = (await response.json()) as ConvertResponse
      if (!data.success) throw new Error(data.error || '转换失败')

      message.success(data.replayed ? '该记录已转入客户' : '已成功转入我的客户')
      form.resetFields()
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
      title="转入我的客户"
      open={Boolean(record)}
      onCancel={onClose}
      footer={null}
      width={500}
      closable={!submitting}
      maskClosable={!submitting}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="level" label="客户等级" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '潜在客户', value: 'POTENTIAL' },
              { label: '普通客户', value: 'NORMAL' },
              { label: '重要客户', value: 'IMPORTANT' },
              { label: 'VIP客户', value: 'VIP' },
            ]}
          />
        </Form.Item>

        <Form.Item name="source" label="客户来源" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '电销', value: 'COLD_CALL' },
              { label: '官网', value: 'WEBSITE' },
              { label: '转介绍', value: 'REFERRAL' },
              { label: '广告', value: 'ADVERTISEMENT' },
              { label: '展会', value: 'EXHIBITION' },
              { label: '社交媒体', value: 'SOCIAL_MEDIA' },
              { label: '其他', value: 'OTHER' },
            ]}
          />
        </Form.Item>

        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={3} placeholder="可补充客户备注信息" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              确认转入
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
