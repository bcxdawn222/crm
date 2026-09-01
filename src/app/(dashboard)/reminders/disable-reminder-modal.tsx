'use client'

import { Form, Input, Modal, Radio } from 'antd'

import type { ReminderItem } from './types'

export function DisableReminderModal(props: {
  open: boolean
  selected: ReminderItem | null
  submitting: boolean
  form: ReturnType<typeof Form.useForm>[0]
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal title="确认不再提醒" open={props.open} confirmLoading={props.submitting} cancelButtonProps={{ disabled: props.submitting }} onCancel={props.onCancel} onOk={props.onConfirm} okText="确认禁用" cancelText="取消">
      <div style={{ marginBottom: 16 }}>
        <p><strong>客户:</strong> {props.selected?.customerName}</p>
        {props.selected?.company && <p><strong>公司:</strong> {props.selected.company}</p>}
        <p><strong>提醒内容:</strong> {props.selected?.message}</p>
      </div>
      <Form form={props.form} layout="vertical">
        <Form.Item label="请选择禁用原因" name="reason">
          <Radio.Group>
            <Radio value="LOST">客户已流失</Radio><Radio value="NO_INTEREST">客户无意向</Radio><Radio value="TEMPORARY">暂时不需要跟进</Radio><Radio value="OTHER">其他</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, current) => prev.reason !== current.reason}>
          {({ getFieldValue }) => getFieldValue('reason') === 'OTHER' ? <Form.Item name="otherReason"><Input placeholder="请输入具体原因" /></Form.Item> : null}
        </Form.Item>
      </Form>
    </Modal>
  )
}
