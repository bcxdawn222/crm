'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, Table, Button, Space, Modal, Form, Input, Tag, message, Popconfirm, Statistic, Row, Col } from 'antd'
import { PlusOutlined, PhoneOutlined, CheckCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useFormDraft } from '@/hooks/useFormDraft'
import { isTelemarketingDraft, type TelemarketingDraft } from '@/lib/forms/crm-drafts'
import { apiRequest } from '@/lib/http/client'
import { TelemarketingConvertModal } from './telemarketing-convert-modal'
import { usePermission } from '@/hooks/usePermission'

const { TextArea } = Input

interface TelemarketingRecord {
  id: string
  name: string
  company?: string
  phone: string
  position?: string
  industry?: string
  source?: string
  callTimes: number
  lastCallAt?: string
  callDuration?: number
  status: string
  result?: string
  notes?: string
  isEffective: boolean
  customerId?: string
  createdAt: string
  customer?: {
    id: string
    name: string
    phone: string
  }
}

interface TelemarketingFormValues {
  name: string
  company?: string
  phone: string
  position?: string
  industry?: string
  source?: string
  notes?: string
}

interface TelemarketingListResponse {
  success: true
  data: {
    list: TelemarketingRecord[]
    total: number
  }
}

interface TelemarketingMutationResponse {
  success: true
}

export default function TelemarketingPage() {
  const { permissions } = usePermission()
  const canCreate = permissions.includes('lead:create')
  const canUpdate = permissions.includes('lead:update')
  const canConvert = permissions.includes('lead:convert') && permissions.includes('customer:create')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TelemarketingRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<TelemarketingRecord | null>(null)
  const [form] = Form.useForm<TelemarketingFormValues>()
  const [convertRecord, setConvertRecord] = useState<TelemarketingRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const formRequestIdRef = useRef('')
  const telemarketingDraft = useFormDraft<TelemarketingFormValues, TelemarketingDraft>({
    key: `telemarketing:${editingRecord?.id || 'create'}`,
    enabled: modalVisible,
    form,
    serialize: (values) => ({
      name: values.name,
      company: values.company,
      phone: values.phone,
      position: values.position,
      industry: values.industry,
      source: values.source,
      notes: values.notes,
    }),
    deserialize: (values) => values,
    validate: isTelemarketingDraft,
  })

  // Load data
  const loadData = async () => {
    setLoading(true)
    try {
      const result = await apiRequest<TelemarketingListResponse>(
        `/api/telemarketing?page=${page}&pageSize=${pageSize}`
      )
      setData(result.data.list)
      setTotal(result.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载电销记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, pageSize])

  useEffect(() => {
    if (modalVisible && telemarketingDraft.restore()) message.info('已恢复未提交的电销草稿')
  }, [editingRecord?.id, modalVisible])

  // Handle create/edit
  const handleSubmit = async (values: TelemarketingFormValues) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const url = editingRecord
        ? `/api/telemarketing?id=${editingRecord.id}`
        : '/api/telemarketing'
      await apiRequest<TelemarketingMutationResponse>(url, {
        method: editingRecord ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': formRequestIdRef.current,
        },
        body: JSON.stringify(values),
      }, {
        requestKey: `telemarketing-form-${editingRecord?.id || 'new'}-${formRequestIdRef.current}`,
      })
      message.success(editingRecord ? '更新成功' : '创建成功')
      telemarketingDraft.clear()
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

  // Handle delete
  const handleDelete = async (id: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      await apiRequest<TelemarketingMutationResponse>(`/api/telemarketing?id=${id}`, {
        method: 'DELETE',
      }, {
        requestKey: `telemarketing-delete-${id}`,
      })
      message.success('删除成功')
      await loadData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除电销记录失败')
    } finally {
      setDeletingId(null)
    }
  }

  // Table columns
  const columns: ColumnsType<TelemarketingRecord> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      width: 150,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (phone) => (
        <Space>
          <PhoneOutlined />
          {phone}
        </Space>
      ),
    },
    {
      title: '职位',
      dataIndex: 'position',
      key: 'position',
      width: 100,
    },
    {
      title: '行业',
      dataIndex: 'industry',
      key: 'industry',
      width: 100,
    },
    {
      title: '拨打次数',
      dataIndex: 'callTimes',
      key: 'callTimes',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          PENDING: { color: 'default', text: '待拨打' },
          CONNECTED: { color: 'green', text: '已接通' },
          NOT_ANSWERED: { color: 'orange', text: '未接听' },
          BUSY: { color: 'volcano', text: '忙线' },
          INVALID: { color: 'red', text: '无效号码' },
          CALLBACK: { color: 'blue', text: '需回拨' },
          FOLLOW_UP: { color: 'purple', text: '需跟进' },
          CONVERTED: { color: 'cyan', text: '已转化' },
        }
        const config = statusMap[status] || { color: 'default', text: status }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (result) => {
        if (!result) return '-'
        const resultMap: Record<string, string> = {
          INTERESTED: '有意向',
          NOT_INTERESTED: '无意向',
          NEED_FOLLOWUP: '需跟进',
          WRONG_NUMBER: '错号',
          EMPTY_NUMBER: '空号',
          OTHER: '其他',
        }
        return resultMap[result] || result
      },
    },
    {
      title: '有效性',
      dataIndex: 'isEffective',
      key: 'isEffective',
      width: 80,
      render: (isEffective) => (
        <Tag color={isEffective ? 'green' : 'default'}>
          {isEffective ? '有效' : '无效'}
        </Tag>
      ),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {canUpdate && <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                formRequestIdRef.current = crypto.randomUUID()
                setEditingRecord(record)
                form.setFieldsValue(record)
                setModalVisible(true)
              }}
            >
              编辑
            </Button>}
          {canConvert && !record.customerId && (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => setConvertRecord(record)}
            >
              转入客户
            </Button>
          )}
          {canUpdate && <Popconfirm
            title="确认删除"
            description="确定要删除这条电销记录吗?"
            onConfirm={() => handleDelete(record.id)}
            okButtonProps={{ loading: deletingId === record.id }}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title="电销名单管理"
        extra={canCreate ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              formRequestIdRef.current = crypto.randomUUID()
              setEditingRecord(null)
              form.resetFields()
              setModalVisible(true)
            }}
          >
            新增电销记录
          </Button>
        ) : null}
      >
        {/* Statistics */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总记录数"
                value={total}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="待拨打"
                value={data.filter(r => r.status === 'PENDING').length}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="有效客户"
                value={data.filter(r => r.isEffective).length}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已转化"
                value={data.filter(r => r.status === 'CONVERTED').length}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
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
          scroll={{ x: 1600 }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingRecord ? '编辑电销记录' : '新增电销记录'}
        open={modalVisible}
        onCancel={() => {
          if (submitting) return
          telemarketingDraft.clear()
          setModalVisible(false)
          form.resetFields()
          setEditingRecord(null)
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
          onValuesChange={telemarketingDraft.save}
        >
          <Form.Item
            name="name"
            label="客户姓名"
            rules={[{ required: true, message: '请输入客户姓名' }]}
          >
            <Input placeholder="请输入客户姓名" />
          </Form.Item>

          <Form.Item
            name="company"
            label="公司名称"
          >
            <Input placeholder="请输入公司名称" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="电话号码"
            rules={[
              { required: true, message: '请输入电话号码' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码' }
            ]}
          >
            <Input placeholder="请输入手机号码" />
          </Form.Item>

          <Form.Item
            name="position"
            label="职位"
          >
            <Input placeholder="请输入职位" />
          </Form.Item>

          <Form.Item
            name="industry"
            label="行业"
          >
            <Input placeholder="请输入行业" />
          </Form.Item>

          <Form.Item
            name="source"
            label="数据来源"
          >
            <Input placeholder="如:展会、网站、推荐等" />
          </Form.Item>

          <Form.Item
            name="notes"
            label="备注"
          >
            <TextArea rows={4} placeholder="请输入沟通备注" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingRecord ? '更新' : '创建'}
              </Button>
              <Button onClick={() => { telemarketingDraft.clear(); setModalVisible(false) }} disabled={submitting}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <TelemarketingConvertModal
        record={convertRecord}
        onClose={() => setConvertRecord(null)}
        onSaved={loadData}
      />
    </div>
  )
}
