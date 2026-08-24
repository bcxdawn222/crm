'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, DatePicker, Form, Input, message, Modal, Select, Spin } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useSession } from 'next-auth/react'
import { useFormDraft } from '@/hooks/useFormDraft'
import { apiRequest } from '@/lib/http/client'

interface AssigneeOption {
  id: string
  realName: string
  username: string
  department?: string | null
  position?: string | null
  isSelf: boolean
}

interface AssigneeResponse { success: true; data: { list: AssigneeOption[] } }
interface SubmitResponse { success: true }

interface TaskFormValues {
  title: string
  description?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: Dayjs
  assigneeId: string
}

interface TaskDraft {
  title?: string
  description?: string
  priority?: TaskFormValues['priority']
  dueDate?: string
  assigneeId?: string
}

function isTaskDraft(value: unknown): value is TaskDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as TaskDraft
  return (draft.title === undefined || typeof draft.title === 'string')
    && (draft.description === undefined || typeof draft.description === 'string')
    && (draft.priority === undefined || ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(draft.priority))
    && (draft.dueDate === undefined || typeof draft.dueDate === 'string')
    && (draft.assigneeId === undefined || typeof draft.assigneeId === 'string')
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
  const submissionIdRef = useRef('')
  const isSales = session?.user.roles.includes('sales') ?? false
  const draft = useFormDraft<TaskFormValues, TaskDraft>({
    key: 'tasks:create',
    enabled: open,
    form,
    serialize: (values) => ({
      title: values.title,
      description: values.description,
      priority: values.priority,
      dueDate: values.dueDate?.toISOString(),
      assigneeId: values.assigneeId,
    }),
    deserialize: (values) => ({
      ...values,
      dueDate: values.dueDate ? dayjs(values.dueDate) : undefined,
    }),
    validate: isTaskDraft,
  })

  async function loadAssignees(keyword = '') {
    const requestSequence = ++requestSequenceRef.current
    setIsLoadingAssignees(true)
    setAssigneeLoadError(false)

    try {
      const params = new URLSearchParams({ page: '1', pageSize: '20' })
      if (keyword.trim()) params.set('keyword', keyword.trim())
      const result = await apiRequest<AssigneeResponse>(`/api/tasks/assignees?${params}`)
      if (requestSequence !== requestSequenceRef.current) return

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
    submissionIdRef.current = crypto.randomUUID()
    form.setFieldsValue({ priority: 'MEDIUM' })
    if (draft.restore()) message.info('已恢复未提交的任务草稿')
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
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await apiRequest<SubmitResponse>('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': submissionIdRef.current,
        },
        body: JSON.stringify({
          ...values,
          dueDate: values.dueDate?.format('YYYY-MM-DD') || null,
        }),
      }, {
        requestKey: `task-create-${submissionIdRef.current}`,
      })

      message.success('创建成功')
      draft.clear()
      onClose()
      onSaved()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建任务失败')
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
    <Modal
      title="创建任务"
      open={open}
      onCancel={() => {
        if (!isSubmitting) {
          draft.clear()
          onClose()
        }
      }}
      footer={null}
      width={600}
      destroyOnClose
      closable={!isSubmitting}
      maskClosable={!isSubmitting}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={draft.save}>
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
