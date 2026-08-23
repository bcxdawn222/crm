'use client'

import { Card, Table, Button, Space, Upload, message, Tag } from 'antd'
import { UploadOutlined, DownloadOutlined, DeleteOutlined, FolderOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface FileItem {
  id: string
  name: string
  size: number
  type: string
  category: string
  uploader?: {
    realName: string
  }
  createdAt: string
}

const mockFiles: FileItem[] = [
  {
    id: '1',
    name: '产品手册.pdf',
    size: 2048576,
    type: 'application/pdf',
    category: '文档',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: '客户资料.xlsx',
    size: 1024000,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: '表格',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
]

export default function FilesPage() {
  const columns: ColumnsType<FileItem> = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <FolderOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size) => `${(size / 1024 / 1024).toFixed(2)} MB`,
    },
    {
      title: '类型',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: () => (
        <Space size="small">
          <Button type="link" size="small" icon={<DownloadOutlined />}>
            下载
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title="文件共享"
        extra={
          <Upload>
            <Button icon={<UploadOutlined />}>上传文件</Button>
          </Upload>
        }
      >
        <Table
          columns={columns}
          dataSource={mockFiles}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>
    </div>
  )
}
