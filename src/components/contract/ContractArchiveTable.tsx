'use client'

import { DeleteOutlined, DownloadOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons'
import { Button, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

import type { ContractArchive } from './contract-types'

interface ContractArchiveTableProps {
  archives: ContractArchive[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  canDelete: boolean
  deletingId: string | null
  onPageChange: (page: number, pageSize: number) => void
  onDownload: (archiveId: string) => void
  onPreview: (archive: ContractArchive) => void
  onHistory: (archive: ContractArchive) => void
  onDelete: (archive: ContractArchive) => void
}

export function ContractArchiveTable(props: ContractArchiveTableProps) {
  const columns: ColumnsType<ContractArchive> = [
    { title: '序号', key: 'index', width: 60, render: (_, __, index) => (props.page - 1) * props.pageSize + index + 1 },
    { title: '备案号', dataIndex: 'archiveNo', key: 'archiveNo', width: 180 },
    { title: '合同名称', dataIndex: 'contractName', key: 'contractName', width: 200 },
    { title: '版本', key: 'version', width: 80, render: (_, record) => <Tag color={record.isLatest ? 'green' : 'default'}>v{record.version}</Tag> },
    {
      title: '合同类型', dataIndex: 'contractType', key: 'contractType', width: 100,
      render: (type?: string) => type ? ({ SALES: '销售合同', SERVICE: '服务协议', COOPERATION: '合作协议', OTHER: '其他' }[type] || type) : '-',
    },
    { title: '文件大小', dataIndex: 'fileSize', key: 'fileSize', width: 100, render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB` },
    { title: '备案时间', dataIndex: 'archivedAt', key: 'archivedAt', width: 160, render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm') },
    { title: '备案人', key: 'archivedBy', width: 100, render: (_, record) => record.archivedUser?.realName || '-' },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => props.onDownload(record.id)}>下载</Button>
          {record.fileType.toLowerCase() === 'pdf' && <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => props.onPreview(record)}>预览</Button>}
          {record.hasOldVersions && <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => props.onHistory(record)}>历史</Button>}
          {props.canDelete && <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => props.onDelete(record)} loading={props.deletingId === record.id} disabled={props.deletingId !== null}>删除</Button>}
        </Space>
      ),
    },
  ]

  return (
    <Table
      columns={columns} dataSource={props.archives} rowKey="id" loading={props.loading}
      pagination={{ current: props.page, pageSize: props.pageSize, total: props.total, showSizeChanger: true, showTotal: (count) => `共 ${count} 条`, onChange: props.onPageChange }}
      scroll={{ x: 1200 }}
    />
  )
}
