'use client'

import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Card, Form, Modal, Space, message } from 'antd'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'

import { PermissionGuard } from '@/components/common/PermissionGuard'
import { useFormDraft } from '@/hooks/useFormDraft'
import { usePermission } from '@/hooks/usePermission'
import { useTablePagination } from '@/hooks/useTablePagination'
import { isCustomerDraft, type CustomerDraft } from '@/lib/forms/crm-drafts'
import { apiRequest } from '@/lib/http/client'

import { CustomerFormModal } from './customer-form-modal'
import { CustomerImportModal } from './customer-import-modal'
import { CustomerTable } from './customer-table'
import type {
  Customer,
  CustomerFilters,
  CustomerFormValues,
  CustomerImportResponse,
  CustomerListResponse,
  CustomerMutationResponse,
} from './types'

const FollowUpModal = dynamic(
  () => import('@/components/customers/follow-up-modal').then((module) => module.FollowUpModal),
  { ssr: false },
)
const CustomerTransferModal = dynamic(
  () => import('@/components/customers/customer-transfer-modal').then((module) => module.CustomerTransferModal),
  { ssr: false },
)

export default function CustomersPage() {
  const { can, roles } = usePermission()
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const { page, pageSize, setPage, changePage } = useTablePagination()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<string>()
  const [status, setStatus] = useState<string>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [customerReadOnly, setCustomerReadOnly] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [followUpCustomer, setFollowUpCustomer] = useState<Customer | null>(null)
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false)
  const [transferCustomer, setTransferCustomer] = useState<Customer | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<CustomerFormValues>()
  const formRequestIdRef = useRef('')
  const listRequestSequenceRef = useRef(0)
  const focusedCustomerIdRef = useRef<string | null>(null)
  const customerDraft = useFormDraft<CustomerFormValues, CustomerDraft>({
    key: `customers:${editingCustomer?.id || 'create'}`,
    enabled: modalVisible && !customerReadOnly,
    form,
    serialize: (values) => ({
      name: values.name, company: values.company, phone: values.phone, email: values.email,
      address: values.address, category: values.category, source: values.source,
      notes: values.notes, status: values.status,
    }),
    deserialize: (values) => values,
    validate: isCustomerDraft,
  })
  const canTransferCustomers = roles.includes('admin') || roles.includes('sales_manager')
  const canUpdateCustomer = can('update', 'customer')

  const loadCustomers = async (targetPage = page, filters: CustomerFilters = { keyword, category, status }) => {
    const requestSequence = ++listRequestSequenceRef.current
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: targetPage.toString(), pageSize: pageSize.toString() })
      if (filters.keyword) params.append('keyword', filters.keyword)
      if (filters.category) params.append('category', filters.category)
      if (filters.status) params.append('status', filters.status)
      const result = await apiRequest<CustomerListResponse>(`/api/customers?${params}`)
      if (requestSequence !== listRequestSequenceRef.current) return
      setCustomers(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      if (requestSequence === listRequestSequenceRef.current) message.error(error instanceof Error ? error.message : '加载客户失败')
    } finally {
      if (requestSequence === listRequestSequenceRef.current) setLoading(false)
    }
  }

  const openCustomer = useCallback((customer?: Customer, readOnly = false) => {
    formRequestIdRef.current = crypto.randomUUID()
    setEditingCustomer(customer || null)
    setCustomerReadOnly(readOnly)
    if (customer) form.setFieldsValue(customer)
    else form.resetFields()
    setModalVisible(true)
  }, [form])

  useEffect(() => { void loadCustomers() }, [page, pageSize])

  useEffect(() => {
    focusedCustomerIdRef.current = new URLSearchParams(window.location.search).get('id')
    if (!focusedCustomerIdRef.current) return
    let active = true
    void apiRequest<{ success: boolean; data: Customer }>(`/api/customers/${encodeURIComponent(focusedCustomerIdRef.current)}`)
      .then((result) => { if (active) openCustomer(result.data, !canUpdateCustomer) })
      .catch((error) => { if (active) message.error(error instanceof Error ? error.message : '加载客户详情失败') })
    return () => { active = false }
  }, [canUpdateCustomer, openCustomer])

  useEffect(() => {
    if (modalVisible && !customerReadOnly && customerDraft.restore()) message.info('已恢复未提交的客户草稿')
  }, [customerReadOnly, editingCustomer?.id, modalVisible])

  const handleSearch = () => {
    if (page === 1) void loadCustomers(1)
    else setPage(1)
  }

  const handleReset = () => {
    setKeyword('')
    setCategory(undefined)
    setStatus(undefined)
    if (page === 1) void loadCustomers(1, { keyword: '' })
    else setPage(1)
  }

  const handleSubmit = async (values: CustomerFormValues) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers'
      await apiRequest<CustomerMutationResponse>(url, {
        method: editingCustomer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-request-id': formRequestIdRef.current },
        body: JSON.stringify(values),
      }, { requestKey: `customer-form-${editingCustomer?.id || 'new'}-${formRequestIdRef.current}` })
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

  const archiveCustomer = (customer: Customer) => {
    Modal.confirm({
      title: '确认归档',
      content: `确定要将客户“${customer.name}”归档到公海池吗？归档后其他销售可以认领。`,
      okText: '确认归档', cancelText: '取消',
      onOk: async () => {
        try {
          await apiRequest<CustomerMutationResponse>(`/api/customers/${customer.id}/archive`, { method: 'POST' }, { requestKey: `customer-archive-${customer.id}` })
          message.success('归档成功')
          await loadCustomers()
        } catch (error) { message.error(error instanceof Error ? error.message : '归档失败') }
      },
    })
  }

  const deleteCustomer = (customer: Customer) => {
    Modal.confirm({
      title: '确认删除', content: `确定要删除客户“${customer.name}”吗？`,
      onOk: async () => {
        try {
          await apiRequest<CustomerMutationResponse>(`/api/customers/${customer.id}`, { method: 'DELETE' }, { requestKey: `customer-delete-${customer.id}` })
          message.success('删除成功')
          await loadCustomers()
        } catch (error) { message.error(error instanceof Error ? error.message : '删除失败') }
      },
    })
  }

  const importCustomers = async (file: File) => {
    if (uploading) return false
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await apiRequest<CustomerImportResponse>('/api/customers/import', { method: 'POST', body: formData }, { requestKey: `customer-import-${file.name}-${file.size}` })
      message.success(`导入成功！共导入 ${result.data.count} 条记录`)
      setImportModalVisible(false)
      await loadCustomers()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导入失败')
    } finally {
      setUploading(false)
    }
    return false
  }

  return (
    <div>
      <Card title="客户管理" extra={<Space><PermissionGuard action="create" subject="customer"><Button type="primary" icon={<PlusOutlined />} onClick={() => openCustomer()}>新增客户</Button></PermissionGuard><PermissionGuard action="create" subject="customer"><Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>客资录入</Button></PermissionGuard></Space>}>
        <CustomerTable
          customers={customers} loading={loading} total={total} page={page} pageSize={pageSize}
          keyword={keyword} category={category} status={status} canTransferCustomers={canTransferCustomers}
          onKeywordChange={setKeyword} onCategoryChange={setCategory} onStatusChange={setStatus}
          onSearch={handleSearch} onReset={handleReset}
          onPageChange={changePage}
          onView={(customer) => openCustomer(customer, true)} onEdit={(customer) => openCustomer(customer)}
          onDelete={deleteCustomer} onArchive={archiveCustomer} onTransfer={setTransferCustomer}
        />
      </Card>
      <CustomerFormModal open={modalVisible} customer={editingCustomer} readOnly={customerReadOnly} submitting={submitting} form={form} onCancel={() => { if (!submitting) { if (!customerReadOnly) customerDraft.clear(); setModalVisible(false) } }} onSubmit={handleSubmit} onValuesChange={customerDraft.save} onFollowUp={(customer) => { setModalVisible(false); setFollowUpCustomer(customer); setFollowUpModalVisible(true) }} />
      <FollowUpModal open={followUpModalVisible} customerId={followUpCustomer?.id} customerName={followUpCustomer?.name} onClose={() => setFollowUpModalVisible(false)} onSaved={() => { setFollowUpModalVisible(false); setFollowUpCustomer(null); void loadCustomers() }} />
      <CustomerTransferModal customer={transferCustomer} onClose={() => setTransferCustomer(null)} onSaved={() => { setTransferCustomer(null); return loadCustomers() }} />
      <CustomerImportModal open={importModalVisible} uploading={uploading} onCancel={() => { if (!uploading) setImportModalVisible(false) }} onUpload={importCustomers} />
    </div>
  )
}
