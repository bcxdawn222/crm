'use client'

import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Card, Col, Form, message, Row, Select, Statistic } from 'antd'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

import { useFormDraft } from '@/hooks/useFormDraft'
import { usePermission } from '@/hooks/usePermission'
import { isTelemarketingDraft, type TelemarketingDraft } from '@/lib/forms/crm-drafts'
import { apiRequest } from '@/lib/http/client'
import { useTablePagination } from '@/hooks/useTablePagination'

import { RecordFormModal } from './record-form-modal'
import { RecordImportModal } from './record-import-modal'
import { RecordsTable } from './records-table'
import type {
  TelemarketingFormValues,
  TelemarketingListResponse,
  TelemarketingMutationResponse,
  TelemarketingOwner,
  TelemarketingRecord,
} from './types'

const TelemarketingConvertModal = dynamic(
  () => import('./telemarketing-convert-modal').then((module) => module.TelemarketingConvertModal),
  { ssr: false },
)

export default function TelemarketingPage() {
  const { permissions, roles } = usePermission()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TelemarketingRecord[]>([])
  const [total, setTotal] = useState(0)
  const { page, pageSize, setPage, changePage } = useTablePagination()
  const [modalVisible, setModalVisible] = useState(false)
  const [importVisible, setImportVisible] = useState(false)
  const [importSalesId, setImportSalesId] = useState<string>()
  const [uploading, setUploading] = useState(false)
  const [editingRecord, setEditingRecord] = useState<TelemarketingRecord | null>(null)
  const [convertRecord, setConvertRecord] = useState<TelemarketingRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [owners, setOwners] = useState<TelemarketingOwner[]>([])
  const [filterSalesId, setFilterSalesId] = useState<string>()
  const [form] = Form.useForm<TelemarketingFormValues>()
  const requestIdRef = useRef('')
  const canAssignOwner = roles.includes('admin') || roles.includes('sales_manager') || roles.includes('finance')
  const draft = useFormDraft<TelemarketingFormValues, TelemarketingDraft>({
    key: `telemarketing:${editingRecord?.id || 'create'}`,
    enabled: modalVisible,
    form,
    serialize: (values) => ({
      name: values.name, company: values.company, phone: values.phone,
      position: values.position, industry: values.industry, source: values.source, notes: values.notes,
      status: values.status, result: values.result ?? undefined, salesId: values.salesId,
      isEffective: values.isEffective,
    }),
    deserialize: (values) => values,
    validate: isTelemarketingDraft,
  })

  const loadOwners = async () => {
    if (!canAssignOwner) return
    try {
      const response = await apiRequest<{ success: true; data: TelemarketingOwner[] }>('/api/telemarketing/owners')
      setOwners(response.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载销售列表失败')
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (filterSalesId) params.set('salesId', filterSalesId)
      const response = await apiRequest<TelemarketingListResponse>(`/api/telemarketing?${params}`)
      setData(response.data.list)
      setTotal(response.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载电销记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadOwners() }, [canAssignOwner])
  useEffect(() => { void loadData() }, [page, pageSize, filterSalesId])
  useEffect(() => {
    if (modalVisible && draft.restore()) message.info('已恢复未提交的电销草稿')
  }, [editingRecord?.id, modalVisible])

  const closeForm = () => {
    if (submitting) return
    draft.clear()
    setModalVisible(false)
    form.resetFields()
    setEditingRecord(null)
  }

  const openForm = (record: TelemarketingRecord | null) => {
    requestIdRef.current = crypto.randomUUID()
    setEditingRecord(record)
    if (record) {
      form.setFieldsValue({
        name: record.name,
        company: record.company,
        phone: record.phone,
        position: record.position,
        industry: record.industry,
        source: record.source,
        notes: record.notes,
        status: record.status,
        result: record.result ?? undefined,
        isEffective: record.isEffective,
        salesId: record.salesId,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'PENDING', isEffective: false })
    }
    setModalVisible(true)
  }

  const submit = async (values: TelemarketingFormValues) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const url = editingRecord ? `/api/telemarketing?id=${editingRecord.id}` : '/api/telemarketing'
      await apiRequest<TelemarketingMutationResponse>(url, {
        method: editingRecord ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestIdRef.current },
        body: JSON.stringify({
          ...values,
          result: values.result ?? null,
        }),
      }, { requestKey: `telemarketing-form-${editingRecord?.id || 'new'}-${requestIdRef.current}` })
      message.success(editingRecord ? '更新成功' : '创建成功')
      draft.clear()
      setModalVisible(false)
      form.resetFields()
      setEditingRecord(null)
      await loadData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存电销记录失败')
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      await apiRequest<TelemarketingMutationResponse>(`/api/telemarketing?id=${id}`, { method: 'DELETE' }, { requestKey: `telemarketing-delete-${id}` })
      message.success('删除成功')
      if (data.length === 1 && page > 1) setPage((current) => current - 1)
      else await loadData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除电销记录失败')
    } finally {
      setDeletingId(null)
    }
  }

  const importRecords = async (file: File) => {
    if (uploading) return false
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (importSalesId) formData.append('salesId', importSalesId)
      const result = await apiRequest<{ success: true; data: { count: number } }>(
        '/api/telemarketing/import',
        { method: 'POST', body: formData },
        { requestKey: `telemarketing-import-${file.name}-${file.size}` },
      )
      message.success(`导入成功！共导入 ${result.data.count} 条记录`)
      setImportVisible(false)
      setImportSalesId(undefined)
      await loadData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导入失败')
    } finally {
      setUploading(false)
    }
    return false
  }

  const canCreate = permissions.includes('lead:create')
  const canUpdate = permissions.includes('lead:update')
  const canConvert = permissions.includes('lead:convert') && permissions.includes('customer:create')

  return (
    <Card
      title="电销名单管理"
      extra={canCreate ? (
        <Row gutter={8}>
          <Col><Button icon={<UploadOutlined />} onClick={() => setImportVisible(true)}>批量导入</Button></Col>
          <Col><Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>新增电销记录</Button></Col>
        </Row>
      ) : null}
    >
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="总记录数" value={total} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="待拨打" value={data.filter((item) => item.status === 'PENDING').length} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="有效客户" value={data.filter((item) => item.isEffective).length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已转化" value={data.filter((item) => item.status === 'CONVERTED').length} valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>

      {canAssignOwner ? (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="按销售筛选"
          value={filterSalesId}
          onChange={(value) => { setFilterSalesId(value); setPage(1) }}
          options={owners.map((owner) => ({
            value: owner.id,
            label: `${owner.realName}（${owner.username}）`,
          }))}
          style={{ width: 280, marginBottom: 16 }}
        />
      ) : null}

      <RecordsTable
        data={data}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={total}
        canUpdate={canUpdate}
        canConvert={canConvert}
        deletingId={deletingId}
        onPageChange={changePage}
        onEdit={openForm}
        onConvert={setConvertRecord}
        onDelete={(id) => { void remove(id) }}
      />

      <RecordFormModal
        open={modalVisible}
        record={editingRecord}
        form={form}
        submitting={submitting}
        canAssignOwner={canAssignOwner}
        owners={owners}
        onCancel={closeForm}
        onSubmit={(values) => { void submit(values) }}
        onValuesChange={draft.save}
      />
      <RecordImportModal
        open={importVisible}
        uploading={uploading}
        canAssignOwner={canAssignOwner}
        owners={owners}
        salesId={importSalesId}
        onSalesIdChange={setImportSalesId}
        onCancel={() => { if (!uploading) { setImportVisible(false); setImportSalesId(undefined) } }}
        onUpload={importRecords}
      />
      <TelemarketingConvertModal record={convertRecord} onClose={() => setConvertRecord(null)} onSaved={loadData} />
    </Card>
  )
}
