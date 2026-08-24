'use client'

import { useState, useEffect } from 'react'
import { Modal, Timeline, Card, Tag, Button, Space, message } from 'antd'
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { apiRequest } from '@/lib/http/client'

interface ArchiveVersion {
  id: string
  version: number
  isLatest: boolean
  fileName: string
  fileSize: number
  fileType: string
  archivedAt: string
  archivedUser?: {
    id: string
    realName: string
  }
}

interface VersionHistoryModalProps {
  visible: boolean
  archiveId: string
  contractName: string
  onClose: () => void
  onPreview: (archive: any) => void
  onDownload: (archiveId: string) => void
}

export default function VersionHistoryModal({
  visible,
  archiveId,
  contractName,
  onClose,
  onPreview,
  onDownload
}: VersionHistoryModalProps) {
  const [loading, setLoading] = useState(false)
  const [versions, setVersions] = useState<ArchiveVersion[]>([])

  // Load versions
  const loadVersions = async () => {
    if (!visible || !archiveId) return
    
    setLoading(true)
    try {
      const result = await apiRequest<{ success: true; data: ArchiveVersion[] }>(
        `/api/contract-archives/${archiveId}/versions`
      )
      setVersions(result.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载合同版本失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVersions()
  }, [visible, archiveId])

  return (
    <Modal
      title={`版本历史 - ${contractName}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Timeline
        items={versions.map((version) => ({
          children: (
            <Card size="small">
              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 16 }}>版本 {version.version}</strong>
                <Tag color={version.isLatest ? 'green' : 'default'} style={{ marginLeft: 8 }}>
                  {version.isLatest ? '当前版本' : '历史版本'}
                </Tag>
              </div>
              
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#666' }}>文件名：</span>
                {version.fileName}
              </div>
              
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#666' }}>大小：</span>
                {(version.fileSize / 1024 / 1024).toFixed(2)} MB
              </div>
              
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#666' }}>类型：</span>
                {version.fileType.toUpperCase()}
              </div>
              
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#666' }}>备案人：</span>
                {version.archivedUser?.realName || '-'}
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <span style={{ color: '#666' }}>时间：</span>
                {dayjs(version.archivedAt).format('YYYY-MM-DD HH:mm:ss')}
              </div>
              
              <Space>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => onDownload(version.id)}
                >
                  下载
                </Button>
                {version.fileType === 'pdf' && (
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => onPreview(version)}
                  >
                    预览
                  </Button>
                )}
              </Space>
            </Card>
          )
        }))}
      />
    </Modal>
  )
}
