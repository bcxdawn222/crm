'use client'

import { Card } from 'antd'
import CRMChart from '@/components/charts/CRMChart'
import { useState, useEffect } from 'react'
import { apiRequest } from '@/lib/http/client'

interface FunnelStage {
  stage: string
  name: string
  count: number
  conversionRate: number
  avgDaysInStage: number
}

interface FunnelTooltipParams {
  color: string
  dataIndex: number
}

interface FunnelLabelParams {
  dataIndex: number
  name: string
}

const STAGE_COLORS = ['#2563eb', '#0f766e', '#d97706', '#dc2626', '#475569']

function emptyStageWidth(index: number, stageCount: number): number {
  if (stageCount <= 1) return 100
  return Math.round(100 - (index * 72) / (stageCount - 1))
}

export default function FunnelChart() {
  const [data, setData] = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFunnelData()
  }, [])

  const loadFunnelData = async () => {
    try {
      setLoading(true)
      const result = await apiRequest<{ success: true; data: { stages: FunnelStage[] } }>(
        '/api/statistics/funnel'
      )
      setData(result.data.stages)
    } catch (error) {
      console.error('Failed to load funnel data:', error)
    } finally {
      setLoading(false)
    }
  }

  const allStagesEmpty = data.length > 0 && data.every((stage) => stage.count === 0)
  const maxStageCount = Math.max(...data.map((stage) => stage.count), 1)
  const option = {
    animation: false,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#0f172a' },
      formatter: (params: FunnelTooltipParams) => {
        const stage = data[params.dataIndex]
        if (!stage) return ''

        return `
          <div style="padding: 8px; min-width: 168px;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: ${params.color};">
              ${stage.name}
            </div>
            <div style="font-size: 13px; line-height: 1.8; color: #475569;">
              <div>客户数：<strong style="color: #0f172a;">${stage.count}个</strong></div>
              <div>转化率：<strong style="color: #0f172a;">${stage.conversionRate}%</strong></div>
              <div>平均停留：<strong style="color: #0f172a;">${stage.avgDaysInStage}天</strong></div>
            </div>
          </div>
        `
      }
    },
    series: [{
      type: 'funnel',
      left: '8%',
      top: 12,
      bottom: 12,
      width: '84%',
      min: 0,
      max: allStagesEmpty ? 100 : maxStageCount,
      minSize: allStagesEmpty ? '28%' : '12%',
      maxSize: '100%',
      sort: 'none',
      gap: 3,
      label: {
        show: true,
        position: 'inside',
        formatter: (params: FunnelLabelParams) => {
          const stage = data[params.dataIndex]
          return `${params.name}\n${stage?.count ?? 0}个`
        },
        fontSize: 13,
        lineHeight: 18,
        color: '#fff',
        fontWeight: 600
      },
      labelLayout: { hideOverlap: true },
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 1,
        borderRadius: 2,
      },
      emphasis: {
        label: {
          fontSize: 14,
          fontWeight: 600
        },
        itemStyle: {
          shadowBlur: 12,
          shadowColor: 'rgba(15, 23, 42, 0.18)',
        }
      },
      data: data.map((stage, index) => ({
        value: allStagesEmpty ? emptyStageWidth(index, data.length) : stage.count,
        name: stage.name,
        itemStyle: {
          color: STAGE_COLORS[index % STAGE_COLORS.length],
        }
      }))
    }]
  }

  return (
    <Card
      loading={loading}
      data-testid="sales-funnel-card"
      title={<span style={{ fontSize: 16, fontWeight: 600 }}>销售漏斗</span>}
      extra={allStagesEmpty ? (
        <span style={{ color: '#64748b', fontSize: 13 }}>当前暂无客户</span>
      ) : null}
      style={{
        minHeight: 472,
        height: '100%',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'
      }}
      styles={{ body: { minHeight: 400, padding: '16px 20px 20px' } }}
    >
      {!loading && data.length > 0 && (
        <CRMChart
          className="sales-funnel-chart"
          option={option}
          style={{ height: 364 }}
          opts={{ renderer: 'svg' }}
        />
      )}
      {!loading && data.length === 0 && (
        <div style={{ display: 'grid', minHeight: 400, placeItems: 'center', color: '#999' }}>
          暂无数据
        </div>
      )}
    </Card>
  )
}
