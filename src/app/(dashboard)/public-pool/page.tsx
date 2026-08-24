'use client'

import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Input, Modal, message, Tag, Statistic, Row, Col, Progress } from 'antd'
import { UserAddOutlined, BarChartOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import PublicPoolDashboard from '@/components/dashboard/PublicPoolDashboard'
import { apiRequest } from '@/lib/http/client'

interface Customer {
  id: string
  name: string
  company?: string
  phone: string
  email?: string
  category: string
  status: string
  salesId: string
  createdAt: string
  lastFollowUpAt?: string
  publicPoolEnteredAt?: string
  publicPoolReason?: string
  sales?: {
    realName: string
  }
  _count?: {
    followUps: number
    orders: number
  }
}

interface Statistics {
  overview: {
    total: number
    todayAdded: number
    weekClaimed: number
    avgStayDays: number
  }
  byReason: Array<{ reason: string; count: number }>
  trend: Array<{ date: string; enterCount: number; claimCount: number }>
}

interface PublicPoolListResponse {
  success: true
  data: { list: Customer[]; total: number }
}

interface QuotaStatus {
  quota: {
    maxActiveCustomers: number
    maxDailyClaims: number
    claimHoldDays: number
  }
  usage: {
    activeCount: number
    todayClaims: number
  }
  canClaim: boolean
  isAdmin: boolean
}

export default function PublicPoolPage() {
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  
  // 新增: 配额状态
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  
  // 新增: 数据看板状态
  const [showDashboard, setShowDashboard] = useState(false)
  const [statistics, setStatistics] = useState<Statistics | null>(null)

  // 加载公海池客户列表
  const loadCustomers = async (
    targetPage = page,
    targetKeyword = keyword
  ) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        pageSize: pageSize.toString(),
      })
      if (targetKeyword.trim()) params.append('keyword', targetKeyword.trim())

      const data = await apiRequest<PublicPoolListResponse>(`/api/public-pool?${params}`)
      setCustomers(data.data.list)
      setTotal(data.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载公海客户失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
    loadQuotaStatus()
  }, [page, pageSize])

  // 加载统计数据
  const loadStatistics = async () => {
    try {
      const data = await apiRequest<{ success: true; data: Statistics }>('/api/public-pool/statistics')
      setStatistics(data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载公海统计失败')
    }
  }

  // 加载配额状态
  const loadQuotaStatus = async () => {
    try {
      const data = await apiRequest<{ success: true; data: QuotaStatus }>('/api/public-pool/quota')
      setQuotaStatus(data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载认领配额失败')
    }
  }

  // 搜索
  const handleSearch = () => {
    setPage(1)
    void loadCustomers(1)
  }

  // 认领客户
  const handleClaim = (customerId: string, customerName: string) => {
    Modal.confirm({
      title: '确认认领',
      content: `确定要认领客户"${customerName}"吗?认领后该客户将归您所有。`,
      onOk: async () => {
        if (claimingId) return
        setClaimingId(customerId)
        try {
          await apiRequest<{ success: true }>('/api/public-pool/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId }),
          }, {
            requestKey: `public-pool-claim-${customerId}`,
          })
          message.success('认领成功')
          await Promise.all([loadCustomers(), loadQuotaStatus()])
        } catch (error) {
          message.error(error instanceof Error ? error.message : '认领失败')
        } finally {
          setClaimingId(null)
        }
      },
    })
  }

  // 表格列定义
  const columns: ColumnsType<Customer> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '公司',
      dataIndex: 'company',
      key: 'company',
      ellipsis: true,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '原销售',
      dataIndex: 'sales',
      key: 'sales',
      width: 100,
      render: (_, record) => record.sales?.realName || '-',
    },
    {
      title: '进入原因',
      dataIndex: 'publicPoolReason',
      key: 'publicPoolReason',
      width: 180,
      render: (reason) => {
        const reasonMap: Record<string, { text: string; color: string }> = {
          'RULE_1': { text: '长期未跟进(90天)', color: 'red' },
          'RULE_2': { text: '创建后未跟进(30天)', color: 'orange' },
          'RULE_3': { text: '合同到期未续签', color: 'purple' },
          'RULE_4': { text: '客户已失效', color: 'default' },
          'RULE_5': { text: '多次跟进无进展', color: 'blue' },
          'AUTO_RECYCLE': { text: '超期自动回收', color: 'cyan' }
        }
        const config = reason ? (reasonMap[reason] || { text: reason, color: 'default' }) : { text: '-', color: 'default' }
        return <Tag color={config.color}>{config.text}</Tag>
      }
    },
    {
      title: '进入时间',
      dataIndex: 'publicPoolEnteredAt',
      key: 'publicPoolEnteredAt',
      width: 160,
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-'
    },
    {
      title: '最后跟进',
      dataIndex: 'lastFollowUpAt',
      key: 'lastFollowUpAt',
      width: 160,
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '从未跟进',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        const canClaim = quotaStatus?.canClaim || quotaStatus?.isAdmin || false
        return (
          <Button
            type="primary"
            size="small"
            icon={<UserAddOutlined />}
            disabled={!canClaim}
            loading={claimingId === record.id}
            onClick={() => handleClaim(record.id, record.name)}
          >
            {canClaim ? '认领' : '已达上限'}
          </Button>
        )
      }
    },
  ]

  return (
    <div>
      <Card 
        title="公海池"
        extra={
          <Button 
            icon={<BarChartOutlined />}
            onClick={() => {
              setShowDashboard(!showDashboard)
              if (!showDashboard && !statistics) {
                loadStatistics()
              }
            }}
          >
            {showDashboard ? '隐藏看板' : '显示看板'}
          </Button>
        }
      >
        {/* 数据看板 */}
        {showDashboard && statistics && (
          <PublicPoolDashboard stats={statistics} />
        )}

        {/* 配额状态卡片 */}
        {quotaStatus && !quotaStatus.isAdmin && (
          <Card style={{ marginBottom: 16, background: '#f0f5ff' }} size="small">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic 
                  title="当前活跃客户" 
                  value={quotaStatus.usage.activeCount} 
                  suffix={`/ ${quotaStatus.quota.maxActiveCustomers}`}
                  valueStyle={{ color: quotaStatus.usage.activeCount >= quotaStatus.quota.maxActiveCustomers * 0.9 ? '#ff4d4f' : '#3f8600' }}
                />
              </Col>
              <Col span={8}>
                <Statistic 
                  title="今日已认领" 
                  value={quotaStatus.usage.todayClaims} 
                  suffix={`/ ${quotaStatus.quota.maxDailyClaims}`}
                  valueStyle={{ color: quotaStatus.usage.todayClaims >= quotaStatus.quota.maxDailyClaims ? '#ff4d4f' : '#3f8600' }}
                />
              </Col>
              <Col span={8}>
                <div style={{ marginTop: 8 }}>
                  <Progress 
                    percent={(quotaStatus.usage.activeCount / quotaStatus.quota.maxActiveCustomers) * 100} 
                    size="small"
                    status={quotaStatus.usage.activeCount >= quotaStatus.quota.maxActiveCustomers ? 'exception' : 'normal'}
                    format={(percent) => `${percent?.toFixed(0)}%`}
                  />
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    客户容量使用率
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        )}

        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索姓名、公司、电话"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 250 }}
            onPressEnter={handleSearch}
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={() => { setKeyword(''); setPage(1); void loadCustomers(1, '') }}>
            重置
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={customers}
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
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  )
}
