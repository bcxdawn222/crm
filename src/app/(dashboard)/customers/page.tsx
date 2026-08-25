'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, Table, Button, Space, Input, Select, Modal, Form, message, Tag, Upload } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ExportOutlined, SwapOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dynamic from 'next/dynamic'
import { PermissionGuard } from '@/components/common/PermissionGuard'
import { useFormDraft } from '@/hooks/useFormDraft'
import { usePermission } from '@/hooks/usePermission'
import { isCustomerDraft, type CustomerDraft } from '@/lib/forms/crm-drafts'
import { apiRequest } from '@/lib/http/client'
import { Resizable } from 'react-resizable'
import 'react-resizable/css/styles.css'

const FollowUpModal = dynamic(
  () => import('@/components/customers/follow-up-modal').then((module) => module.FollowUpModal),
  { ssr: false },
)
const CustomerTransferModal = dynamic(
  () => import('@/components/customers/customer-transfer-modal').then((module) => module.CustomerTransferModal),
  { ssr: false },
)

// 可拖动的表头组件
const ResizableTitle = (props: any) => {
  const { onResize, width, ...restProps } = props

  if (!width) {
    return <th {...restProps} />
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          style={{
            position: 'absolute',
            right: -5,
            top: 0,
            bottom: 0,
            width: 10,
            cursor: 'col-resize',
            zIndex: 100,
            padding: 0,
            margin: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th 
        {...restProps} 
        style={{ 
          position: 'relative', 
          overflow: 'visible',
          paddingRight: 8,
        }} 
      />
    </Resizable>
  )
}

interface Customer {
  id: string
  name: string
  company?: string
  phone: string
  email?: string
  address?: string
  category: string
  source: string
  status: string
  salesId: string
  createdAt: string
  updatedAt: string
  isPublic: boolean
  sales?: {
    realName: string
  }
  _count?: {
    followUps: number
    orders: number
  }
  followUps?: Array<{
    id?: string
    type?: string
    content?: string
    result?: string | null
    nextAction?: string | null
    nextFollowUpAt?: string | null
    status?: string
    createdAt: string
  }>
}

interface CustomerFormValues {
  name: string
  company?: string
  phone: string
  email?: string
  address?: string
  category?: string
  source?: string
  notes?: string
  status?: string
}

interface CustomerListResponse {
  success: true
  data: {
    list: Customer[]
    total: number
  }
}

interface CustomerMutationResponse {
  success: true
  data?: Customer
}

interface CustomerImportResponse {
  success: true
  data: { count: number }
}

interface CustomerFilters {
  keyword: string
  category?: string
  status?: string
}

export default function CustomersPage() {
  const { roles } = usePermission()
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<string>()
  const [status, setStatus] = useState<string>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [focusedCustomerId, setFocusedCustomerId] = useState<string | null>(null)
  const [followUpCustomer, setFollowUpCustomer] = useState<Customer | null>(null)
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false)
  const [transferCustomer, setTransferCustomer] = useState<Customer | null>(null)
  const [form] = Form.useForm<CustomerFormValues>()
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const formRequestIdRef = useRef('')
  const listRequestSequenceRef = useRef(0)
  const customerDraft = useFormDraft<CustomerFormValues, CustomerDraft>({
    key: `customers:${editingCustomer?.id || 'create'}`,
    enabled: modalVisible,
    form,
    serialize: (values) => ({
      name: values.name,
      company: values.company,
      phone: values.phone,
      email: values.email,
      address: values.address,
      category: values.category,
      source: values.source,
      notes: values.notes,
      status: values.status,
    }),
    deserialize: (values) => values,
    validate: isCustomerDraft,
  })
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    name: 120,
    company: 200,
    phone: 130,
    email: 200,
    category: 100,
    status: 80,
    followUps: 80,
    lastFollowUp: 160,
    sales: 100,
    createdAt: 160,
    action: 260,
  })
  const canTransferCustomers = roles.includes('admin') || roles.includes('sales_manager')

  // 加载客户列表
  const loadCustomers = async (
    targetPage = page,
    filters: CustomerFilters = { keyword, category, status },
  ) => {
    const requestSequence = ++listRequestSequenceRef.current
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        pageSize: pageSize.toString(),
      })
      if (filters.keyword) params.append('keyword', filters.keyword)
      if (filters.category) params.append('category', filters.category)
      if (filters.status) params.append('status', filters.status)

      const data = await apiRequest<CustomerListResponse>(`/api/customers?${params}`)
      if (requestSequence !== listRequestSequenceRef.current) return
      setCustomers(data.data.list)
      setTotal(data.data.total)
    } catch (error) {
      if (requestSequence !== listRequestSequenceRef.current) return
      message.error(error instanceof Error ? error.message : '加载客户失败')
    } finally {
      if (requestSequence === listRequestSequenceRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [page, pageSize])

  useEffect(() => {
    setFocusedCustomerId(new URLSearchParams(window.location.search).get('id'))
  }, [])

  // 搜索
  const handleSearch = () => {
    if (page === 1) {
      void loadCustomers(1)
      return
    }
    setPage(1)
  }

  // 重置搜索
  const handleReset = () => {
    const resetFilters: CustomerFilters = { keyword: '' }
    setKeyword('')
    setCategory(undefined)
    setStatus(undefined)
    if (page === 1) {
      void loadCustomers(1, resetFilters)
      return
    }
    setPage(1)
  }

  // 打开新增/编辑弹窗
  const handleOpenModal = useCallback((customer?: Customer) => {
    formRequestIdRef.current = crypto.randomUUID()
    setEditingCustomer(customer || null)
    if (customer) {
      form.setFieldsValue(customer)
    } else {
      form.resetFields()
    }
    setModalVisible(true)
  }, [form])

  useEffect(() => {
    if (modalVisible && customerDraft.restore()) message.info('已恢复未提交的客户草稿')
  }, [editingCustomer?.id, modalVisible])

  const handleOpenFollowUp = (customer: Customer) => {
    setModalVisible(false)
    setFollowUpCustomer(customer)
    setFollowUpModalVisible(true)
  }

  const handleFollowUpSaved = () => {
    setFollowUpModalVisible(false)
    setFollowUpCustomer(null)
    void loadCustomers()
  }

  useEffect(() => {
    if (!focusedCustomerId) return
    let active = true
    const loadFocusedCustomer = async () => {
      try {
        const result = await apiRequest<{ success: boolean; data: Customer }>(`/api/customers/${encodeURIComponent(focusedCustomerId)}`)
        if (active) handleOpenModal(result.data)
      } catch (error) {
        if (active) message.error(error instanceof Error ? error.message : '加载客户详情失败')
      }
    }
    void loadFocusedCustomer()
    return () => {
      active = false
    }
  }, [focusedCustomerId, handleOpenModal])

  // 提交表单
  const handleSubmit = async (values: CustomerFormValues) => {
    if (submitting) return
    setSubmitting(true)
    try {
      let url = '/api/customers'
      let method = 'POST'

      if (editingCustomer) {
        url = `/api/customers/${editingCustomer.id}`
        method = 'PUT'
      }

      await apiRequest<CustomerMutationResponse>(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': formRequestIdRef.current,
        },
        body: JSON.stringify(values),
      }, {
        requestKey: `customer-form-${editingCustomer?.id || 'new'}-${formRequestIdRef.current}`,
      })
      message.success(editingCustomer ? '更新成功' : '创建成功')
      customerDraft.clear()
      setModalVisible(false)
      await loadCustomers()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '客户保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 归档客户到公海池
  const handleArchive = (id: string, name: string) => {
    Modal.confirm({
      title: '确认归档',
      content: `确定要将客户"${name}"归档到公海池吗?归档后其他销售可以认领。`,
      okText: '确认归档',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiRequest<CustomerMutationResponse>(`/api/customers/${id}/archive`, {
            method: 'POST',
          }, {
            requestKey: `customer-archive-${id}`,
          })
          message.success('归档成功')
          await loadCustomers()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '归档失败')
        }
      },
    })
  }

  // 删除客户
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该客户吗?',
      onOk: async () => {
        try {
          await apiRequest<CustomerMutationResponse>(`/api/customers/${id}`, {
            method: 'DELETE',
          }, {
            requestKey: `customer-delete-${id}`,
          })
          message.success('删除成功')
          await loadCustomers()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '删除失败')
        }
      },
    })
  }

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const data = await apiRequest<CustomerImportResponse>('/api/customers/import', {
        method: 'POST',
        body: formData,
      }, {
        requestKey: `customer-import-${file.name}-${file.size}`,
      })
      message.success(`导入成功！共导入 ${data.data.count} 条记录`)
      setImportModalVisible(false)
      await loadCustomers()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导入失败')
    } finally {
      setUploading(false)
    }

    return false // 阻止默认上传行为
  }

  // 处理列宽度调整
  const handleResize = (key: string) => (_: any, { size }: { size: { width: number } }) => {
    setColumnWidths((prev) => ({
      ...prev,
      [key]: size.width,
    }))
  }

  // 表格列定义
  const columns: ColumnsType<Customer> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: columnWidths.name,
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      width: columnWidths.company,
      ellipsis: true,
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: columnWidths.phone,
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: columnWidths.email,
      ellipsis: true,
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: columnWidths.category,
      render: (text) => <Tag color="blue">{text}</Tag>,
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: columnWidths.status,
      render: (text) => (
        <Tag color={text === 'ACTIVE' ? 'green' : 'red'}>
          {text === 'ACTIVE' ? '活跃' : ' inactive'}
        </Tag>
      ),
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '跟进数',
      dataIndex: '_count',
      key: 'followUps',
      width: columnWidths.followUps,
      render: (_, record) => record._count?.followUps || 0,
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '最近一次跟进时间',
      dataIndex: 'followUps',
      key: 'lastFollowUp',
      width: columnWidths.lastFollowUp,
      render: (followUps) => {
        if (!followUps || followUps.length === 0) return '-'
        return new Date(followUps[0].createdAt).toLocaleString('zh-CN')
      },
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '销售',
      dataIndex: 'sales',
      key: 'sales',
      width: columnWidths.sales,
      render: (_, record) => record.sales?.realName || '-',
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: columnWidths.createdAt,
      render: (text) => new Date(text).toLocaleString('zh-CN'),
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '操作',
      key: 'action',
      width: columnWidths.action,
      fixed: 'right',
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            查看
          </Button>
          <PermissionGuard action="update" subject="customer">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenModal(record)}
            >
              编辑
            </Button>
          </PermissionGuard>
          <PermissionGuard action="delete" subject="customer">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            >
              删除
            </Button>
          </PermissionGuard>
          {!record.isPublic && (
            <PermissionGuard action="update" subject="customer">
              <Button
                type="link"
                size="small"
                icon={<ExportOutlined />}
                onClick={() => handleArchive(record.id, record.name)}
              >
                归档
              </Button>
            </PermissionGuard>
          )}
          {!record.isPublic && canTransferCustomers && (
            <Button
              type="link"
              size="small"
              icon={<SwapOutlined />}
              onClick={() => setTransferCustomer(record)}
            >
              转移
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 自定义样式 */}
      <style jsx global>{`
        .react-resizable-handle {
          position: absolute !important;
          right: -5px !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 10px !important;
          cursor: col-resize !important;
          z-index: 100 !important;
          background-color: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .react-resizable-handle:hover {
          background-color: rgba(24, 144, 255, 0.5) !important;
          border-left: 2px solid #1890ff !important;
        }
        .react-resizable-handle::before {
          content: '' !important;
          position: absolute !important;
          left: 50% !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 1px !important;
          background-color: #e8e8e8 !important;
        }
        th.ant-table-cell {
          position: relative !important;
          overflow: visible !important;
        }
      `}</style>
      
      <Card
        title="客户管理"
        extra={
          <Space>
            <PermissionGuard action="create" subject="customer">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleOpenModal()}
              >
                新增客户
              </Button>
            </PermissionGuard>
            <PermissionGuard action="create" subject="customer">
              <Button
                icon={<UploadOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                客资录入
              </Button>
            </PermissionGuard>
          </Space>
        }
      >
        {/* 搜索栏 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索姓名、公司、电话"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="选择分类"
            value={category}
            onChange={setCategory}
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '潜在客户', value: '潜在客户' },
              { label: '普通客户', value: '普通客户' },
              { label: '重要客户', value: '重要客户' },
              { label: 'VIP客户', value: 'VIP客户' },
            ]}
          />
          <Select
            placeholder="选择状态"
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '活跃', value: 'ACTIVE' },
              { label: ' inactive', value: 'INACTIVE' },
            ]}
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={customers}
          rowKey="id"
          loading={loading}
          components={{
            header: {
              cell: ResizableTitle,
            },
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingCustomer ? '编辑客户' : '新增客户'}
        open={modalVisible}
        onCancel={() => {
          if (!submitting) {
            customerDraft.clear()
            setModalVisible(false)
          }
        }}
        footer={null}
        width={600}
        closable={!submitting}
        maskClosable={!submitting}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={customerDraft.save}
          initialValues={{
            category: '潜在客户',
            source: 'OTHER',
            status: 'ACTIVE',
          }}
        >
          <Form.Item
            name="name"
            label="客户姓名"
            rules={[{ required: true, message: '请输入客户姓名' }]}
          >
            <Input placeholder="请输入客户姓名" />
          </Form.Item>

          <Form.Item name="company" label="公司名称">
            <Input placeholder="请输入公司名称" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="联系电话"
            rules={[{ required: true, message: '请输入联系电话' }]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>

          <Form.Item name="email" label="邮箱地址">
            <Input placeholder="请输入邮箱地址" />
          </Form.Item>

          <Form.Item name="address" label="联系地址">
            <Input.TextArea rows={3} placeholder="请输入联系地址" />
          </Form.Item>

          <Form.Item name="category" label="客户分类">
            <Select
              options={[
                { label: '潜在客户', value: '潜在客户' },
                { label: '普通客户', value: '普通客户' },
                { label: '重要客户', value: '重要客户' },
                { label: 'VIP客户', value: 'VIP客户' },
              ]}
            />
          </Form.Item>

          <Form.Item name="source" label="客户来源">
            <Input placeholder="请输入客户来源，如：网站咨询、推荐介绍等" />
          </Form.Item>

          <Form.Item name="notes" label="备注信息">
            <Input.TextArea rows={4} placeholder="请输入备注信息" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              {editingCustomer ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
        {editingCustomer && (
          <div style={{ marginTop: 20, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong>跟进记录</strong>
              <PermissionGuard action="create" subject="followUp">
                <Button size="small" type="primary" onClick={() => handleOpenFollowUp(editingCustomer)}>
                  新增跟进
                </Button>
              </PermissionGuard>
            </div>
            {editingCustomer.followUps && editingCustomer.followUps.length > 0 ? (
              editingCustomer.followUps.map((followUp) => (
                <div key={followUp.id || followUp.createdAt} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ color: '#666', fontSize: 12 }}>
                    {new Date(followUp.createdAt).toLocaleString('zh-CN')} · {followUp.type || '跟进'}
                  </div>
                  <div>{followUp.content || '已记录跟进'}</div>
                  {followUp.nextAction && <div style={{ color: '#666', fontSize: 12 }}>下一步：{followUp.nextAction}</div>}
                </div>
              ))
            ) : (
              <div style={{ color: '#999' }}>暂无跟进记录</div>
            )}
          </div>
        )}
      </Modal>

      <FollowUpModal
        open={followUpModalVisible}
        customerId={followUpCustomer?.id}
        customerName={followUpCustomer?.name}
        onClose={() => setFollowUpModalVisible(false)}
        onSaved={handleFollowUpSaved}
      />

      <CustomerTransferModal
        customer={transferCustomer}
        onClose={() => setTransferCustomer(null)}
        onSaved={() => {
          setTransferCustomer(null)
          return loadCustomers()
        }}
      />

      {/* 客资录入弹窗 */}
      <Modal
        title="客资录入"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ padding: '20px 0' }}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            请上传Excel或CSV文件进行批量导入。文件格式要求：
          </p>
          <ul style={{ marginBottom: 24, paddingLeft: 20, color: '#999', lineHeight: 1.8 }}>
            <li>支持 .xlsx, .xls, .csv 格式</li>
            <li>第一行为表头，包含：姓名、公司、电话、邮箱等字段</li>
            <li>姓名和电话为必填项</li>
            <li>单次最多导入1000条记录</li>
          </ul>
          
          <Upload.Dragger
            name="file"
            accept=".xlsx,.xls,.csv"
            beforeUpload={handleFileUpload}
            showUploadList={false}
            maxCount={1}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持单个文件上传，文件大小不超过10MB
            </p>
          </Upload.Dragger>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button onClick={() => setImportModalVisible(false)}>
              取消
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

