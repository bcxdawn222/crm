'use client'

import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Divider, Modal, Select, Space, message } from 'antd'
import { useEffect, useRef, useState } from 'react'

import { usePermission } from '@/hooks/usePermission'
import { ApiError, apiRequest } from '@/lib/http/client'

import { ContractArchiveTable } from './ContractArchiveTable'
import ContractUploadForm from './ContractUploadForm'
import PDFPreviewModal from './PDFPreviewModal'
import VersionHistoryModal from './VersionHistoryModal'
import type { ContractArchive } from './contract-types'

interface ContractArchiveModalProps {
  visible: boolean
  customerId: string
  customerName: string
  onClose: () => void
  onSuccess: () => void
}

export default function ContractArchiveModal(props: ContractArchiveModalProps) {
  const { can } = usePermission()
  const canUpdateCustomer = can('update', 'customer')
  const [loading, setLoading] = useState(false)
  const [archives, setArchives] = useState<ContractArchive[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [selectedArchive, setSelectedArchive] = useState<ContractArchive | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [showAllVersions, setShowAllVersions] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const requestSequenceRef = useRef(0)

  const loadArchives = async () => {
    const requestSequence = ++requestSequenceRef.current
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        showAllVersions: showAllVersions.toString(),
      })
      const result = await apiRequest<{ success: true; data: { list: ContractArchive[]; total: number } }>(`/api/customers/${props.customerId}/contract-archives?${params}`)
      if (requestSequence !== requestSequenceRef.current) return
      setArchives(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      if (requestSequence === requestSequenceRef.current) message.error(error instanceof Error ? error.message : '加载合同备案失败')
    } finally {
      if (requestSequence === requestSequenceRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (props.visible && props.customerId) void loadArchives()
  }, [props.visible, props.customerId, page, pageSize, showAllVersions])

  const handlePreview = async (archive: ContractArchive) => {
    try {
      const result = await apiRequest<{ success: true; data: { previewUrl: string } }>(`/api/contract-archives/${archive.id}/preview`)
      setPreviewUrl(result.data.previewUrl)
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

  const handleDelete = (archive: ContractArchive) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除合同备案“${archive.contractName}”吗？此操作不可恢复！`,
      okText: '确认删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        if (deletingId) return
        setDeletingId(archive.id)
        try {
          await apiRequest<{ success: true }>(`/api/contract-archives/${archive.id}`, { method: 'DELETE' }, { requestKey: `contract-delete-${archive.id}` })
          message.success('删除成功')
          await loadArchives()
          props.onSuccess()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '删除合同备案失败')
        } finally {
          setDeletingId(null)
        }
      },
    })
  }

  const handleUploadSuccess = () => {
    setUploadModalVisible(false)
    void loadArchives()
    props.onSuccess()
    message.success('合同备案成功')
  }

  return (
    <>
      <Modal title={`合同备案 - ${props.customerName}`} open={props.visible} onCancel={props.onClose} footer={null} width={1400} destroyOnClose>
        <Space wrap>
          {canUpdateCustomer && <Button type="primary" icon={<PlusOutlined />} onClick={() => setUploadModalVisible(true)}>新增备案</Button>}
          <Button icon={<ReloadOutlined />} onClick={() => void loadArchives()}>刷新</Button>
          <span>显示所有版本： <Select value={showAllVersions} onChange={(value) => { setShowAllVersions(value); setPage(1) }} style={{ width: 120 }} options={[{ label: '仅最新', value: false }, { label: '全部', value: true }]} /></span>
        </Space>
        <Divider style={{ margin: '12px 0' }} />
        <ContractArchiveTable
          archives={archives} loading={loading} page={page} pageSize={pageSize} total={total}
          canDelete={canUpdateCustomer} deletingId={deletingId}
          onPageChange={(nextPage, nextPageSize) => { setPage(nextPageSize !== pageSize ? 1 : nextPage); setPageSize(nextPageSize) }}
          onDownload={(archiveId) => window.open(`/api/contract-archives/${archiveId}/download`, '_blank')}
          onPreview={handlePreview} onHistory={setSelectedArchive} onDelete={handleDelete}
        />
      </Modal>
      <ContractUploadForm visible={uploadModalVisible} customerId={props.customerId} onClose={() => setUploadModalVisible(false)} onSuccess={handleUploadSuccess} />
      {selectedArchive && <VersionHistoryModal visible archiveId={selectedArchive.id} contractName={selectedArchive.contractName} onClose={() => setSelectedArchive(null)} onPreview={handlePreview} onDownload={(archiveId) => window.open(`/api/contract-archives/${archiveId}/download`, '_blank')} />}
      <PDFPreviewModal visible={Boolean(previewUrl)} previewUrl={previewUrl} onClose={() => setPreviewUrl('')} />
    </>
  )
}
