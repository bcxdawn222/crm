'use client'

import { useState } from 'react'
import { Modal, Form, Input, DatePicker, InputNumber, Select, Upload, message, Button, Space } from 'antd'
import { InboxOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { TextArea } = Input

interface ContractUploadFormProps {
  visible: boolean
  customerId: string
  onClose: () => void
  onSuccess: () => void
}

export default function ContractUploadForm({
  visible,
  customerId,
  onClose,
  onSuccess
}: ContractUploadFormProps) {
  const [form] = Form.useForm()
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<any[]>([])

  // Handle submit
  const handleSubmit = async (values: any) => {
    if (fileList.length === 0) {
      message.error('请上传合同文件')
      return
    }

    setUploading(true)
    try {
      const file = fileList[0].originFileObj
      const formData = new FormData()
      
      formData.append('file', file)
      formData.append('contractName', values.contractName)
      formData.append('contractType', values.contractType || '')
      formData.append('signDate', values.signDate ? values.signDate.format('YYYY-MM-DD') : '')
      formData.append('effectiveDate', values.effectiveDate ? values.effectiveDate.format('YYYY-MM-DD') : '')
      formData.append('expiryDate', values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : '')
      formData.append('contractAmount', values.contractAmount?.toString() || '')
      formData.append('remarks', values.remarks || '')

      const res = await fetch(`/api/customers/${customerId}/contract-archives`, {
        method: 'POST',
        body: formData
      })

      const json = await res.json()

      if (json.success) {
        onSuccess()
        form.resetFields()
        setFileList([])
      } else {
        message.error(json.error || '上传失败')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      message.error('网络错误')
    } finally {
      setUploading(false)
    }
  }

  // Handle file change
  const handleFileChange = ({ fileList: newFileList }: any) => {
    setFileList(newFileList)
  }

  // Before upload validation
  const beforeUpload = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ]

    if (!allowedTypes.includes(file.type)) {
      message.error('不支持的文件类型，仅支持 PDF、Word、JPG、PNG 格式')
      return Upload.LIST_IGNORE
    }

    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      message.error('文件大小不能超过 50MB')
      return Upload.LIST_IGNORE
    }

    return false // Prevent auto upload
  }

  return (
    <Modal
      title="新增合同备案"
      open={visible}
      onCancel={() => {
        onClose()
        form.resetFields()
        setFileList([])
      }}
      footer={null}
      width={700}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="contractName"
          label="合同名称"
          rules={[{ required: true, message: '请输入合同名称' }]}
        >
          <Input placeholder="请输入合同名称" />
        </Form.Item>

        <Form.Item
          name="contractType"
          label="合同类型"
        >
          <Select placeholder="请选择合同类型">
            <Select.Option value="SALES">销售合同</Select.Option>
            <Select.Option value="SERVICE">服务协议</Select.Option>
            <Select.Option value="COOPERATION">合作协议</Select.Option>
            <Select.Option value="OTHER">其他</Select.Option>
          </Select>
        </Form.Item>

        <Space direction="vertical" style={{ width: '100%' }}>
          <Form.Item
            name="signDate"
            label="签订日期"
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择签订日期" />
          </Form.Item>

          <Form.Item
            name="effectiveDate"
            label="生效日期"
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择生效日期" />
          </Form.Item>

          <Form.Item
            name="expiryDate"
            label="到期日期"
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择到期日期" />
          </Form.Item>
        </Space>

        <Form.Item
          name="contractAmount"
          label="合同金额"
        >
          <InputNumber<number>
            style={{ width: '100%' }}
            min={0}
            precision={2}
            formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => Number(value?.replace(/¥\s?|(,*)/g, '') || 0)}
            placeholder="输入合同金额"
          />
        </Form.Item>

        <Form.Item
          label="上传合同文件"
          required
        >
          <Upload.Dragger
            listType="text"
            fileList={fileList}
            onChange={handleFileChange}
            beforeUpload={beforeUpload}
            maxCount={1}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 PDF、Word、JPG、PNG 格式，单个文件不超过 50MB
            </p>
          </Upload.Dragger>
        </Form.Item>

        <Form.Item
          name="remarks"
          label="备注说明"
        >
          <TextArea rows={3} placeholder="可选填，记录合同相关信息" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => {
              onClose()
              form.resetFields()
              setFileList([])
            }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={uploading}>
              <UploadOutlined /> 提交备案
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
