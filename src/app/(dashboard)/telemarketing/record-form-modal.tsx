'use client'

import { Button, Form, Input, Modal, Select, Space, Switch } from 'antd'
import type { FormInstance } from 'antd'

import {
  TELEMARKETING_RESULT_OPTIONS,
  TELEMARKETING_STATUS_OPTIONS,
  type TelemarketingFormValues,
  type TelemarketingOwner,
  type TelemarketingRecord,
} from './types'

interface RecordFormModalProps {
  open: boolean
  record: TelemarketingRecord | null
  form: FormInstance<TelemarketingFormValues>
  submitting: boolean
  canAssignOwner: boolean
  owners: TelemarketingOwner[]
  onCancel: () => void
  onSubmit: (values: TelemarketingFormValues) => void
  onValuesChange: () => void
}

export function RecordFormModal(props: RecordFormModalProps) {
  const { open, record, form, submitting, canAssignOwner, owners, onCancel, onSubmit, onValuesChange } = props
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
        <Form.Item name="name" label="客户姓名">
          <Input placeholder="请输入客户姓名" />
        </Form.Item>
        <Form.Item name="company" label="公司名称"><Input placeholder="请输入公司名称" /></Form.Item>
        <Form.Item name="phone" label="电话号码">
          <Input placeholder="请输入电话号码" maxLength={20} />
        </Form.Item>
        <Form.Item name="position" label="职位"><Input placeholder="请输入职位" /></Form.Item>
        <Form.Item name="industry" label="行业"><Input placeholder="请输入行业" /></Form.Item>
        <Form.Item name="source" label="数据来源"><Input placeholder="如:展会、网站、推荐等" /></Form.Item>
        <Form.Item name="status" label="状态">
          <Select allowClear options={TELEMARKETING_STATUS_OPTIONS} placeholder="请选择状态" />
        </Form.Item>
        <Form.Item name="result" label="结果">
          <Select allowClear options={TELEMARKETING_RESULT_OPTIONS} placeholder="请选择结果" />
        </Form.Item>
        <Form.Item name="isEffective" label="有效性" valuePropName="checked">
          <Switch checkedChildren="有效" unCheckedChildren="无效" />
        </Form.Item>
        {canAssignOwner ? (
          <Form.Item name="salesId" label="对应销售">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="默认当前账号，可指定销售"
              options={owners.map((owner) => ({
                value: owner.id,
                label: `${owner.realName}（${owner.username}）`,
              }))}
            />
          </Form.Item>
        ) : null}
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
