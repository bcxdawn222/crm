'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Select, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'

import { useFormDraft } from '@/hooks/useFormDraft'
import { apiRequest } from '@/lib/http/client'


interface FollowUpFormValues {
  type: string
  content: string
  result?: string
  nextAction?: string
  nextFollowUpAt?: Dayjs
}

interface FollowUpDraft {
  type?: string
  content?: string
  result?: string
  nextAction?: string
  nextFollowUpAt?: string
}

function isFollowUpDraft(value: unknown): value is FollowUpDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as FollowUpDraft
  return (draft.type === undefined || typeof draft.type === 'string')
    && (draft.content === undefined || typeof draft.content === 'string')
    && (draft.result === undefined || typeof draft.result === 'string')
    && (draft.nextAction === undefined || typeof draft.nextAction === 'string')
    && (draft.nextFollowUpAt === undefined || typeof draft.nextFollowUpAt === 'string')
}


interface FollowUpModalProps {
  open: boolean
  customerId?: string
  customerName?: string
  plannedFollowUpId?: string
  onClose: () => void
  onSaved: () => void
}


const typeOptions = [
  { label: '电话', value: 'PHONE' },
  { label: '拜访', value: 'VISIT' },
  { label: '邮件', value: 'EMAIL' },
  { label: '微信', value: 'WECHAT' },
  { label: '会议', value: 'MEETING' },
  { label: '其他', value: 'OTHER' },
]


export function FollowUpModal({
  open,
  customerId,
  customerName,
  plannedFollowUpId,
  onClose,
  onSaved,
}: FollowUpModalProps) {
  const [form] = Form.useForm<FollowUpFormValues>()
  const [saving, setSaving] = useState(false)
  const requestIdRef = useRef('')
  const draft = useFormDraft<FollowUpFormValues, FollowUpDraft>({
    key: `follow-up:${customerId || 'unknown'}:${plannedFollowUpId || 'new'}`,
    enabled: open && Boolean(customerId),
    form,
    serialize: (values) => ({
      type: values.type,
      content: values.content,
      result: values.result,
      nextAction: values.nextAction,
      nextFollowUpAt: values.nextFollowUpAt?.toISOString(),
    }),
    deserialize: (values) => ({
      ...values,
      nextFollowUpAt: values.nextFollowUpAt ? dayjs(values.nextFollowUpAt) : undefined,
    }),
    validate: isFollowUpDraft,
  })

  useEffect(() => {
    if (!open || !customerId) return
    form.resetFields()
    form.setFieldValue('type', 'PHONE')
    requestIdRef.current = crypto.randomUUID()
    if (draft.restore()) message.info('已恢复未提交的跟进草稿')
  }, [customerId, open, plannedFollowUpId])

  const handleSubmit = async (values: FollowUpFormValues) => {
    if (!customerId) return
    try {
      setSaving(true)
      await apiRequest(`/api/customers/${encodeURIComponent(customerId)}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestIdRef.current },
        body: JSON.stringify({
          ...values,
          nextFollowUpAt: values.nextFollowUpAt?.toISOString(),
          plannedFollowUpId,
        }),
      }, { requestKey: `follow-up:${customerId}:${plannedFollowUpId || 'new'}` })
      message.success(plannedFollowUpId ? '计划跟进已完成' : '跟进记录已保存')
      draft.clear()
      form.resetFields()
      onSaved()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '跟进记录保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={plannedFollowUpId ? '完成计划跟进' : '新增跟进记录'}
      open={open}
      onCancel={() => {
        if (saving) return
        draft.clear()
        onClose()
      }}
      footer={null}
      destroyOnHidden
      closable={!saving}
      maskClosable={!saving}
    >
      <div style={{ marginBottom: 16, color: '#666' }}>客户：{customerName || '-'}</div>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ type: 'PHONE' }}
        onFinish={handleSubmit}
        onValuesChange={draft.save}
      >
        <Form.Item name="type" label="跟进方式" rules={[{ required: true, message: '请选择跟进方式' }]}>
          <Select options={typeOptions} />
        </Form.Item>
        <Form.Item name="content" label="跟进内容" rules={[{ required: true, message: '请填写跟进内容' }]}>
          <Input.TextArea rows={4} maxLength={5000} showCount placeholder="记录本次沟通内容" />
        </Form.Item>
        <Form.Item name="result" label="跟进结果">
          <Input.TextArea rows={2} maxLength={500} showCount placeholder="记录客户反馈或结果" />
        </Form.Item>
        <Form.Item name="nextAction" label="下一步动作">
          <Input placeholder="例如：发送方案、安排再次沟通" maxLength={500} />
        </Form.Item>
        <Form.Item name="nextFollowUpAt" label="下次跟进时间">
          <DatePicker
            style={{ width: '100%' }}
            showTime
            disabledDate={(date) => date.isBefore(dayjs().startOf('day'))}
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Button onClick={() => { draft.clear(); onClose() }} disabled={saving} style={{ marginRight: 8 }}>取消</Button>
          <Button type="primary" htmlType="submit" loading={saving} disabled={!customerId}>
            保存跟进
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
