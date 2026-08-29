'use client'

import { Alert, Button, Form, Input, Modal, Select, Spin, Tag } from 'antd'
import type { FormInstance } from 'antd'

import { PermissionGuard } from '@/components/common/PermissionGuard'

import type { Customer, CustomerFormValues } from './types'

interface CustomerFormModalProps {
  open: boolean
  customer: Customer | null
  readOnly: boolean
  submitting: boolean
  detailLoading: boolean
  detailError: string | null
  form: FormInstance<CustomerFormValues>
  onCancel: () => void
  onRetry: () => void
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
      {props.detailLoading ? (
        <div style={{ minHeight: 240, display: 'grid', placeItems: 'center' }}><Spin tip="正在加载完整客户详情" /></div>
      ) : props.detailError ? (
        <Alert type="error" showIcon message="客户详情加载失败" description={props.detailError} action={<Button size="small" onClick={props.onRetry}>重新加载</Button>} />
      ) : <><Form
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
              <div style={{ color: '#666', fontSize: 12 }}>{new Date(followUp.createdAt).toLocaleString('zh-CN')} · {followUp.type || '跟进'}{followUp.sales?.realName ? ` · ${followUp.sales.realName}` : ''}</div>
              <div>{followUp.content || '已记录跟进'}</div>
              {followUp.result && <div style={{ color: '#475569', fontSize: 12 }}>结果：{followUp.result}</div>}
              {followUp.nextAction && <div style={{ color: '#666', fontSize: 12 }}>下一步：{followUp.nextAction}</div>}
              {followUp.nextFollowUpAt && <div style={{ color: '#666', fontSize: 12 }}>计划时间：{new Date(followUp.nextFollowUpAt).toLocaleString('zh-CN')}</div>}
            </div>
          )) : <div style={{ color: '#999' }}>暂无跟进记录</div>}
        </div>
      )}
      {props.customer && (
        <div style={{ marginTop: 20, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <strong>最近订单</strong>
          {props.customer.orders?.length ? props.customer.orders.map((order) => (
            <div key={order.id} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div><strong>{order.orderNo}</strong> <Tag>{order.status}</Tag></div>
              <div style={{ color: '#666', fontSize: 12 }}>合同金额：{order.contractAmount.toLocaleString()} {order.currency} · 已收：{order.paidAmount.toLocaleString()} · 未收：{order.unpaidAmount.toLocaleString()}</div>
            </div>
          )) : <div style={{ marginTop: 8, color: '#999' }}>暂无订单</div>}
        </div>
      )}</>}
    </Modal>
  )
}
