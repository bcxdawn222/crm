'use client'

import { DeleteOutlined, EditOutlined, ExportOutlined, EyeOutlined, SwapOutlined } from '@ant-design/icons'
import { Button, Input, Select, Space, Table, Tag } from 'antd'
import type { ColumnGroupType, ColumnsType, ColumnType } from 'antd/es/table'
import { useState } from 'react'

import { PermissionGuard } from '@/components/common/PermissionGuard'
import { ResizableHeaderCell } from '@/components/common/ResizableHeaderCell'

import type { Customer } from './types'

interface CustomerTableProps {
  customers: Customer[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  keyword: string
  category?: string
  status?: string
  canTransferCustomers: boolean
  onKeywordChange: (value: string) => void
  onCategoryChange: (value?: string) => void
  onStatusChange: (value?: string) => void
  onSearch: () => void
  onReset: () => void
  onPageChange: (page: number, pageSize: number) => void
  onView: (customer: Customer) => void
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
  onArchive: (customer: Customer) => void
  onTransfer: (customer: Customer) => void
}

const initialWidths = {
  name: 120, company: 200, phone: 130, email: 200, category: 100,
  status: 80, followUps: 80, lastFollowUp: 160, sales: 100, createdAt: 160, action: 260,
}

export function CustomerTable(props: CustomerTableProps) {
  const [widths, setWidths] = useState<Record<string, number>>(initialWidths)
  const resize = (key: string) => (_event: unknown, { size }: { size: { width: number } }) => {
    setWidths((current) => ({ ...current, [key]: size.width }))
  }
  const header = (key: string) => (column: ColumnType<Customer> | ColumnGroupType<Customer>) => ({
    width: 'width' in column ? column.width : undefined,
    onResize: resize(key),
  })

  const columns: ColumnsType<Customer> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: widths.name, onHeaderCell: header('name') },
    { title: '公司', dataIndex: 'company', key: 'company', width: widths.company, ellipsis: true, onHeaderCell: header('company') },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: widths.phone, onHeaderCell: header('phone') },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: widths.email, ellipsis: true, onHeaderCell: header('email') },
    { title: '分类', dataIndex: 'category', key: 'category', width: widths.category, render: (text: string) => <Tag color="blue">{text}</Tag>, onHeaderCell: header('category') },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: widths.status,
      render: (text: string) => <Tag color={text === 'ACTIVE' ? 'green' : 'red'}>{text === 'ACTIVE' ? '活跃' : '停用'}</Tag>,
      onHeaderCell: header('status'),
    },
    {
      title: '跟进数', dataIndex: '_count', key: 'followUps', width: widths.followUps,
      render: (_, record) => record._count?.followUps || 0, onHeaderCell: header('followUps'),
    },
    {
      title: '最近一次跟进时间', dataIndex: 'followUps', key: 'lastFollowUp', width: widths.lastFollowUp,
      render: (followUps: Customer['followUps']) => followUps?.length ? new Date(followUps[0].createdAt).toLocaleString('zh-CN') : '-',
      onHeaderCell: header('lastFollowUp'),
    },
    {
      title: '销售', dataIndex: 'sales', key: 'sales', width: widths.sales,
      render: (_, record) => record.sales?.realName || '-', onHeaderCell: header('sales'),
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: widths.createdAt,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'), onHeaderCell: header('createdAt'),
    },
    {
      title: '操作', key: 'action', width: widths.action, fixed: 'right', onHeaderCell: header('action'),
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => props.onView(record)}>查看</Button>
          <PermissionGuard action="update" subject="customer">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => props.onEdit(record)}>编辑</Button>
          </PermissionGuard>
          <PermissionGuard action="delete" subject="customer">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => props.onDelete(record)}>删除</Button>
          </PermissionGuard>
          {!record.isPublic && <PermissionGuard action="update" subject="customer"><Button type="link" size="small" icon={<ExportOutlined />} onClick={() => props.onArchive(record)}>归档</Button></PermissionGuard>}
          {!record.isPublic && props.canTransferCustomers && <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => props.onTransfer(record)}>转移</Button>}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="搜索姓名、公司、电话" value={props.keyword} onChange={(event) => props.onKeywordChange(event.target.value)} style={{ width: 200 }} onPressEnter={props.onSearch} />
        <Select placeholder="选择分类" value={props.category} onChange={props.onCategoryChange} style={{ width: 120 }} allowClear options={[
          { label: '潜在客户', value: '潜在客户' }, { label: '普通客户', value: '普通客户' },
          { label: '重要客户', value: '重要客户' }, { label: 'VIP客户', value: 'VIP客户' },
        ]} />
        <Select placeholder="选择状态" value={props.status} onChange={props.onStatusChange} style={{ width: 120 }} allowClear options={[
          { label: '活跃', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' },
        ]} />
        <Button type="primary" onClick={props.onSearch}>搜索</Button>
        <Button onClick={props.onReset}>重置</Button>
      </Space>
      <Table
        columns={columns}
        dataSource={props.customers}
        rowKey="id"
        loading={props.loading}
        components={{ header: { cell: ResizableHeaderCell } }}
        pagination={{
          current: props.page, pageSize: props.pageSize, total: props.total,
          showSizeChanger: true, showQuickJumper: true,
          showTotal: (count) => `共 ${count} 条`, onChange: props.onPageChange,
        }}
        scroll={{ x: 1200 }}
      />
    </>
  )
}
