'use client'

import { EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Card, DatePicker, Form, message, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'

import { useFormDraft } from '@/hooks/useFormDraft'
import { usePermission } from '@/hooks/usePermission'
import { useTablePagination } from '@/hooks/useTablePagination'
import { apiRequest } from '@/lib/http/client'

import { ReportDetailModal, ReportFormModal } from './report-modals'
import {
  type DailyReport,
  type DailyReportDraft,
  type DailyReportFormValues,
  isDailyReportDraft,
  statusMap,
} from './types'

const { RangePicker } = DatePicker

export default function DailyReportsPage() {
  const { permissions } = usePermission()
  const canCreateDaily = permissions.includes('report:daily:create')
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [total, setTotal] = useState(0)
  const { page, pageSize, setPage, changePage } = useTablePagination()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>()
  const [modalVisible, setModalVisible] = useState(false)
  const [currentReport, setCurrentReport] = useState<DailyReport | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<DailyReportFormValues>()
  const requestIdRef = useRef('')
  const draft = useFormDraft<DailyReportFormValues, DailyReportDraft>({
    key: 'daily-reports:create', enabled: modalVisible, form,
    serialize: (values) => ({
      reportDate: values.reportDate?.toISOString(), content: values.content,
      tomorrowPlan: values.tomorrowPlan, issues: values.issues,
    }),
    deserialize: (values) => ({ ...values, reportDate: values.reportDate ? dayjs(values.reportDate) : undefined }),
    validate: isDailyReportDraft,
  })

  const loadReports = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (dateRange) {
        params.append('startDate', dateRange[0].format('YYYY-MM-DD'))
        params.append('endDate', dateRange[1].format('YYYY-MM-DD'))
      }
      const response = await apiRequest<{ success: true; data: { list: DailyReport[]; total: number } }>(`/api/daily-reports?${params}`)
      setReports(response.data.list)
      setTotal(response.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载日报失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadReports() }, [page, pageSize])
  useEffect(() => { if (modalVisible && draft.restore()) message.info('已恢复未提交的日报草稿') }, [modalVisible])

  const openForm = () => {
    requestIdRef.current = crypto.randomUUID()
    form.resetFields()
    form.setFieldsValue({ reportDate: dayjs() })
    setModalVisible(true)
  }

  const closeForm = () => {
    if (submitting) return
    draft.clear()
    setModalVisible(false)
  }

  const submit = async (values: DailyReportFormValues) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await apiRequest<{ success: true }>('/api/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-request-id': requestIdRef.current },
        body: JSON.stringify({ ...values, reportDate: values.reportDate?.format('YYYY-MM-DD') }),
      }, { requestKey: `daily-report-create-${requestIdRef.current}` })
      message.success('提交成功')
      draft.clear()
      setModalVisible(false)
      await loadReports()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '提交日报失败')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<DailyReport> = [
    { title: '日期', dataIndex: 'reportDate', key: 'reportDate', width: 120, render: (date) => new Date(date).toLocaleDateString() },
    { title: '提交人', dataIndex: 'author', key: 'author', width: 100, render: (_, record) => record.author?.realName || '-' },
    { title: '工作内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (text) => <Tag color={statusMap[text]?.color || 'default'}>{statusMap[text]?.text || text}</Tag> },
    { title: '评论数', dataIndex: '_count', key: 'comments', width: 80, render: (_, record) => record._count?.comments || 0 },
    { title: '审阅人', dataIndex: 'reviewer', key: 'reviewer', width: 100, render: (_, record) => record.reviewer?.realName || '-' },
    { title: '操作', key: 'action', width: 100, fixed: 'right', render: (_, record) => <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setCurrentReport(record)}>查看</Button> },
  ]

  return (
    <Card
      title="日报管理"
      extra={canCreateDaily ? <Button type="primary" icon={<PlusOutlined />} onClick={openForm}>提交日报</Button> : null}
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker value={dateRange} onChange={(dates) => setDateRange(dates?.[0] && dates[1] ? [dates[0], dates[1]] : undefined)} />
        <Button type="primary" onClick={() => { setPage(1); void loadReports() }}>搜索</Button>
        <Button onClick={() => { setDateRange(undefined); setPage(1) }}>重置</Button>
      </Space>
      <Table
        columns={columns}
        dataSource={reports}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page, pageSize, total, showSizeChanger: true, showQuickJumper: true,
          showTotal: (count) => `共 ${count} 条`, onChange: changePage,
        }}
        scroll={{ x: 1000 }}
      />
      <ReportFormModal open={modalVisible} form={form} submitting={submitting} onCancel={closeForm} onSubmit={(values) => { void submit(values) }} onValuesChange={draft.save} />
      <ReportDetailModal report={currentReport} onClose={() => setCurrentReport(null)} />
    </Card>
  )
}
