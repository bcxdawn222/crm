'use client'

import { Button, Form, Input, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'

import { PermissionGuard } from '@/components/common/PermissionGuard'

import type { Customer, CustomerFormValues } from './types'

interface CustomerFormModalProps {
  open: boolean
  customer: Customer | null
  readOnly: boolean
  submitting: boolean
  form: FormInstance<CustomerFormValues>
  onCancel: () => void
  onSubmit: (values: CustomerFormValues) => void
  onValuesChange: () => void
  onFollowUp: (customer: Customer) => void
}

export function CustomerFormModal(props: CustomerFormModalProps) {
  return (
    <Modal
      title={props.readOnly ? '客户详情' : props.customer ? '编辑客户' : '新增客户'}
      open={props.open}
      onCancel={props.onCancel}
      footer={null}
      width={600}
      closable={!props.submitting}
      maskClosable={!props.submitting}
    >
      <Form
        form={props.form}
        disabled={props.readOnly}
        layout="vertical"
        onFinish={props.onSubmit}
        onValuesChange={props.onValuesChange}
        initialValues={{ category: '潜在客户', source: 'OTHER', status: 'ACTIVE' }}
      >
        <Form.Item name="name" label="客户姓名" rules={[{ required: true, message: '请输入客户姓名' }]}>
          <Input placeholder="请输入客户姓名" />
        </Form.Item>
        <Form.Item name="company" label="公司名称"><Input placeholder="请输入公司名称" /></Form.Item>
        <Form.Item name="phone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
          <Input placeholder="请输入联系电话" />
        </Form.Item>
        <Form.Item name="email" label="邮箱地址"><Input placeholder="请输入邮箱地址" /></Form.Item>
        <Form.Item name="address" label="联系地址"><Input.TextArea rows={3} placeholder="请输入联系地址" /></Form.Item>
        <Form.Item name="category" label="客户分类">
          <Select options={[
            { label: '潜在客户', value: '潜在客户' }, { label: '普通客户', value: '普通客户' },
            { label: '重要客户', value: '重要客户' }, { label: 'VIP客户', value: 'VIP客户' },
          ]} />
        </Form.Item>
        <Form.Item name="source" label="客户来源"><Input placeholder="请输入客户来源，如：网站咨询、推荐介绍等" /></Form.Item>
        <Form.Item name="notes" label="备注信息"><Input.TextArea rows={4} placeholder="请输入备注信息" /></Form.Item>
        {!props.readOnly && <Form.Item><Button type="primary" htmlType="submit" block loading={props.submitting}>{props.customer ? '更新' : '创建'}</Button></Form.Item>}
      </Form>
      {props.customer && (
        <div style={{ marginTop: 20, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>跟进记录</strong>
            <PermissionGuard action="create" subject="followUp">
              <Button size="small" type="primary" onClick={() => props.onFollowUp(props.customer!)}>新增跟进</Button>
            </PermissionGuard>
          </div>
          {props.customer.followUps?.length ? props.customer.followUps.map((followUp) => (
            <div key={followUp.id || followUp.createdAt} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ color: '#666', fontSize: 12 }}>{new Date(followUp.createdAt).toLocaleString('zh-CN')} · {followUp.type || '跟进'}</div>
              <div>{followUp.content || '已记录跟进'}</div>
              {followUp.nextAction && <div style={{ color: '#666', fontSize: 12 }}>下一步：{followUp.nextAction}</div>}
            </div>
          )) : <div style={{ color: '#999' }}>暂无跟进记录</div>}
        </div>
      )}
    </Modal>
  )
}
