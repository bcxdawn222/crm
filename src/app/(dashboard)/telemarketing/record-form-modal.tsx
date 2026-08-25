'use client'

import { Button, Form, Input, Modal, Space } from 'antd'
import type { FormInstance } from 'antd'

import type { TelemarketingFormValues, TelemarketingRecord } from './types'

interface RecordFormModalProps {
  open: boolean
  record: TelemarketingRecord | null
  form: FormInstance<TelemarketingFormValues>
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: TelemarketingFormValues) => void
  onValuesChange: () => void
}

export function RecordFormModal(props: RecordFormModalProps) {
  const { open, record, form, submitting, onCancel, onSubmit, onValuesChange } = props
  return (
    <Modal
      title={record ? '编辑电销记录' : '新增电销记录'}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={600}
      closable={!submitting}
      maskClosable={!submitting}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} onValuesChange={onValuesChange}>
        <Form.Item name="name" label="客户姓名" rules={[{ required: true, message: '请输入客户姓名' }]}>
          <Input placeholder="请输入客户姓名" />
        </Form.Item>
        <Form.Item name="company" label="公司名称"><Input placeholder="请输入公司名称" /></Form.Item>
        <Form.Item
          name="phone"
          label="电话号码"
          rules={[
            { required: true, message: '请输入电话号码' },
            { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' },
          ]}
        >
          <Input placeholder="请输入手机号码" />
        </Form.Item>
        <Form.Item name="position" label="职位"><Input placeholder="请输入职位" /></Form.Item>
        <Form.Item name="industry" label="行业"><Input placeholder="请输入行业" /></Form.Item>
        <Form.Item name="source" label="数据来源"><Input placeholder="如:展会、网站、推荐等" /></Form.Item>
        <Form.Item name="notes" label="备注"><Input.TextArea rows={4} placeholder="请输入沟通备注" /></Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>{record ? '更新' : '创建'}</Button>
            <Button onClick={onCancel} disabled={submitting}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
