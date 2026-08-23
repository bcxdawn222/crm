'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, DatePicker, Form, Input, message, Modal, Select, Spin } from 'antd'
import type { Dayjs } from 'dayjs'
import { useSession } from 'next-auth/react'

interface AssigneeOption {
  id: string
  realName: string
  username: string
  department?: string | null
  position?: string | null
  isSelf: boolean
}

interface AssigneeResponse {
  success?: boolean
  data?: { list: AssigneeOption[] }
  error?: string
}

interface SubmitResponse {
  success?: boolean
  error?: string
}

interface TaskFormValues {
  title: string
  description?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: Dayjs
  assigneeId: string
}

interface TaskFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function TaskFormModal({ open, onClose, onSaved }: TaskFormModalProps) {
  const { data: session } = useSession()
  const [form] = Form.useForm<TaskFormValues>()
  const [assignees, setAssignees] = useState<AssigneeOption[]>([])
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false)
  const [assigneeLoadError, setAssigneeLoadError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const requestSequenceRef = useRef(0)
  const isSales = session?.user.roles.includes('sales') ?? false

  async function loadAssignees(keyword = '') {
    const requestSequence = ++requestSequenceRef.current
    setIsLoadingAssignees(true)
    setAssigneeLoadError(false)

    try {
      const params = new URLSearchParams({ page: '1', pageSize: '20' })
      if (keyword.trim()) params.set('keyword', keyword.trim())
      const response = await fetch(`/api/tasks/assignees?${params}`)
      const result = await response.json() as AssigneeResponse
      if (requestSequence !== requestSequenceRef.current) return
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || '负责人加载失败')
      }

      setAssignees(result.data.list)
      const self = result.data.list.find((assignee) => assignee.isSelf)
      if (isSales && self) form.setFieldValue('assigneeId', self.id)
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current) return
      setAssigneeLoadError(true)
      setAssignees([])
    } finally {
      if (requestSequence === requestSequenceRef.current) setIsLoadingAssignees(false)
    }
  }

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({ priority: 'MEDIUM' })
    void loadAssignees()

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [open, isSales])

  function handleAssigneeSearch(value: string) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => void loadAssignees(value), 300)
  }

  async function handleSubmit(values: TaskFormValues) {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          dueDate: values.dueDate?.format('YYYY-MM-DD') || null,
        }),
      })
      const result = await response.json() as SubmitResponse
      if (!response.ok || !result.success) {
        message.error(result.error || '操作失败')
        return
      }

      message.success('创建成功')
      onClose()
      onSaved()
    } catch (error) {
      message.error('网络错误')
    } finally {
      setIsSubmitting(false)
    }
  }

  const assigneeOptions = assignees.map((assignee) => ({
    value: assignee.id,
    label: assignee.department
      ? `${assignee.realName} - ${assignee.department}`
      : `${assignee.realName} (${assignee.username})`,
  }))

  return (
    <Modal title="创建任务" open={open} onCancel={onClose} footer={null} width={600} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请输入任务标题' }]}>
          <Input placeholder="请输入任务标题" />
        </Form.Item>
        <Form.Item name="description" label="任务描述">
          <Input.TextArea rows={4} placeholder="请输入任务描述" />
        </Form.Item>
        <Form.Item name="priority" label="优先级">
          <Select options={[
            { label: '低', value: 'LOW' },
            { label: '中', value: 'MEDIUM' },
            { label: '高', value: 'HIGH' },
            { label: '紧急', value: 'URGENT' },
          ]} />
        </Form.Item>
        <Form.Item name="dueDate" label="截止日期">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="assigneeId" label="负责人" rules={[{ required: true, message: '请选择负责人' }]}>
          <Select
            showSearch
            filterOption={false}
            disabled={isSales}
            placeholder={isSales ? '任务将指派给自己' : '输入姓名、账号或部门搜索'}
            options={assigneeOptions}
            loading={isLoadingAssignees}
            onSearch={handleAssigneeSearch}
            onDropdownVisibleChange={(visible) => visible && void loadAssignees()}
            notFoundContent={
              isLoadingAssignees
                ? <Spin size="small" />
                : assigneeLoadError ? '负责人加载失败，请重新打开下拉框' : '暂无可选负责人'
            }
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isSubmitting} block>创建</Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
