'use client'

import { CalendarOutlined, EditOutlined, FileTextOutlined, PhoneOutlined } from '@ant-design/icons'
import { Button, Space, Table, Tag } from 'antd'
import type { ColumnGroupType, ColumnsType, ColumnType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'

import { ResizableHeaderCell } from '@/components/common/ResizableHeaderCell'

import type { CooperatingCustomer } from './types'

interface CooperatingTableProps {
  data: CooperatingCustomer[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  expiringSoon: boolean
  canUpdateCustomer: boolean
  onExpiringSoonChange: (value: boolean) => void
  onPageChange: (page: number, pageSize: number) => void
  onArchive: (customer: CooperatingCustomer) => void
  onEdit: (customer: CooperatingCustomer) => void
}

const initialWidths = {
  name: 100, company: 150, contactPerson: 100, phone: 120, operationManager: 120,
  contractAmount: 120, contractPeriod: 200, daysLeft: 100, visitFrequency: 100,
  nextVisitAt: 120, action: 160,
}

function daysUntilEnd(endDate?: string) {
  if (!endDate) return null
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function CooperatingTable(props: CooperatingTableProps) {
  const [widths, setWidths] = useState<Record<string, number>>(initialWidths)
  const resize = (key: string) => (_event: unknown, { size }: { size: { width: number } }) => {
    setWidths((current) => ({ ...current, [key]: size.width }))
  }
  const header = (key: string) => (column: ColumnType<CooperatingCustomer> | ColumnGroupType<CooperatingCustomer>) => ({
    width: 'width' in column ? column.width : undefined,
    onResize: resize(key),
  })
  const columns: ColumnsType<CooperatingCustomer> = [
    { title: '客户姓名', dataIndex: 'name', key: 'name', width: widths.name, onHeaderCell: header('name') },
    { title: '公司名称', dataIndex: 'company', key: 'company', width: widths.company, onHeaderCell: header('company') },
    { title: '联系人', dataIndex: 'contactPerson', key: 'contactPerson', width: widths.contactPerson, onHeaderCell: header('contactPerson') },
    {
      title: '电话', dataIndex: 'phone', key: 'phone', width: widths.phone,
      render: (phone?: string) => phone ? <Space><PhoneOutlined />{phone}</Space> : '-', onHeaderCell: header('phone'),
    },
    {
      title: '运营负责人', key: 'operationManager', width: widths.operationManager,
      render: (_, record) => record.operationManager?.realName || '-', onHeaderCell: header('operationManager'),
    },
    {
      title: '合同金额', dataIndex: 'contractAmount', key: 'contractAmount', width: widths.contractAmount,
      render: (amount?: number | string) => amount !== null && amount !== undefined ? `¥${Number(amount).toLocaleString('zh-CN')}` : '-', onHeaderCell: header('contractAmount'),
    },
    {
      title: '合同期限', key: 'contractPeriod', width: widths.contractPeriod,
      render: (_, record) => <Space direction="vertical" size={0}><span>开始: {record.contractStartDate ? dayjs(record.contractStartDate).format('YYYY-MM-DD') : '-'}</span><span>到期: {record.contractEndDate ? dayjs(record.contractEndDate).format('YYYY-MM-DD') : '-'}</span></Space>,
      onHeaderCell: header('contractPeriod'),
    },
    {
      title: '剩余天数', key: 'daysLeft', width: widths.daysLeft,
      render: (_, record) => {
        const days = daysUntilEnd(record.contractEndDate)
        if (days === null) return '-'
        const color = days <= 7 ? 'red' : days <= 30 ? 'orange' : 'green'
        return <Tag color={color}>{days}天</Tag>
      },
      onHeaderCell: header('daysLeft'),
    },
    {
      title: '回访频率', dataIndex: 'visitFrequency', key: 'visitFrequency', width: widths.visitFrequency,
      render: (frequency?: string) => frequency ? ({ WEEKLY: '每周', MONTHLY: '每月', QUARTERLY: '每季度', YEARLY: '每年' }[frequency] || frequency) : '-',
      onHeaderCell: header('visitFrequency'),
    },
    {
      title: '下次回访', dataIndex: 'nextVisitAt', key: 'nextVisitAt', width: widths.nextVisitAt,
      render: (text?: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-', onHeaderCell: header('nextVisitAt'),
    },
    {
      title: '操作', key: 'action', width: widths.action, fixed: 'right', onHeaderCell: header('action'),
      render: (_, record) => <Space size="small"><Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => props.onArchive(record)}>合同备案</Button>{props.canUpdateCustomer && <Button type="link" size="small" icon={<EditOutlined />} onClick={() => props.onEdit(record)}>编辑</Button>}</Space>,
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type={props.expiringSoon ? 'primary' : 'default'} icon={<CalendarOutlined />} onClick={() => props.onExpiringSoonChange(!props.expiringSoon)}>{props.expiringSoon ? '显示全部' : '查看即将到期'}</Button>
      </Space>
      <Table
        columns={columns} dataSource={props.data} rowKey="id" loading={props.loading}
        components={{ header: { cell: ResizableHeaderCell } }}
        pagination={{ current: props.page, pageSize: props.pageSize, total: props.total, showSizeChanger: true, showTotal: (count) => `共 ${count} 条`, onChange: props.onPageChange }}
        scroll={{ x: 1400 }}
      />
    </>
  )
}
