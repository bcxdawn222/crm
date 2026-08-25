'use client'

import { Card, Radio, Spin } from 'antd'
import CRMChart from '@/components/charts/CRMChart'
import { useState, useEffect } from 'react'
import { apiRequest } from '@/lib/http/client'

interface TrendDataPoint {
  date: string
  revenue: number
  orders: number
  newCustomers: number
}

export default function RevenueTrendChart() {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState<TrendDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTrendData(period)
  }, [period])

  const loadTrendData = async (selectedPeriod: string) => {
    try {
      setLoading(true)
      const result = await apiRequest<{
        success: true
        data: { dataPoints: TrendDataPoint[] }
      }>(`/api/statistics/trend?period=${selectedPeriod}`)
      setData(result.data.dataPoints)
    } catch (error) {
      console.error('Failed to load trend data:', error)
    } finally {
      setLoading(false)
    }
  }

  const option = {
    title: {
      text: '收入趋势分析',
      left: 'center',
      textStyle: { 
        fontSize: 18, 
        fontWeight: 'bold',
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: '#333' },
      axisPointer: {
        type: 'cross',
        crossStyle: { color: '#999' }
      },
      formatter: (params: any) => {
        const date = params[0].axisValue
        let html = `<div style="padding: 8px;"><strong>${date}</strong><br/>`
        
        params.forEach((item: any) => {
          const value = item.seriesName === '合同金额' 
            ? `¥${item.value.toLocaleString()}`
            : `${item.value}${item.seriesName === '订单数' ? '单' : '个'}`
          
          html += `
            <div style="margin-top: 4px; display: flex; align-items: center;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${item.color}; margin-right: 8px;"></span>
              <span>${item.seriesName}: <strong>${value}</strong></span>
            </div>
          `
        })
        
        html += '</div>'
        return html
      }
    },
    legend: {
      data: ['合同金额', '订单数', '新客户'],
      bottom: 10,
      itemWidth: 20,
      itemHeight: 12,
      textStyle: { fontSize: 13 }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(d => d.date),
      axisLine: { lineStyle: { color: '#ddd' } },
      axisLabel: { 
        color: '#666',
        rotate: data.length > 15 ? 45 : 0,
        fontSize: 11
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '金额(元)',
        position: 'left',
        axisLine: { show: false },
        axisLabel: { 
          color: '#666',
          formatter: (value: number) => `¥${value >= 10000 ? (value/10000).toFixed(1) + '万' : value}`
        },
        splitLine: { 
          lineStyle: { 
            color: '#f0f0f0',
            type: 'dashed'
          } 
        }
      },
      {
        type: 'value',
        name: '数量',
        position: 'right',
        axisLine: { show: false },
        axisLabel: { color: '#666' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '合同金额',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        yAxisIndex: 0,
        lineStyle: { 
          width: 3, 
          color: '#1890ff',
          shadowColor: 'rgba(24, 144, 255, 0.3)',
          shadowBlur: 10,
          shadowOffsetY: 5
        },
        itemStyle: { 
          color: '#1890ff', 
          borderWidth: 2, 
          borderColor: '#fff',
          shadowColor: 'rgba(24, 144, 255, 0.5)',
          shadowBlur: 10
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
            ]
          }
        },
        data: data.map(d => d.revenue)
      },
      {
        name: '订单数',
        type: 'line',
        smooth: true,
        symbol: 'diamond',
        symbolSize: 8,
        yAxisIndex: 1,
        lineStyle: { 
          width: 2, 
          color: '#52c41a',
          shadowColor: 'rgba(82, 196, 26, 0.3)',
          shadowBlur: 8
        },
        itemStyle: { 
          color: '#52c41a',
          shadowColor: 'rgba(82, 196, 26, 0.5)',
          shadowBlur: 8
        },
        data: data.map(d => d.orders)
      },
      {
        name: '新客户',
        type: 'bar',
        yAxisIndex: 1,
        barWidth: '40%',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#faad14' },
              { offset: 1, color: '#ffd666' }
            ]
          },
          borderRadius: [4, 4, 0, 0],
          shadowColor: 'rgba(250, 173, 20, 0.3)',
          shadowBlur: 8
        },
        emphasis: {
          itemStyle: {
            shadowColor: 'rgba(250, 173, 20, 0.5)',
            shadowBlur: 12
          }
        },
        data: data.map(d => d.newCustomers)
      }
    ]
  }

  return (
    <Card
      loading={loading}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>收入趋势</span>
          <Radio.Group value={period} onChange={(e) => setPeriod(e.target.value)} size="small" buttonStyle="solid">
            <Radio.Button value="7d">近7天</Radio.Button>
            <Radio.Button value="30d">近30天</Radio.Button>
            <Radio.Button value="90d">近90天</Radio.Button>
            <Radio.Button value="ytd">本年度</Radio.Button>
          </Radio.Group>
        </div>
      }
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
