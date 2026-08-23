'use client'

import { useCallback, useEffect, useState } from 'react'
import { DeleteOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Card, message, Popconfirm, Space, Table, Tag, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadRequestOption } from 'rc-upload/lib/interface'

import { usePermission } from '@/hooks/usePermission'


interface FileItem {
  id: string
  originalName: string
  size: number
  mimeType: string
  category: string
  downloadCount: number
  createdAt: string
  uploader: { realName: string }
}

interface FileResponse {
  success: boolean
  data: { list: FileItem[]; total: number }
  error?: string
}

export default function FilesPage() {
  const { can } = usePermission()
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/files?page=1&pageSize=50')
      const result = (await response.json()) as FileResponse
      if (!response.ok) throw new Error(result.error || '加载文件失败')
      setFiles(result.data.list)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载文件失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const uploadFile = async ({ file, onError, onSuccess }: UploadRequestOption) => {
    const formData = new FormData()
    formData.append('file', file as Blob)
    try {
      const response = await fetch('/api/files', { method: 'POST', body: formData })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || '上传失败')
      onSuccess?.(result)
      message.success('文件上传成功')
      await loadFiles()
    } catch (error) {
      const failure = error instanceof Error ? error : new Error('上传失败')
      onError?.(failure)
      message.error(failure.message)
    }
  }

  const deleteFile = async (id: string) => {
    const response = await fetch(`/api/files/${id}`, { method: 'DELETE' })
    const result = await response.json() as { error?: string }
    if (!response.ok) {
      message.error(result.error || '删除失败')
      return
    }
    message.success('文件已删除')
    await loadFiles()
  }

  const columns: ColumnsType<FileItem> = [
    { title: '文件名', dataIndex: 'originalName', ellipsis: true },
    { title: '大小', dataIndex: 'size', width: 110, render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB` },
    { title: '类型', dataIndex: 'category', width: 100, render: (value: string) => <Tag>{value}</Tag> },
    { title: '上传人', dataIndex: ['uploader', 'realName'], width: 120 },
    { title: '下载', dataIndex: 'downloadCount', width: 80 },
    { title: '上传时间', dataIndex: 'createdAt', width: 180, render: (value: string) => new Date(value).toLocaleString() },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<DownloadOutlined />} href={`/api/files/${record.id}`}>下载</Button>
          {can('delete', 'file') && (
            <Popconfirm title="确认删除该文件？" onConfirm={() => void deleteFile(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="文件共享"
      extra={can('create', 'file') ? (
        <Upload accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp" showUploadList={false} customRequest={uploadFile}>
          <Button icon={<UploadOutlined />}>上传文件</Button>
        </Upload>
      ) : null}
    >
      <Table columns={columns} dataSource={files} loading={loading} rowKey="id" scroll={{ x: 980 }} pagination={{ pageSize: 20 }} />
    </Card>
  )
}
