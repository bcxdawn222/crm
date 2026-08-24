'use client'

import { Card, Radio } from 'antd'
import type { RadioChangeEvent } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/http/client'

interface TrendDataPoint {
  date: string
  revenue: number
  orders: number
  newCustomers: number
  followUps: number
}

interface TrendData {
  period: string
  granularity: string
  dataPoints: TrendDataPoint[]
}

export default function TrendChart() {
  const [period, setPeriod] = useState('30d')
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(false)

  // 加载趋势数据
  const loadTrendData = async (selectedPeriod: string) => {
    try {
      setLoading(true)
      const data = await apiRequest<{ success: true; data: TrendData }>(
        `/api/statistics/trend?period=${selectedPeriod}`
      )
      setTrendData(data.data)
    } catch (error) {
      console.error('Failed to load trend data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 时间范围改变
  const handlePeriodChange = (e: RadioChangeEvent) => {
    const newPeriod = e.target.value
    setPeriod(newPeriod)
  }

  // 初始加载
  useEffect(() => {
    void loadTrendData(period)
  }, [period])

  // 图表配置
  const chartOption = trendData ? {
    title: { 
      text: '业绩趋势分析',
      left: 'center',
      textStyle: { fontSize: 16 }
    },
    tooltip: { 
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: { 
      data: ['合同金额', '订单数', '新增客户'],
      bottom: 0,
      textStyle: { fontSize: 12 }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendData.dataPoints.map(d => d.date),
      axisLabel: {
        rotate: trendData.dataPoints.length > 15 ? 45 : 0,
        fontSize: 10
      }
    },
    yAxis: [
      { 
        type: 'value', 
        name: '金额(元)',
        position: 'left'
      },
      { 
        type: 'value', 
        name: '数量',
        position: 'right'
      }
    ],
    series: [
      {
        name: '合同金额',
        type: 'line',
        yAxisIndex: 0,
        smooth: true,
        data: trendData.dataPoints.map(d => d.revenue),
        itemStyle: { color: '#1890ff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
            ]
          }
        }
      },
      {
        name: '订单数',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: trendData.dataPoints.map(d => d.orders),
        itemStyle: { color: '#52c41a' }
      },
      {
        name: '新增客户',
        type: 'bar',
        yAxisIndex: 1,
        data: trendData.dataPoints.map(d => d.newCustomers),
        itemStyle: { color: '#faad14' }
      }
    ]
  } : {}

  return (
    <Card 
      title="业绩趋势"
      extra={
        <Radio.Group value={period} onChange={handlePeriodChange}>
          <Radio.Button value="7d">近7天</Radio.Button>
          <Radio.Button value="30d">近30天</Radio.Button>
          <Radio.Button value="90d">近90天</Radio.Button>
          <Radio.Button value="ytd">本年度</Radio.Button>
        </Radio.Group>
      }
      loading={loading}
    >
      {trendData && (
        <ReactECharts 
          option={chartOption} 
          style={{ height: 400 }}
          opts={{ renderer: 'svg' }}
        />
      )}
    </Card>
  )
}
