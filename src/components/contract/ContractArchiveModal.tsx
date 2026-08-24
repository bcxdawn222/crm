'use client'

import { useState, useEffect } from 'react'
import { Modal, Table, Button, Space, message, Tag, Upload, Form, Input, DatePicker, InputNumber, Select, Divider } from 'antd'
import { DownloadOutlined, EyeOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, InboxOutlined, HistoryOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import ContractUploadForm from './ContractUploadForm'
import VersionHistoryModal from './VersionHistoryModal'
import PDFPreviewModal from './PDFPreviewModal'
import { ApiError, apiRequest } from '@/lib/http/client'
import { usePermission } from '@/hooks/usePermission'

const { TextArea } = Input

interface ContractArchive {
  id: string
  archiveNo: string
  contractName: string
  contractType?: string
  version: number
  isLatest: boolean
  fileName: string
  fileSize: number
  fileType: string
  ossUrl: string
  archivedAt: string
  remarks?: string
  hasOldVersions: boolean
  totalVersions: number
  archivedUser?: {
    id: string
    realName: string
  }
}

interface ContractArchiveModalProps {
  visible: boolean
  customerId: string
  customerName: string
  onClose: () => void
  onSuccess: () => void
}

export default function ContractArchiveModal({
  visible,
  customerId,
  customerName,
  onClose,
  onSuccess
}: ContractArchiveModalProps) {
  const { can } = usePermission()
  const canUpdateCustomer = can('update', 'customer')
  const [loading, setLoading] = useState(false)
  const [archives, setArchives] = useState<ContractArchive[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [versionHistoryVisible, setVersionHistoryVisible] = useState(false)
  const [selectedArchive, setSelectedArchive] = useState<ContractArchive | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [showAllVersions, setShowAllVersions] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load archives
  const loadArchives = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        showAllVersions: showAllVersions.toString()
      })
      
      const result = await apiRequest<{
        success: true
        data: { list: ContractArchive[]; total: number }
      }>(`/api/customers/${customerId}/contract-archives?${params}`)
      setArchives(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载合同备案失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible && customerId) {
      loadArchives()
    }
  }, [visible, customerId, page, pageSize, showAllVersions])

  // Handle download
  const handleDownload = (archiveId: string) => {
    window.open(`/api/contract-archives/${archiveId}/download`, '_blank')
  }

  // Handle preview
  const handlePreview = async (archive: ContractArchive) => {
    try {
      const result = await apiRequest<{ success: true; data: { previewUrl: string } }>(
        `/api/contract-archives/${archive.id}/preview`
      )
      setPreviewUrl(result.data.previewUrl)
      setPreviewVisible(true)
    } catch (error) {
      const payload = error instanceof ApiError && typeof error.payload === 'object' && error.payload !== null
        ? error.payload as { downloadUrl?: string }
        : undefined
      message.error(error instanceof Error ? error.message : '预览失败')
      if (payload?.downloadUrl) {
        Modal.confirm({
          title: '文件类型不支持预览',
          content: '该文件类型不支持在线预览，是否下载查看？',
          onOk: () => window.open(payload.downloadUrl, '_blank'),
        })
      }
    }
  }

  // Handle delete
  const handleDelete = (archive: ContractArchive) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除合同备案"${archive.contractName}"吗？此操作不可恢复！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        if (deletingId) return
        setDeletingId(archive.id)
        try {
          await apiRequest<{ success: true }>(`/api/contract-archives/${archive.id}`, {
            method: 'DELETE'
          }, { requestKey: `contract-delete-${archive.id}` })
          message.success('删除成功')
          await loadArchives()
          onSuccess()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '删除合同备案失败')
        } finally {
          setDeletingId(null)
        }
      }
    })
  }

  // Handle upload success
  const handleUploadSuccess = () => {
    setUploadModalVisible(false)
    loadArchives()
    onSuccess()
    message.success('合同备案成功')
  }

  // Table columns
  const columns: ColumnsType<ContractArchive> = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_, __, index) => (page - 1) * pageSize + index + 1
    },
    {
      title: '备案号',
      dataIndex: 'archiveNo',
      key: 'archiveNo',
      width: 180,
    },
    {
      title: '合同名称',
      dataIndex: 'contractName',
      key: 'contractName',
      width: 200,
    },
    {
      title: '版本',
      key: 'version',
      width: 80,
      render: (_, record) => (
        <Tag color={record.isLatest ? 'green' : 'default'}>
          v{record.version}
        </Tag>
      )
    },
    {
      title: '合同类型',
      dataIndex: 'contractType',
      key: 'contractType',
      width: 100,
      render: (type) => {
        const typeMap: Record<string, string> = {
          SALES: '销售合同',
          SERVICE: '服务协议',
          COOPERATION: '合作协议',
          OTHER: '其他'
        }
        return type ? typeMap[type] || type : '-'
      }
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (size) => `${(size / 1024 / 1024).toFixed(2)} MB`
    },
    {
      title: '备案时间',
      dataIndex: 'archivedAt',
      key: 'archivedAt',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '备案人',
      key: 'archivedBy',
      width: 100,
      render: (_, record) => record.archivedUser?.realName || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id)}
          >
            下载
          </Button>
          {record.fileType === 'pdf' && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            >
              预览
            </Button>
          )}
          {record.hasOldVersions && (
            <Button
              type="link"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => {
                setSelectedArchive(record)
                setVersionHistoryVisible(true)
              }}
            >
              历史
            </Button>
          )}
          {canUpdateCustomer && <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            loading={deletingId === record.id}
          >
            删除
          </Button>}
        </Space>
      )
    }
  ]

  return (
    <>
      <Modal
        title={`合同备案 - ${customerName}`}
        open={visible}
        onCancel={onClose}
        footer={null}
        width={1400}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            {canUpdateCustomer && <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              新增备案
            </Button>}
            <Button
              icon={<ReloadOutlined />}
              onClick={loadArchives}
            >
              刷新
            </Button>
            <span>
              显示所有版本：
              <Select
                value={showAllVersions}
                onChange={setShowAllVersions}
                style={{ width: 120 }}
                options={[
                  { label: '仅最新', value: false },
                  { label: '全部', value: true }
                ]}
              />
            </span>
          </Space>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <Table
          columns={columns}
          dataSource={archives}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (newPage, newPageSize) => {
              setPage(newPage)
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize)
                setPage(1)
              }
            }
          }}
          scroll={{ x: 1200 }}
        />
      </Modal>

      {/* Upload Form Modal */}
      <ContractUploadForm
        visible={uploadModalVisible}
        customerId={customerId}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* Version History Modal */}
      {selectedArchive && (
        <VersionHistoryModal
          visible={versionHistoryVisible}
          archiveId={selectedArchive.id}
          contractName={selectedArchive.contractName}
          onClose={() => {
            setVersionHistoryVisible(false)
            setSelectedArchive(null)
          }}
          onPreview={handlePreview}
          onDownload={handleDownload}
        />
      )}

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        visible={previewVisible}
        previewUrl={previewUrl}
        onClose={() => {
          setPreviewVisible(false)
          setPreviewUrl('')
        }}
      />
    </>
  )
}
