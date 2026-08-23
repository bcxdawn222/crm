'use client'

import { Modal, Button } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'

interface PDFPreviewModalProps {
  visible: boolean
  previewUrl: string
  onClose: () => void
}

export default function PDFPreviewModal({
  visible,
  previewUrl,
  onClose
}: PDFPreviewModalProps) {
  return (
    <Modal
      title="合同预览"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button
          key="download"
          icon={<DownloadOutlined />}
          onClick={() => window.open(previewUrl, '_blank')}
        >
          下载原文件
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
      width={1200}
      destroyOnClose
    >
      <div style={{ height: '70vh', overflow: 'auto' }}>
        {previewUrl && (
          <iframe
            src={previewUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            title="PDF Preview"
          />
        )}
      </div>
    </Modal>
  )
}
