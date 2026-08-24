'use client'

import { useState, useEffect } from 'react'
import { Card, Tabs, message, Spin } from 'antd'
import SalesOverview from '@/components/statistics/SalesOverview'
import FunnelAnalysis from '@/components/statistics/FunnelAnalysis'
import TrendChart from '@/components/statistics/TrendChart'
import { apiRequest } from '@/lib/http/client'

interface SalesOverviewData {
  monthlyRevenue: number
  monthlyOrders: number
  monthlyPayments: number
  monthlyNewCustomers: number
  revenueGrowth: number
  yearlyRevenue: number
  yearlyTarget: number
  targetCompletion: number
}

interface FunnelStage {
  stage: string
  name: string
  count: number
  conversionRate: number
  avgDaysInStage: number
}

interface FunnelData {
  stages: FunnelStage[]
  overallConversionRate: number
  avgSalesCycle: number
}

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [salesOverview, setSalesOverview] = useState<SalesOverviewData | null>(null)
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null)

  // 加载销售业绩总览
  const loadSalesOverview = async () => {
    try {
      setLoading(true)
      const data = await apiRequest<{ success: true; data: SalesOverviewData }>(
        '/api/statistics/sales-overview'
      )
      setSalesOverview(data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载销售总览失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载销售漏斗数据
  const loadFunnelData = async () => {
    try {
      setLoading(true)
      const data = await apiRequest<{ success: true; data: FunnelData }>('/api/statistics/funnel')
      setFunnelData(data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载销售漏斗失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSalesOverview()
  }, [])

  useEffect(() => {
    if (activeTab === 'funnel' && !funnelData) {
      loadFunnelData()
    }
  }, [activeTab])

  const tabs = [
    {
      key: 'overview',
      label: '销售总览',
      children: (
        <div>
          {salesOverview ? (
            <SalesOverview data={salesOverview} />
          ) : (
            <Spin tip="加载中..." />
          )}
        </div>
      ),
    },
    {
      key: 'funnel',
      label: '销售漏斗',
      children: (
        <div>
          {funnelData ? (
            <FunnelAnalysis data={funnelData} />
          ) : (
            <Spin tip="加载中..." />
          )}
        </div>
      ),
    },
    {
      key: 'trend',
      label: '业绩趋势',
      children: <TrendChart />,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card title="数据统计看板">
        <Tabs 
          items={tabs} 
          activeKey={activeTab} 
          onChange={setActiveTab}
        />
      </Card>
    </div>
  )
}
