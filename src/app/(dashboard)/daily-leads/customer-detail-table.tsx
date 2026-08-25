'use client'

import { UserAddOutlined } from '@ant-design/icons'
import { Button, message, Modal, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'

import { apiRequest } from '@/lib/http/client'

import { type DailyLeadCustomer, sourceLabel } from './types'

interface CustomerDetailTableProps {
  customers: DailyLeadCustomer[]
  canUpdateCustomer: boolean
  onTransfer: () => void
}

const levelLabels: Record<string, string> = {
  POTENTIAL: '潜在',
  NORMAL: '普通',
  IMPORTANT: '重要',
  VIP: 'VIP',
}

const levelColors: Record<string, string> = {
  POTENTIAL: 'default',
  NORMAL: 'blue',
  IMPORTANT: 'orange',
  VIP: 'red',
}

export function CustomerDetailTable({
  customers,
  canUpdateCustomer,
  onTransfer,
}: CustomerDetailTableProps) {
  const [transferring, setTransferring] = useState<string | null>(null)

  const handleTransfer = (customerId: string) => {
    Modal.confirm({
      title: '确认转入我的客户',
      content: '确定要将此客户转入您的名下吗?',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setTransferring(customerId)
        const requestId = crypto.randomUUID()
        try {
          await apiRequest<{ success: true }>('/api/customers/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
            body: JSON.stringify({ customerId }),
          }, { requestKey: `daily-lead-transfer:${customerId}:${requestId}` })
          message.success('客户已成功转入您的名下')
          onTransfer()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '转移失败')
        } finally {
          setTransferring(null)
        }
      },
    })
  }

  const columns: ColumnsType<DailyLeadCustomer> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '公司', dataIndex: 'company', key: 'company', width: 150 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 180 },
    {
      title: '等级', dataIndex: 'level', key: 'level', width: 80,
      render: (level: string) => <Tag color={levelColors[level] || 'default'}>{levelLabels[level] || level}</Tag>,
    },
    { title: '来源', dataIndex: 'source', key: 'source', width: 100, render: sourceLabel },
    {
      title: '备注', dataIndex: 'notes', key: 'notes', width: 200, ellipsis: true,
      render: (notes?: string) => (
        <Typography.Text ellipsis={{ tooltip: notes }} style={{ maxWidth: 200 }}>
          {notes || '-'}
        </Typography.Text>
      ),
    },
    { title: '销售', dataIndex: 'sales', key: 'sales', width: 100, render: (sales) => sales?.realName || '-' },
    {
      title: '状态', dataIndex: 'isPublic', key: 'isPublic', width: 80,
      render: (isPublic: boolean) => <Tag color={isPublic ? 'orange' : 'green'}>{isPublic ? '公海池' : '我的客户'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss') },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
      render: (_, record) => canUpdateCustomer ? (
        <Button
          type="primary"
          size="small"
          icon={<UserAddOutlined />}
          loading={transferring === record.id}
          disabled={!record.isPublic}
          onClick={() => handleTransfer(record.id)}
        >
          转入我的客户
        </Button>
      ) : null,
    },
  ]

  return <Table columns={columns} dataSource={customers} rowKey="id" size="small" pagination={false} scroll={{ x: 1200 }} />
}
