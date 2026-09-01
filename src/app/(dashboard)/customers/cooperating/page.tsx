'use client'

import { Button, Card, Form, Input, message, Space } from 'antd'
import dayjs from 'dayjs'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

import { useFormDraft } from '@/hooks/useFormDraft'
import { usePermission } from '@/hooks/usePermission'
import { useTablePagination } from '@/hooks/useTablePagination'
import { isCooperatingCustomerDraft, type CooperatingCustomerDraft } from '@/lib/forms/crm-drafts'
import { apiRequest } from '@/lib/http/client'

import { CooperatingEditModal } from './cooperating-edit-modal'
import { CooperatingSummary } from './cooperating-summary'
import { CooperatingTable } from './cooperating-table'
import type { CooperatingCustomer, CooperatingFormValues, OperationManagerOption } from './types'

const ContractArchiveModal = dynamic(() => import('@/components/contract/ContractArchiveModal'), { ssr: false })

export default function CooperatingCustomersPage() {
  const { can } = usePermission()
  const canUpdateCustomer = can('update', 'customer')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CooperatingCustomer[]>([])
  const [total, setTotal] = useState(0)
  const { page, pageSize, setPage, changePage } = useTablePagination()
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [reminders, setReminders] = useState<CooperatingCustomer[]>([])
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CooperatingCustomer | null>(null)
  const [contractCustomer, setContractCustomer] = useState<CooperatingCustomer | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [managerLoading, setManagerLoading] = useState(false)
  const [managerOptions, setManagerOptions] = useState<OperationManagerOption[]>([])
  const [form] = Form.useForm<CooperatingFormValues>()
  const requestIdRef = useRef('')
  const listRequestRef = useRef(0)
  const cooperatingDraft = useFormDraft<CooperatingFormValues, CooperatingCustomerDraft>({
    key: `cooperating:${editingCustomer?.id || 'unknown'}`,
    enabled: editModalVisible && Boolean(editingCustomer),
    form,
    serialize: (values) => ({
      contractStartDate: values.contractStartDate?.toISOString(),
      contractEndDate: values.contractEndDate?.toISOString(),
      contractAmount: values.contractAmount,
      renewalReminderDays: values.renewalReminderDays,
      operationManagerId: values.operationManagerId,
      lastVisitAt: values.lastVisitAt?.toISOString(),
      nextVisitAt: values.nextVisitAt?.toISOString(),
      visitFrequency: values.visitFrequency,
      cooperationNotes: values.cooperationNotes,
    }),
    deserialize: (values) => ({
      ...values,
      contractStartDate: values.contractStartDate ? dayjs(values.contractStartDate) : undefined,
      contractEndDate: values.contractEndDate ? dayjs(values.contractEndDate) : null,
      lastVisitAt: values.lastVisitAt ? dayjs(values.lastVisitAt) : undefined,
      nextVisitAt: values.nextVisitAt ? dayjs(values.nextVisitAt) : undefined,
    }),
    validate: isCooperatingCustomerDraft,
  })

  const loadData = async () => {
    const requestId = ++listRequestRef.current
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
      if (expiringSoon) params.append('expiringSoon', 'true')
      if (keyword) params.append('keyword', keyword)
      const result = await apiRequest<{ success: true; data: { list: CooperatingCustomer[]; total: number } }>(`/api/customers/cooperating?${params}`)
      if (requestId !== listRequestRef.current) return
      setData(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      if (requestId === listRequestRef.current) message.error(error instanceof Error ? error.message : '加载合作客户失败')
    } finally {
      if (requestId === listRequestRef.current) setLoading(false)
    }
  }

  const loadReminders = async () => {
    try {
      const result = await apiRequest<{ success: true; data: CooperatingCustomer[] }>('/api/customers/renewal-reminders?days=30')
      setReminders(result.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载续签提醒失败')
    }
  }

  const loadOperationManagers = async () => {
    setManagerLoading(true)
    try {
      const result = await apiRequest<{ success: true; data: OperationManagerOption[] }>('/api/customers/operation-manager-options')
      setManagerOptions(result.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载运营负责人失败')
    } finally {
      setManagerLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    void loadReminders()
  }, [page, pageSize, expiringSoon, keyword])

  useEffect(() => {
    if (editModalVisible && cooperatingDraft.restore()) message.info('已恢复未提交的合作客户草稿')
  }, [editModalVisible, editingCustomer?.id])

  const openEdit = (customer: CooperatingCustomer) => {
    requestIdRef.current = crypto.randomUUID()
    setEditingCustomer(customer)
    form.setFieldsValue({
      contractStartDate: customer.contractStartDate ? dayjs(customer.contractStartDate) : null,
      contractEndDate: customer.contractEndDate ? dayjs(customer.contractEndDate) : null,
      contractAmount: customer.contractAmount === undefined ? undefined : Number(customer.contractAmount),
      renewalReminderDays: customer.renewalReminderDays || 30,
      operationManagerId: customer.operationManagerId || customer.operationManager?.id,
      lastVisitAt: customer.lastVisitAt ? dayjs(customer.lastVisitAt) : null,
      nextVisitAt: customer.nextVisitAt ? dayjs(customer.nextVisitAt) : null,
      visitFrequency: customer.visitFrequency,
      cooperationNotes: customer.cooperationNotes,
    })
    setEditModalVisible(true)
    void loadOperationManagers()
  }

  const closeEdit = () => {
    if (submitting) return
    cooperatingDraft.clear()
    setEditModalVisible(false)
    form.resetFields()
    setEditingCustomer(null)
  }

  const handleEdit = async (values: CooperatingFormValues) => {
    if (!editingCustomer || submitting) return
    setSubmitting(true)
    try {
      await apiRequest<{ success: true }>(`/api/customers/cooperating?id=${editingCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestIdRef.current },
        body: JSON.stringify({
          ...values,
          contractStartDate: values.contractStartDate?.format('YYYY-MM-DD'),
          contractEndDate: values.contractEndDate?.format('YYYY-MM-DD') ?? null,
          lastVisitAt: values.lastVisitAt?.format('YYYY-MM-DD'),
          nextVisitAt: values.nextVisitAt?.format('YYYY-MM-DD'),
        }),
      }, { requestKey: `cooperating-update-${editingCustomer.id}-${requestIdRef.current}` })
      message.success('更新成功')
      cooperatingDraft.clear()
      setEditModalVisible(false)
      form.resetFields()
      setEditingCustomer(null)
      await Promise.all([loadData(), loadReminders()])
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新合作客户失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Card title="已合作客户管理">
        <CooperatingSummary data={data} reminders={reminders} total={total} />
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            allowClear
            enterButton="搜索"
            placeholder="搜索客户、公司、联系人"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onSearch={(value) => { setKeyword(value.trim()); setPage(1) }}
            style={{ width: 320, maxWidth: '100%' }}
          />
          {keyword ? (
            <Button onClick={() => { setKeywordInput(''); setKeyword(''); setPage(1) }}>重置</Button>
          ) : null}
        </Space>
        <CooperatingTable
          data={data} loading={loading} page={page} pageSize={pageSize} total={total}
          expiringSoon={expiringSoon} canUpdateCustomer={canUpdateCustomer}
          onExpiringSoonChange={(value) => { setExpiringSoon(value); setPage(1) }}
          onPageChange={changePage}
          onArchive={setContractCustomer} onEdit={openEdit}
        />
      </Card>
      <CooperatingEditModal open={editModalVisible} submitting={submitting} managerLoading={managerLoading} managers={managerOptions} form={form} onCancel={closeEdit} onSubmit={handleEdit} onValuesChange={cooperatingDraft.save} />
      <ContractArchiveModal visible={Boolean(contractCustomer)} customerId={contractCustomer?.id || ''} customerName={contractCustomer?.name || ''} onClose={() => setContractCustomer(null)} onSuccess={() => { void loadData() }} />
    </div>
  )
}
