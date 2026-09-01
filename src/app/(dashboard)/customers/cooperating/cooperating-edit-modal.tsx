'use client'

import { Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space } from 'antd'
import type { FormInstance } from 'antd'

import type { CooperatingFormValues, OperationManagerOption } from './types'

interface CooperatingEditModalProps {
  open: boolean
  submitting: boolean
  managerLoading: boolean
  managers: OperationManagerOption[]
  form: FormInstance<CooperatingFormValues>
  onCancel: () => void
  onSubmit: (values: CooperatingFormValues) => void
  onValuesChange: () => void
}

export function CooperatingEditModal(props: CooperatingEditModalProps) {
  return (
    <Modal title="编辑合作信息" open={props.open} onCancel={props.onCancel} footer={null} width={700} closable={!props.submitting} maskClosable={!props.submitting}>
      <Form form={props.form} layout="vertical" onFinish={props.onSubmit} onValuesChange={props.onValuesChange}>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="contractStartDate" label="合同开始日期"><DatePicker style={{ width: '100%' }} placeholder="选择开始日期" /></Form.Item></Col>
          <Col span={12}><Form.Item name="contractEndDate" label="合同到期日期"><DatePicker style={{ width: '100%' }} placeholder="选择到期日期" /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="contractAmount" label="合同金额"><InputNumber<number> style={{ width: '100%' }} min={0} precision={2} formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(value) => Number(value?.replace(/¥\s?|(,*)/g, '') || 0)} placeholder="输入合同金额" /></Form.Item></Col>
          <Col span={12}><Form.Item name="renewalReminderDays" label="续签提前提醒天数"><InputNumber style={{ width: '100%' }} min={1} max={365} placeholder="默认30天" /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="operationManagerId" label="运营负责人"><Select placeholder="选择运营负责人" allowClear showSearch loading={props.managerLoading} optionFilterProp="label" options={props.managers.map((manager) => ({ value: manager.id, label: [manager.realName, manager.department, manager.position].filter(Boolean).join(' · ') }))} /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="visitFrequency" label="回访频率"><Select placeholder="选择回访频率" options={[{ value: 'WEEKLY', label: '每周' }, { value: 'MONTHLY', label: '每月' }, { value: 'QUARTERLY', label: '每季度' }, { value: 'YEARLY', label: '每年' }]} /></Form.Item></Col>
          <Col span={12}><Form.Item name="nextVisitAt" label="下次回访日期"><DatePicker style={{ width: '100%' }} placeholder="选择下次回访日期" /></Form.Item></Col>
        </Row>
        <Form.Item name="cooperationNotes" label="合作备注"><Input.TextArea rows={4} placeholder="记录合作相关的重要信息" /></Form.Item>
        <Form.Item><Space><Button type="primary" htmlType="submit" loading={props.submitting}>保存</Button><Button onClick={props.onCancel} disabled={props.submitting}>取消</Button></Space></Form.Item>
      </Form>
    </Modal>
  )
}
