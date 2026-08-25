'use client'

import { UploadOutlined } from '@ant-design/icons'
import { Button, Modal, Upload } from 'antd'

interface CustomerImportModalProps {
  open: boolean
  uploading: boolean
  onCancel: () => void
  onUpload: (file: File) => Promise<boolean>
}

export function CustomerImportModal(props: CustomerImportModalProps) {
  return (
    <Modal title="客资录入" open={props.open} onCancel={props.onCancel} footer={null} width={600} closable={!props.uploading} maskClosable={!props.uploading}>
      <div style={{ padding: '20px 0' }}>
        <p style={{ marginBottom: 16, color: '#666' }}>请上传Excel或CSV文件进行批量导入。文件格式要求：</p>
        <ul style={{ marginBottom: 24, paddingLeft: 20, color: '#999', lineHeight: 1.8 }}>
          <li>支持 .xlsx, .xls, .csv 格式</li>
          <li>第一行为表头，包含：姓名、公司、电话、邮箱等字段</li>
          <li>姓名和电话为必填项</li>
          <li>单次最多导入1000条记录</li>
        </ul>
        <Upload.Dragger name="file" accept=".xlsx,.xls,.csv" beforeUpload={props.onUpload} showUploadList={false} maxCount={1} disabled={props.uploading}>
          <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} /></p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持单个文件上传，文件大小不超过10MB</p>
        </Upload.Dragger>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button loading={props.uploading} disabled={props.uploading} onClick={props.onCancel}>取消</Button>
        </div>
      </div>
    </Modal>
  )
}
