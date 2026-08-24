'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, Table, Button, Space, DatePicker, Modal, Form, Input, message, Tag, Divider } from 'antd'
import { PlusOutlined, EyeOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useFormDraft } from '@/hooks/useFormDraft'
import { apiRequest } from '@/lib/http/client'

const { RangePicker } = DatePicker
const { TextArea } = Input

interface DailyReport {
  id: string
  reportDate: string
  content: string
  tomorrowPlan?: string
  issues?: string
  attachments?: string
  authorId: string
  reviewerId?: string
  status: string
  reviewComment?: string
  createdAt: string
  author?: {
    realName: string
    avatar?: string
  }
  reviewer?: {
    realName: string
  }
  _count?: {
    comments: number
  }
}

interface DailyReportFormValues {
  reportDate: Dayjs
  content: string
  tomorrowPlan?: string
  issues?: string
}

interface DailyReportDraft {
  reportDate?: string
  content?: string
  tomorrowPlan?: string
  issues?: string
}

function isDailyReportDraft(value: unknown): value is DailyReportDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as DailyReportDraft
  return (draft.reportDate === undefined || typeof draft.reportDate === 'string')
    && (draft.content === undefined || typeof draft.content === 'string')
    && (draft.tomorrowPlan === undefined || typeof draft.tomorrowPlan === 'string')
    && (draft.issues === undefined || typeof draft.issues === 'string')
}

export default function DailyReportsPage() {
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState<DailyReport[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>()
  const [modalVisible, setModalVisible] = useState(false)
  const [viewModalVisible, setViewModalVisible] = useState(false)
  const [currentReport, setCurrentReport] = useState<DailyReport | null>(null)
  const [form] = Form.useForm<DailyReportFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const requestIdRef = useRef('')
  const draft = useFormDraft<DailyReportFormValues, DailyReportDraft>({
    key: 'daily-reports:create',
    enabled: modalVisible,
    form,
    serialize: (values) => ({
      reportDate: values.reportDate?.toISOString(),
      content: values.content,
      tomorrowPlan: values.tomorrowPlan,
      issues: values.issues,
    }),
    deserialize: (values) => ({
      ...values,
      reportDate: values.reportDate ? dayjs(values.reportDate) : undefined,
    }),
    validate: isDailyReportDraft,
  })

  // 加载日报列表
  const loadReports = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.append('startDate', dateRange[0].format('YYYY-MM-DD'))
        params.append('endDate', dateRange[1].format('YYYY-MM-DD'))
      }

      const data = await apiRequest<{
        success: true
        data: { list: DailyReport[]; total: number }
      }>(`/api/daily-reports?${params}`)
      setReports(data.data.list)
      setTotal(data.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载日报失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [page, pageSize])

  // 搜索
  const handleSearch = () => {
    setPage(1)
    loadReports()
  }

  // 重置搜索
  const handleReset = () => {
    setDateRange(undefined)
    setPage(1)
  }

  // 打开新增弹窗
  const handleOpenModal = () => {
    requestIdRef.current = crypto.randomUUID()
    form.resetFields()
    form.setFieldsValue({
      reportDate: dayjs(),
    })
    setModalVisible(true)
  }

  useEffect(() => {
    if (modalVisible && draft.restore()) message.info('已恢复未提交的日报草稿')
  }, [modalVisible])

  // 提交表单
  const handleSubmit = async (values: DailyReportFormValues) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await apiRequest<{ success: true }>('/api/daily-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestIdRef.current,
        },
        body: JSON.stringify({
          ...values,
          reportDate: values.reportDate.format('YYYY-MM-DD'),
        }),
      }, {
        requestKey: `daily-report-create-${requestIdRef.current}`,
      })
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

  // 查看日报详情
  const handleView = (record: DailyReport) => {
    setCurrentReport(record)
    setViewModalVisible(true)
  }

  // 状态映射
  const statusMap: Record<string, { text: string; color: string }> = {
    DRAFT: { text: '草稿', color: 'default' },
    SUBMITTED: { text: '已提交', color: 'blue' },
    REVIEWED: { text: '已审阅', color: 'green' },
    REJECTED: { text: '已驳回', color: 'red' },
  }

  // 表格列定义
  const columns: ColumnsType<DailyReport> = [
    {
      title: '日期',
      dataIndex: 'reportDate',
      key: 'reportDate',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '提交人',
      dataIndex: 'author',
      key: 'author',
      width: 100,
      render: (_, record) => record.author?.realName || '-',
    },
    {
      title: '工作内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text) => (
        <Tag color={statusMap[text]?.color || 'default'}>
          {statusMap[text]?.text || text}
        </Tag>
      ),
    },
    {
      title: '评论数',
      dataIndex: '_count',
      key: 'comments',
      width: 80,
      render: (_, record) => record._count?.comments || 0,
    },
    {
      title: '审阅人',
      dataIndex: 'reviewer',
      key: 'reviewer',
      width: 100,
      render: (_, record) => record.reviewer?.realName || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title="日报管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
          >
            提交日报
          </Button>
        }
      >
        {/* 搜索栏 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]])
              } else {
                setDateRange(undefined)
              }
            }}
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={reports}
          rowKey="id"
          loading={loading}
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
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 新增弹窗 */}
      <Modal
        title="提交日报"
        open={modalVisible}
        onCancel={() => {
          if (!submitting) {
            draft.clear()
            setModalVisible(false)
          }
        }}
        footer={null}
        width={700}
        closable={!submitting}
        maskClosable={!submitting}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onValuesChange={draft.save}
        >
          <Form.Item
            name="reportDate"
            label="日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="content"
            label="今日工作内容"
            rules={[{ required: true, message: '请输入工作内容' }]}
          >
            <TextArea rows={6} placeholder="请详细描述今天的工作内容" />
          </Form.Item>

          <Form.Item name="tomorrowPlan" label="明日计划">
            <TextArea rows={4} placeholder="请描述明天的工作计划" />
          </Form.Item>

          <Form.Item name="issues" label="遇到的问题">
            <TextArea rows={4} placeholder="请描述工作中遇到的问题" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              提交
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看详情弹窗 */}
      <Modal
        title="日报详情"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={null}
        width={700}
      >
        {currentReport && (
          <div>
            <p><strong>日期:</strong> {new Date(currentReport.reportDate).toLocaleDateString()}</p>
            <p><strong>提交人:</strong> {currentReport.author?.realName}</p>
            <p><strong>状态:</strong> <Tag color={statusMap[currentReport.status]?.color}>{statusMap[currentReport.status]?.text}</Tag></p>
            <Divider />
            <h4>今日工作内容</h4>
            <p>{currentReport.content}</p>
            {currentReport.tomorrowPlan && (
              <>
                <h4>明日计划</h4>
                <p>{currentReport.tomorrowPlan}</p>
              </>
            )}
            {currentReport.issues && (
              <>
                <h4>遇到的问题</h4>
                <p>{currentReport.issues}</p>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
