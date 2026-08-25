'use client'

import { Card, Statistic, Row, Col } from 'antd'
import CRMChart from '@/components/charts/CRMChart'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

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

export default function PublicPoolDashboard({ stats }: { stats: Statistics }) {
  // 饼图配置
  const pieOption = {
    title: { 
      text: '公海池客户来源分布', 
      left: 'center',
      textStyle: { fontSize: 14 }
    },
    tooltip: { 
      trigger: 'item',
      formatter: '{b}: {c}个 ({d}%)'
    },
    legend: { 
      orient: 'vertical',
      left: 'left',
      bottom: 0,
      textStyle: { fontSize: 12 }
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['60%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        formatter: '{b}\n{c}个',
        fontSize: 12
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      data: stats.byReason.map(r => ({
        name: r.reason,
        value: r.count
      }))
    }]
  }

  // 折线图配置
  const lineOption = {
    title: { 
      text: '近30天公海池流转趋势', 
      left: 'center',
      textStyle: { fontSize: 14 }
    },
    tooltip: { 
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: { 
      data: ['进入', '认领'], 
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
      data: stats.trend.map(t => t.date.slice(5)), // 只显示月-日
      axisLabel: {
        rotate: 45,
        fontSize: 10
      }
    },
    yAxis: { 
      type: 'value',
      name: '数量'
    },
    series: [
      {
        name: '进入',
        type: 'line',
        smooth: true,
        data: stats.trend.map(t => t.enterCount),
        itemStyle: { color: '#ff4d4f' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255, 77, 79, 0.3)' },
              { offset: 1, color: 'rgba(255, 77, 79, 0.05)' }
            ]
          }
        }
      },
      {
        name: '认领',
        type: 'line',
        smooth: true,
        data: stats.trend.map(t => t.claimCount),
        itemStyle: { color: '#52c41a' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
              { offset: 1, color: 'rgba(82, 196, 26, 0.05)' }
            ]
          }
        }
      }
    ]
  }

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="公海池总数" 
              value={stats.overview.total} 
              suffix="个"
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="今日新增" 
              value={stats.overview.todayAdded} 
              suffix="个"
              valueStyle={{ color: stats.overview.todayAdded > 0 ? '#ff4d4f' : '#3f8600' }}
              prefix={stats.overview.todayAdded > 0 ? <ArrowUpOutlined /> : null}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="本周认领" 
              value={stats.overview.weekClaimed} 
              suffix="个"
              valueStyle={{ color: stats.overview.weekClaimed > 0 ? '#52c41a' : '#999' }}
              prefix={stats.overview.weekClaimed > 0 ? <ArrowDownOutlined /> : null}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="平均停留时间" 
              value={stats.overview.avgStayDays} 
              suffix="天"
              valueStyle={{ color: '#faad14', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="来源分布">
            <CRMChart
              option={pieOption} 
              style={{ height: 350 }}
              opts={{ renderer: 'svg' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="流转趋势">
            <CRMChart
              option={lineOption} 
              style={{ height: 350 }}
              opts={{ renderer: 'svg' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
