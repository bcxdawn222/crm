'use client'

import { useEffect, useState } from 'react'
import { Button, Card, message, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

import { usePermission } from '@/hooks/usePermission'
import { apiRequest } from '@/lib/http/client'
import { TaskFormModal } from './task-form-modal'

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

interface TaskRecord {
  id: string
  title: string
  description?: string
  priority: TaskPriority
  status: TaskStatus
  dueDate?: string
  assigneeId: string
  creatorId: string
  createdAt: string
  assignee?: { realName: string; avatar?: string }
  creator?: { realName: string }
}

interface TaskListResponse {
  success: true
  data: { list: TaskRecord[]; total: number }
}

const PRIORITY_MAP: Record<TaskPriority, { text: string; color: string }> = {
  LOW: { text: '低', color: 'default' },
  MEDIUM: { text: '中', color: 'blue' },
  HIGH: { text: '高', color: 'orange' },
  URGENT: { text: '紧急', color: 'red' },
}

const STATUS_MAP: Record<TaskStatus, { text: string; color: string }> = {
  TODO: { text: '待办', color: 'default' },
  IN_PROGRESS: { text: '进行中', color: 'blue' },
  COMPLETED: { text: '已完成', color: 'green' },
  CANCELLED: { text: '已取消', color: 'red' },
}

export default function TasksPage() {
  const { can, roles } = usePermission()
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<TaskStatus>()
  const [modalVisible, setModalVisible] = useState(false)
  const hasCreatePermission = can('create', 'task') || roles.includes('sales')

  async function loadTasks(targetPage = page, targetStatus = status) {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        pageSize: pageSize.toString(),
      })
      if (targetStatus) params.set('status', targetStatus)

      const result = await apiRequest<TaskListResponse>(`/api/tasks?${params}`)
      setTasks(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载任务失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTasks()
  }, [page, pageSize])

  function handleSearch() {
    setPage(1)
    void loadTasks(1)
  }

  function handleReset() {
    setStatus(undefined)
    setPage(1)
    void loadTasks(1, undefined)
  }

  const columns: ColumnsType<TaskRecord> = [
    { title: '任务标题', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 100,
      render: (value: TaskPriority) => <Tag color={PRIORITY_MAP[value].color}>{PRIORITY_MAP[value].text}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (value: TaskStatus) => <Tag color={STATUS_MAP[value].color}>{STATUS_MAP[value].text}</Tag>,
    },
    {
      title: '负责人', key: 'assignee', width: 100,
      render: (_, record) => record.assignee?.realName || '-',
    },
    {
      title: '截止日期', dataIndex: 'dueDate', key: 'dueDate', width: 120,
      render: (date?: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: '创建人', key: 'creator', width: 100,
      render: (_, record) => record.creator?.realName || '-',
    },
  ]

  return (
    <div>
      <Card
        title="任务管理"
        extra={hasCreatePermission
          ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>创建任务</Button>
          : null}
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select<TaskStatus>
            placeholder="选择状态"
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            allowClear
            options={Object.entries(STATUS_MAP).map(([value, config]) => ({ value, label: config.text }))}
          />
          <Button type="primary" onClick={handleSearch}>搜索</Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage)
              setPageSize(nextPageSize)
            },
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      <TaskFormModal
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={() => void loadTasks()}
      />
    </div>
  )
}
