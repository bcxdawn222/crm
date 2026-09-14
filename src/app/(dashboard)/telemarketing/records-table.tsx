'use client'

import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PhoneOutlined } from '@ant-design/icons'
import { Button, Popconfirm, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

import type { TelemarketingRecord } from './types'

interface RecordsTableProps {
  data: TelemarketingRecord[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  canUpdate: boolean
  canConvert: boolean
  deletingId: string | null
  onPageChange: (page: number, pageSize: number) => void
  onEdit: (record: TelemarketingRecord) => void
  onConvert: (record: TelemarketingRecord) => void
  onDelete: (id: string) => void
}

const statusMap: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'default', text: '待拨打' }, CONNECTED: { color: 'green', text: '已接通' },
  NOT_ANSWERED: { color: 'orange', text: '未接听' }, BUSY: { color: 'volcano', text: '忙线' },
  INVALID: { color: 'red', text: '无效号码' }, CALLBACK: { color: 'blue', text: '需回拨' },
  FOLLOW_UP: { color: 'purple', text: '需跟进' }, CONVERTED: { color: 'cyan', text: '已转化' },
}

const resultMap: Record<string, string> = {
  INTERESTED: '有意向', NOT_INTERESTED: '无意向', NEED_FOLLOWUP: '需跟进',
  WRONG_NUMBER: '错号', EMPTY_NUMBER: '空号', OTHER: '其他',
}

export function RecordsTable(props: RecordsTableProps) {
  const columns: ColumnsType<TelemarketingRecord> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '公司', dataIndex: 'company', key: 'company', width: 150 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 120, render: (phone) => <Space><PhoneOutlined />{phone}</Space> },
    { title: '职位', dataIndex: 'position', key: 'position', width: 100 },
    { title: '行业', dataIndex: 'industry', key: 'industry', width: 100 },
    { title: '拨打次数', dataIndex: 'callTimes', key: 'callTimes', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status) => { const item = statusMap[status] || { color: 'default', text: status }; return <Tag color={item.color}>{item.text}</Tag> },
    },
    { title: '结果', dataIndex: 'result', key: 'result', width: 100, render: (result) => result ? resultMap[result] || result : '-' },
    { title: '有效性', dataIndex: 'isEffective', key: 'isEffective', width: 80, render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? '有效' : '无效'}</Tag> },
    {
      title: '对应销售', key: 'sales', width: 120,
      render: (_, record) => record.sales?.realName || '-',
    },
    { title: '备注', dataIndex: 'notes', key: 'notes', width: 200, ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm') },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space>
          {props.canUpdate && <Button type="link" size="small" icon={<EditOutlined />} onClick={() => props.onEdit(record)}>编辑</Button>}
          {props.canConvert && !record.customerId && <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => props.onConvert(record)}>转入客户</Button>}
          {props.canUpdate && (
            <Popconfirm title="确认删除" description="确定要删除这条电销记录吗?" onConfirm={() => props.onDelete(record.id)} okButtonProps={{ loading: props.deletingId === record.id }}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      dataSource={props.data}
      rowKey="id"
      loading={props.loading}
      pagination={{
        current: props.page, pageSize: props.pageSize, total: props.total, showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条`, onChange: props.onPageChange,
      }}
      scroll={{ x: 1760 }}
    />
  )
}
