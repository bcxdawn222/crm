'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, Table, Button, Space, Modal, Form, DatePicker, InputNumber, Select, Tag, message, Input, Statistic, Row, Col, Alert } from 'antd'
import { BellOutlined, CalendarOutlined, PhoneOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import { Resizable } from 'react-resizable'
import 'react-resizable/css/styles.css'
import { ContractArchiveModal } from '@/components/contract'
import { useFormDraft } from '@/hooks/useFormDraft'
import {
  isCooperatingCustomerDraft,
  type CooperatingCustomerDraft,
} from '@/lib/forms/crm-drafts'
import { apiRequest } from '@/lib/http/client'

const { TextArea } = Input

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

interface CooperatingCustomer {
  id: string
  name: string
  company?: string
  contactPerson?: string
  phone?: string
  contractStartDate?: string
  contractEndDate?: string
  contractAmount?: number
  renewalReminderDays?: number
  lastVisitAt?: string
  nextVisitAt?: string
  visitFrequency?: string
  cooperationNotes?: string
  createdAt: string
  sales?: {
    id: string
    realName: string
  }
  operationManager?: {
    id: string
    realName: string
  }
  operationManagerId?: string
}

interface CooperatingFormValues {
  contractStartDate?: Dayjs | null
  contractEndDate: Dayjs | null
  contractAmount?: number
  renewalReminderDays?: number
  operationManagerId?: string
  lastVisitAt?: Dayjs | null
  nextVisitAt?: Dayjs | null
  visitFrequency?: string
  cooperationNotes?: string
}

interface OperationManagerOption {
  id: string
  realName: string
  username: string
  department?: string | null
  position?: string | null
}

export default function CooperatingCustomersPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CooperatingCustomer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CooperatingCustomer | null>(null)
  const [form] = Form.useForm<CooperatingFormValues>()
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [reminders, setReminders] = useState<CooperatingCustomer[]>([])
  const [contractModalVisible, setContractModalVisible] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [managerLoading, setManagerLoading] = useState(false)
  const [managerOptions, setManagerOptions] = useState<OperationManagerOption[]>([])
  const requestIdRef = useRef('')
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
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    name: 100,
    company: 150,
    contactPerson: 100,
    phone: 120,
    operationManager: 120,
    contractAmount: 120,
    contractPeriod: 200,
    daysLeft: 100,
    visitFrequency: 100,
    nextVisitAt: 120,
    action: 100,
  })

  // Load data
  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      
      if (expiringSoon) {
        params.append('expiringSoon', 'true')
      }

      const result = await apiRequest<{
        success: true
        data: { list: CooperatingCustomer[]; total: number }
      }>(`/api/customers/cooperating?${params}`)
      setData(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载合作客户失败')
    } finally {
      setLoading(false)
    }
  }

  // Load renewal reminders
  const loadReminders = async () => {
    try {
      const result = await apiRequest<{ success: true; data: CooperatingCustomer[] }>(
        '/api/customers/renewal-reminders?days=30'
      )
      setReminders(result.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载续签提醒失败')
    }
  }

  const loadOperationManagers = async () => {
    setManagerLoading(true)
    try {
      const result = await apiRequest<{ success: true; data: OperationManagerOption[] }>(
        '/api/customers/operation-manager-options'
      )
      setManagerOptions(result.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载运营负责人失败')
    } finally {
      setManagerLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    loadReminders()
  }, [page, pageSize, expiringSoon])

  useEffect(() => {
    if (editModalVisible && cooperatingDraft.restore()) {
      message.info('已恢复未提交的合作客户草稿')
    }
  }, [editModalVisible, editingCustomer?.id])

  // Handle edit
  const handleEdit = async (values: CooperatingFormValues) => {
    if (!editingCustomer || submitting) return
    if (!values.contractEndDate) {
      message.error('请选择合同到期日期')
      return
    }

    setSubmitting(true)
    try {
      await apiRequest<{ success: true }>(`/api/customers/cooperating?id=${editingCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestIdRef.current,
        },
        body: JSON.stringify({
          ...values,
          contractStartDate: values.contractStartDate?.format('YYYY-MM-DD'),
          contractEndDate: values.contractEndDate.format('YYYY-MM-DD'),
          lastVisitAt: values.lastVisitAt?.format('YYYY-MM-DD'),
          nextVisitAt: values.nextVisitAt?.format('YYYY-MM-DD'),
        }),
      }, {
        requestKey: `cooperating-update-${editingCustomer.id}-${requestIdRef.current}`,
      })
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

  // 处理列宽度调整
  const handleResize = (key: string) => (_: any, { size }: { size: { width: number } }) => {
    setColumnWidths((prev) => ({
      ...prev,
      [key]: size.width,
    }))
  }

  // Calculate days until contract end
  const getDaysUntilEnd = (endDate?: string) => {
    if (!endDate) return null
    const end = new Date(endDate)
    const today = new Date()
    const diffTime = end.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Table columns
  const columns: ColumnsType<CooperatingCustomer> = [
    {
      title: '客户姓名',
      dataIndex: 'name',
      key: 'name',
      width: columnWidths.name,
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '公司名称',
      dataIndex: 'company',
      key: 'company',
      width: columnWidths.company,
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      width: columnWidths.contactPerson,
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
      render: (phone) => (
        <Space>
          <PhoneOutlined />
          {phone}
        </Space>
      ),
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '运营负责人',
      key: 'operationManager',
      width: columnWidths.operationManager,
      render: (_, record) => (
        <span>{record.operationManager?.realName || '-'}</span>
      ),
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '合同金额',
      dataIndex: 'contractAmount',
      key: 'contractAmount',
      width: columnWidths.contractAmount,
      render: (amount) => amount ? `¥${amount.toLocaleString()}` : '-',
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '合同期限',
      key: 'contractPeriod',
      width: columnWidths.contractPeriod,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <div>开始: {record.contractStartDate ? dayjs(record.contractStartDate).format('YYYY-MM-DD') : '-'}</div>
          <div>到期: {record.contractEndDate ? dayjs(record.contractEndDate).format('YYYY-MM-DD') : '-'}</div>
        </Space>
      ),
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '剩余天数',
      key: 'daysLeft',
      width: columnWidths.daysLeft,
      render: (_, record) => {
        const days = getDaysUntilEnd(record.contractEndDate)
        if (days === null) return '-'
        
        let color = 'green'
        if (days <= 7) color = 'red'
        else if (days <= 30) color = 'orange'
        
        return <Tag color={color}>{days}天</Tag>
      },
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '回访频率',
      dataIndex: 'visitFrequency',
      key: 'visitFrequency',
      width: columnWidths.visitFrequency,
      render: (freq) => {
        const freqMap: Record<string, string> = {
          WEEKLY: '每周',
          MONTHLY: '每月',
          QUARTERLY: '每季度',
          YEARLY: '每年',
        }
        return freq ? freqMap[freq] || freq : '-'
      },
      onHeaderCell: (column) => ({
        width: 'width' in column ? column.width : undefined,
        onResize: handleResize(column.key as string),
      }),
    },
    {
      title: '下次回访',
      dataIndex: 'nextVisitAt',
      key: 'nextVisitAt',
      width: columnWidths.nextVisitAt,
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
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
            icon={<FileTextOutlined />}
            onClick={() => {
              setSelectedCustomerId(record.id)
              setSelectedCustomerName(record.name)
              setContractModalVisible(true)
            }}
          >
            合同备案
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              requestIdRef.current = crypto.randomUUID()
              setEditingCustomer(record)
              form.setFieldsValue({
                contractStartDate: record.contractStartDate ? dayjs(record.contractStartDate) : null,
                contractEndDate: record.contractEndDate ? dayjs(record.contractEndDate) : null,
                contractAmount: record.contractAmount,
                renewalReminderDays: record.renewalReminderDays || 30,
                operationManagerId: record.operationManagerId || record.operationManager?.id,
                lastVisitAt: record.lastVisitAt ? dayjs(record.lastVisitAt) : null,
                nextVisitAt: record.nextVisitAt ? dayjs(record.nextVisitAt) : null,
                visitFrequency: record.visitFrequency,
                cooperationNotes: record.cooperationNotes,
              })
              setEditModalVisible(true)
              void loadOperationManagers()
            }}
          >
            编辑
          </Button>
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
      
      <Card title="已合作客户管理">
        {/* Renewal Reminders */}
        {reminders.length > 0 && (
          <Alert
            message={`有 ${reminders.length} 个客户合同即将到期`}
            description="请及时联系客户进行续签"
            type="warning"
            showIcon
            icon={<BellOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Statistics */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="已合作客户总数"
                value={total}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="即将到期"
                value={reminders.length}
                valueStyle={{ color: reminders.length > 0 ? '#cf1322' : '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="本月需回访"
                value={data.filter(c => {
                  if (!c.nextVisitAt) return false
                  const nextVisit = dayjs(c.nextVisitAt)
                  return nextVisit.month() === dayjs().month()
                }).length}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总合同金额"
                value={data.reduce((sum, c) => sum + Number(c.contractAmount || 0), 0)}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Space style={{ marginBottom: 16 }}>
          <Button
            type={expiringSoon ? 'primary' : 'default'}
            icon={<CalendarOutlined />}
            onClick={() => {
              setExpiringSoon(!expiringSoon)
              setPage(1)
            }}
          >
            {expiringSoon ? '显示全部' : '查看即将到期'}
          </Button>
        </Space>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          components={{
            header: {
              cell: ResizableTitle,
            },
          }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (newPage, newPageSize) => {
              setPage(newPage)
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize)
                setPage(1)
              }
            },
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title="编辑合作信息"
        open={editModalVisible}
        onCancel={() => {
          if (submitting) return
          cooperatingDraft.clear()
          setEditModalVisible(false)
          form.resetFields()
          setEditingCustomer(null)
        }}
        footer={null}
        width={700}
        closable={!submitting}
        maskClosable={!submitting}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEdit}
          onValuesChange={cooperatingDraft.save}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contractStartDate"
                label="合同开始日期"
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择开始日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contractEndDate"
                label="合同到期日期"
                rules={[{ required: true, message: '请选择合同到期日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择到期日期" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
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
            </Col>
            <Col span={12}>
              <Form.Item
                name="renewalReminderDays"
                label="续签提前提醒天数"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={365}
                  placeholder="默认30天"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="operationManagerId"
                label="运营负责人"
              >
                <Select
                  placeholder="选择运营负责人"
                  allowClear
                  showSearch
                  loading={managerLoading}
                  optionFilterProp="label"
                  options={managerOptions.map((manager) => ({
                    value: manager.id,
                    label: [manager.realName, manager.department, manager.position]
                      .filter(Boolean)
                      .join(' · '),
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="visitFrequency"
                label="回访频率"
              >
                <Select placeholder="选择回访频率">
                  <Select.Option value="WEEKLY">每周</Select.Option>
                  <Select.Option value="MONTHLY">每月</Select.Option>
                  <Select.Option value="QUARTERLY">每季度</Select.Option>
                  <Select.Option value="YEARLY">每年</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="nextVisitAt"
                label="下次回访日期"
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择下次回访日期" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="cooperationNotes"
            label="合作备注"
          >
            <TextArea rows={4} placeholder="记录合作相关的重要信息" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                保存
              </Button>
              <Button onClick={() => { cooperatingDraft.clear(); setEditModalVisible(false) }} disabled={submitting}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Contract Archive Modal */}
      <ContractArchiveModal
        visible={contractModalVisible}
        customerId={selectedCustomerId}
        customerName={selectedCustomerName}
        onClose={() => {
          setContractModalVisible(false)
          setSelectedCustomerId('')
          setSelectedCustomerName('')
        }}
        onSuccess={() => {
          loadData()
        }}
      />
    </div>
  )
}

