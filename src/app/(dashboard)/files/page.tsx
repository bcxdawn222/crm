'use client'

import { useCallback, useEffect, useState } from 'react'
import { DeleteOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Card, message, Popconfirm, Space, Table, Tag, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadRequestOption } from 'rc-upload/lib/interface'

import { usePermission } from '@/hooks/usePermission'
import { apiRequest } from '@/lib/http/client'


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
  data: { list: FileItem[]; total: number; page: number; pageSize: number }
  error?: string
}

export default function FilesPage() {
  const { can } = usePermission()
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
      const result = await apiRequest<FileResponse>(`/api/files?${params}`)
      setFiles(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载文件失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const uploadFile = async ({ file, onError, onSuccess }: UploadRequestOption) => {
    if (uploading) {
      onError?.(new Error('文件正在上传，请稍候'))
      return
    }
    if (!(file instanceof File)) {
      onError?.(new Error('请选择有效文件'))
      return
    }
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const result = await apiRequest<{ success: boolean; data: FileItem }>('/api/files', { method: 'POST', body: formData }, { requestKey: `file-upload:${file.name}:${file.size}` })
      onSuccess?.(result)
      message.success('文件上传成功')
      if (page === 1) await loadFiles()
      else setPage(1)
    } catch (error) {
      const failure = error instanceof Error ? error : new Error('上传失败')
      onError?.(failure)
      message.error(failure.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = async (id: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      await apiRequest<{ success: boolean }>(`/api/files/${id}`, { method: 'DELETE' }, { requestKey: `file-delete:${id}` })
      message.success('文件已删除')
      if (files.length === 1 && page > 1) setPage((current) => current - 1)
      else await loadFiles()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除文件失败')
      throw error
    } finally {
      setDeletingId(null)
    }
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
            <Popconfirm
              title="确认删除该文件？"
              okButtonProps={{ loading: deletingId === record.id }}
              onConfirm={() => deleteFile(record.id)}
            >
              <Button type="link" danger icon={<DeleteOutlined />} disabled={deletingId !== null}>删除</Button>
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
        <Upload
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
          disabled={uploading}
          showUploadList={false}
          customRequest={uploadFile}
        >
          <Button icon={<UploadOutlined />} loading={uploading}>上传文件</Button>
        </Upload>
      ) : null}
    >
      <Table
        columns={columns}
        dataSource={files}
        loading={loading}
        rowKey="id"
        scroll={{ x: 980 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (count) => `共 ${count} 条`,
          onChange: (nextPage, nextPageSize) => {
            if (nextPageSize !== pageSize) {
              setPageSize(nextPageSize)
              setPage(1)
              return
            }
            setPage(nextPage)
          },
        }}
      />
    </Card>
  )
}
