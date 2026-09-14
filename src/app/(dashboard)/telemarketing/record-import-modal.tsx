'use client'

import { UploadOutlined } from '@ant-design/icons'
import { Button, Modal, Select, Space, Upload } from 'antd'

import type { TelemarketingOwner } from './types'

interface RecordImportModalProps {
  open: boolean
  uploading: boolean
  canAssignOwner: boolean
  owners: TelemarketingOwner[]
  salesId?: string
  onSalesIdChange: (value?: string) => void
  onCancel: () => void
  onUpload: (file: File) => Promise<boolean>
}

export function RecordImportModal(props: RecordImportModalProps) {
  return (
    <Modal
      title="批量导入电销名单"
      open={props.open}
      onCancel={props.onCancel}
      footer={null}
      width={640}
      closable={!props.uploading}
      maskClosable={!props.uploading}
    >
      <div style={{ padding: '8px 0' }}>
        <p style={{ marginBottom: 16, color: '#666' }}>请上传 Excel 或 CSV。整批校验通过后才会写入。</p>
        <ul style={{ marginBottom: 16, paddingLeft: 20, color: '#999', lineHeight: 1.8 }}>
          <li>支持 .xlsx、.xls、.csv，单次最多 1000 条，文件不超过 5 MB</li>
          <li>表头：姓名、公司、电话、职位、行业、来源、备注、销售</li>
          <li>姓名和电话必填；电话支持手机号和国内座机，如 010-84467791</li>
          <li>销售列填用户名或姓名；管理员/主管也可在下方指定默认负责人</li>
        </ul>
        {props.canAssignOwner ? (
          <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="默认负责人（销售列为空时使用）"
              value={props.salesId}
              onChange={(value) => props.onSalesIdChange(value)}
              options={props.owners.map((owner) => ({
                value: owner.id,
                label: `${owner.realName}（${owner.username}）`,
              }))}
              style={{ width: '100%' }}
              disabled={props.uploading}
            />
          </Space>
        ) : null}
        <Upload.Dragger
          name="file"
          accept=".xlsx,.xls,.csv"
          beforeUpload={props.onUpload}
          showUploadList={false}
          maxCount={1}
          disabled={props.uploading}
        >
          <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} /></p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持单个文件，大小不超过 5MB</p>
        </Upload.Dragger>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button loading={props.uploading} disabled={props.uploading} onClick={props.onCancel}>取消</Button>
        </div>
      </div>
    </Modal>
  )
}
