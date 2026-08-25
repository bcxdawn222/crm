'use client'

import { Button, DatePicker, Divider, Form, Input, Modal, Tag } from 'antd'
import type { FormInstance } from 'antd'

import { type DailyReport, type DailyReportFormValues, statusMap } from './types'

interface ReportFormModalProps {
  open: boolean
  form: FormInstance<DailyReportFormValues>
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: DailyReportFormValues) => void
  onValuesChange: () => void
}

export function ReportFormModal(props: ReportFormModalProps) {
  return (
    <Modal title="提交日报" open={props.open} onCancel={props.onCancel} footer={null} width={700} closable={!props.submitting} maskClosable={!props.submitting}>
      <Form form={props.form} layout="vertical" onFinish={props.onSubmit} onValuesChange={props.onValuesChange}>
        <Form.Item name="reportDate" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="content" label="今日工作内容" rules={[{ required: true, message: '请输入工作内容' }]}>
          <Input.TextArea rows={6} placeholder="请详细描述今天的工作内容" />
        </Form.Item>
        <Form.Item name="tomorrowPlan" label="明日计划"><Input.TextArea rows={4} placeholder="请描述明天的工作计划" /></Form.Item>
        <Form.Item name="issues" label="遇到的问题"><Input.TextArea rows={4} placeholder="请描述工作中遇到的问题" /></Form.Item>
        <Form.Item><Button type="primary" htmlType="submit" block loading={props.submitting}>提交</Button></Form.Item>
      </Form>
    </Modal>
  )
}

export function ReportDetailModal(props: { report: DailyReport | null; onClose: () => void }) {
  const { report } = props
  return (
    <Modal title="日报详情" open={Boolean(report)} onCancel={props.onClose} footer={null} width={700}>
      {report && (
        <div>
          <p><strong>日期:</strong> {new Date(report.reportDate).toLocaleDateString()}</p>
          <p><strong>提交人:</strong> {report.author?.realName}</p>
          <p><strong>状态:</strong> <Tag color={statusMap[report.status]?.color}>{statusMap[report.status]?.text}</Tag></p>
          <Divider />
          <h4>今日工作内容</h4><p>{report.content}</p>
          {report.tomorrowPlan && <><h4>明日计划</h4><p>{report.tomorrowPlan}</p></>}
          {report.issues && <><h4>遇到的问题</h4><p>{report.issues}</p></>}
        </div>
      )}
    </Modal>
  )
}
