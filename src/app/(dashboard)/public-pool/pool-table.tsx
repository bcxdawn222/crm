'use client'

import { UserAddOutlined } from '@ant-design/icons'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import type { PublicPoolCustomer, QuotaStatus } from './types'

interface PoolTableProps {
  customers: PublicPoolCustomer[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  quota: QuotaStatus | null
  canUpdate: boolean
  claimingId: string | null
  onPageChange: (page: number, pageSize: number) => void
  onClaim: (customer: PublicPoolCustomer) => void
}

const reasonMap: Record<string, { text: string; color: string }> = {
  RULE_1: { text: '长期未跟进(90天)', color: 'red' }, RULE_2: { text: '创建后未跟进(30天)', color: 'orange' },
  RULE_3: { text: '合同到期未续签', color: 'purple' }, RULE_4: { text: '客户已失效', color: 'default' },
  RULE_5: { text: '多次跟进无进展', color: 'blue' }, AUTO_RECYCLE: { text: '超期自动回收', color: 'cyan' },
}

export function PoolTable(props: PoolTableProps) {
  const columns: ColumnsType<PublicPoolCustomer> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 120 },
    { title: '公司', dataIndex: 'company', key: 'company', ellipsis: true },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100, render: (text) => <Tag color="blue">{text}</Tag> },
    { title: '原销售', dataIndex: 'sales', key: 'sales', width: 100, render: (_, record) => record.sales?.realName || '-' },
    {
      title: '进入原因', dataIndex: 'publicPoolReason', key: 'publicPoolReason', width: 180,
      render: (reason?: string) => { const item = reason ? reasonMap[reason] || { text: reason, color: 'default' } : { text: '-', color: 'default' }; return <Tag color={item.color}>{item.text}</Tag> },
    },
    { title: '进入时间', dataIndex: 'publicPoolEnteredAt', key: 'publicPoolEnteredAt', width: 160, render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-' },
    { title: '最后跟进', dataIndex: 'lastFollowUpAt', key: 'lastFollowUpAt', width: 160, render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '从未跟进' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (text) => new Date(text).toLocaleString('zh-CN') },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
      render: (_, record) => {
        if (!props.canUpdate) return null
        const canClaim = Boolean(props.quota?.canClaim || props.quota?.isAdmin)
        return <Button type="primary" size="small" icon={<UserAddOutlined />} disabled={!canClaim} loading={props.claimingId === record.id} onClick={() => props.onClaim(record)}>{canClaim ? '认领' : '已达上限'}</Button>
      },
    },
  ]
  return (
    <div className="crm-public-pool-table">
      <Table
        columns={columns}
        dataSource={props.customers}
        rowKey="id"
        loading={props.loading}
        pagination={{
          current: props.page, pageSize: props.pageSize, total: props.total,
          showSizeChanger: true, showQuickJumper: true, showTotal: (count) => `共 ${count} 条`, onChange: props.onPageChange,
        }}
        scroll={{ x: 1200 }}
      />
    </div>
  )
}
