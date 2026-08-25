'use client'

import { Card, Spin } from 'antd'
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

  const option = {
    title: {
      text: '销售漏斗',
      left: 'center',
      textStyle: { 
        fontSize: 18, 
        fontWeight: 'bold',
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: '#333' },
      formatter: (params: any) => {
        const stage = data[params.dataIndex]
        if (!stage) return ''
        
        return `
          <div style="padding: 12px; min-width: 180px;">
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: ${params.color};">
              ${stage.name}
            </div>
            <div style="font-size: 14px; line-height: 1.8;">
              <div>📊 客户数: <strong>${stage.count}</strong>个</div>
              <div>📈 转化率: <strong style="color: #52c41a;">${stage.conversionRate}%</strong></div>
              <div>⏱️ 平均停留: <strong>${stage.avgDaysInStage}</strong>天</div>
            </div>
          </div>
        `
      }
    },
    series: [{
      type: 'funnel',
      left: '10%',
      top: 60,
      bottom: 60,
      width: '80%',
      min: 0,
      max: Math.max(...data.map(s => s.count), 1),
      minSize: '0%',
      maxSize: '100%',
      sort: 'descending',
      gap: 4,
      label: {
        show: true,
        position: 'inside',
        formatter: '{b}\n{c}个',
        fontSize: 14,
        color: '#fff',
        fontWeight: 'bold'
      },
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 2,
        shadowBlur: 15,
        shadowColor: 'rgba(0, 0, 0, 0.2)',
        shadowOffsetY: 5
      },
      emphasis: {
        label: { 
          fontSize: 16,
          fontWeight: 'bold'
        },
        itemStyle: {
          shadowBlur: 25,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          shadowOffsetY: 8
        }
      },
      data: data.map((stage, index) => ({
        value: stage.count,
        name: stage.name,
        itemStyle: {
          color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'][index % 5],
        }
      }))
    }]
  }

  return (
    <Card
      loading={loading}
      title={<span style={{ fontSize: 16, fontWeight: 'bold' }}>销售漏斗</span>}
      style={{
        minHeight: 472,
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}
      styles={{ body: { minHeight: 400 } }}
    >
      {!loading && data.length > 0 && (
        <CRMChart
          option={option} 
          style={{ height: 400 }}
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
