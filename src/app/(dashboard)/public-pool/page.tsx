'use client'

import { BarChartOutlined } from '@ant-design/icons'
import { Button, Card, Input, message, Modal, Space } from 'antd'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { usePermission } from '@/hooks/usePermission'
import { apiRequest } from '@/lib/http/client'
import { useTablePagination } from '@/hooks/useTablePagination'

import { PoolTable } from './pool-table'
import { QuotaCard } from './quota-card'
import type { PublicPoolCustomer, PublicPoolStatistics, QuotaStatus } from './types'

const PublicPoolDashboard = dynamic(() => import('@/components/dashboard/PublicPoolDashboard'), {
  ssr: false,
  loading: () => <div aria-hidden style={{ minHeight: 520 }} />,
})

export default function PublicPoolPage() {
  const { can } = usePermission()
  const canUpdateCustomer = can('update', 'customer')
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<PublicPoolCustomer[]>([])
  const [total, setTotal] = useState(0)
  const { page, pageSize, setPage, changePage } = useTablePagination()
  const [keyword, setKeyword] = useState('')
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [showDashboard, setShowDashboard] = useState(false)
  const [statistics, setStatistics] = useState<PublicPoolStatistics | null>(null)

  const loadCustomers = async (targetPage = page, targetKeyword = keyword) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) })
      if (targetKeyword.trim()) params.append('keyword', targetKeyword.trim())
      const response = await apiRequest<{ success: true; data: { list: PublicPoolCustomer[]; total: number } }>(`/api/public-pool?${params}`)
      setCustomers(response.data.list)
      setTotal(response.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载公海客户失败')
    } finally {
      setLoading(false)
    }
  }

  const loadQuotaStatus = async () => {
    try {
      const response = await apiRequest<{ success: true; data: QuotaStatus }>('/api/public-pool/quota')
      setQuotaStatus(response.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载认领配额失败')
    }
  }

  const loadStatistics = async () => {
    try {
      const response = await apiRequest<{ success: true; data: PublicPoolStatistics }>('/api/public-pool/statistics')
      setStatistics(response.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载公海统计失败')
    }
  }

  useEffect(() => {
    void loadCustomers()
    void loadQuotaStatus()
  }, [page, pageSize])

  const claim = (customer: PublicPoolCustomer) => {
    Modal.confirm({
      title: '确认认领',
      content: `确定要认领客户"${customer.name}"吗?认领后该客户将归您所有。`,
      onOk: async () => {
        if (claimingId) return
        setClaimingId(customer.id)
        try {
          await apiRequest<{ success: true }>('/api/public-pool/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId: customer.id }),
          }, { requestKey: `public-pool-claim-${customer.id}` })
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

  return (
    <Card
      className="crm-public-pool-card"
      title="公海池"
      extra={(
        <Button
          icon={<BarChartOutlined />}
          onClick={() => {
            const nextVisible = !showDashboard
            setShowDashboard(nextVisible)
            if (nextVisible && !statistics) void loadStatistics()
          }}
        >
          {showDashboard ? '隐藏看板' : '显示看板'}
        </Button>
      )}
    >
      {showDashboard && statistics && <PublicPoolDashboard stats={statistics} />}
      <QuotaCard status={quotaStatus} />
      <Space className="crm-public-pool-search" style={{ marginBottom: 16 }}>
        <Input
          className="crm-public-pool-search-input"
          placeholder="搜索姓名、公司、电话"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 250 }}
          onPressEnter={() => { setPage(1); void loadCustomers(1) }}
        />
        <Button type="primary" onClick={() => { setPage(1); void loadCustomers(1) }}>搜索</Button>
        <Button onClick={() => { setKeyword(''); setPage(1); void loadCustomers(1, '') }}>重置</Button>
      </Space>
      <PoolTable
        customers={customers}
        loading={loading}
        page={page}
        pageSize={pageSize}
        total={total}
        quota={quotaStatus}
        canUpdate={canUpdateCustomer}
        claimingId={claimingId}
        onPageChange={changePage}
        onClaim={claim}
      />
    </Card>
  )
}
