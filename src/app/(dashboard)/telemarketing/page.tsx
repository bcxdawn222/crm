'use client'

import { PlusOutlined } from '@ant-design/icons'
import { Button, Card, Col, Form, message, Row, Statistic } from 'antd'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

import { useFormDraft } from '@/hooks/useFormDraft'
import { usePermission } from '@/hooks/usePermission'
import { isTelemarketingDraft, type TelemarketingDraft } from '@/lib/forms/crm-drafts'
import { apiRequest } from '@/lib/http/client'
import { useTablePagination } from '@/hooks/useTablePagination'

import { RecordFormModal } from './record-form-modal'
import { RecordsTable } from './records-table'
import type {
  TelemarketingFormValues,
  TelemarketingListResponse,
  TelemarketingMutationResponse,
  TelemarketingRecord,
} from './types'

const TelemarketingConvertModal = dynamic(
  () => import('./telemarketing-convert-modal').then((module) => module.TelemarketingConvertModal),
  { ssr: false },
)

export default function TelemarketingPage() {
  const { permissions } = usePermission()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TelemarketingRecord[]>([])
  const [total, setTotal] = useState(0)
  const { page, pageSize, changePage } = useTablePagination()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<TelemarketingRecord | null>(null)
  const [convertRecord, setConvertRecord] = useState<TelemarketingRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form] = Form.useForm<TelemarketingFormValues>()
  const requestIdRef = useRef('')
  const draft = useFormDraft<TelemarketingFormValues, TelemarketingDraft>({
    key: `telemarketing:${editingRecord?.id || 'create'}`,
    enabled: modalVisible,
    form,
    serialize: (values) => ({
      name: values.name, company: values.company, phone: values.phone,
      position: values.position, industry: values.industry, source: values.source, notes: values.notes,
    }),
    deserialize: (values) => values,
    validate: isTelemarketingDraft,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await apiRequest<TelemarketingListResponse>(`/api/telemarketing?page=${page}&pageSize=${pageSize}`)
      setData(response.data.list)
      setTotal(response.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载电销记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [page, pageSize])
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
    record ? form.setFieldsValue(record) : form.resetFields()
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
        body: JSON.stringify(values),
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
      await loadData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除电销记录失败')
    } finally {
      setDeletingId(null)
    }
  }

  const canCreate = permissions.includes('lead:create')
  const canUpdate = permissions.includes('lead:update')
  const canConvert = permissions.includes('lead:convert') && permissions.includes('customer:create')

  return (
    <Card
      title="电销名单管理"
      extra={canCreate ? <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>新增电销记录</Button> : null}
    >
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="总记录数" value={total} valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="待拨打" value={data.filter((item) => item.status === 'PENDING').length} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="有效客户" value={data.filter((item) => item.isEffective).length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="已转化" value={data.filter((item) => item.status === 'CONVERTED').length} valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>

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
        onCancel={closeForm}
        onSubmit={(values) => { void submit(values) }}
        onValuesChange={draft.save}
      />
      <TelemarketingConvertModal record={convertRecord} onClose={() => setConvertRecord(null)} onSaved={loadData} />
    </Card>
  )
}
