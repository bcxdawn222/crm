'use client'

import { Card, Table, Statistic, Row, Col } from 'antd'
import type { CallbackDataParams } from 'echarts/types/dist/shared'
import CRMChart from '@/components/charts/CRMChart'

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

export default function FunnelAnalysis({ data }: { data: FunnelData }) {
  // 漏斗图配置
  const funnelOption = {
    title: { 
      text: '销售漏斗', 
      left: 'center',
      textStyle: { fontSize: 16 }
    },
    tooltip: { 
      trigger: 'item',
      formatter: (params: CallbackDataParams) => {
        const stage = data.stages[params.dataIndex]
        return `
          <div style="padding: 8px;">
            <strong>${stage.name}</strong><br/>
            数量: ${stage.count}个<br/>
            转化率: ${stage.conversionRate}%<br/>
            平均停留: ${stage.avgDaysInStage}天
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
      max: Math.max(...data.stages.map(s => s.count)),
      minSize: '0%',
      maxSize: '100%',
      sort: 'descending',
      gap: 2,
      label: {
        show: true,
        position: 'inside',
        formatter: '{b}\n{c}个',
        fontSize: 14,
        color: '#fff'
      },
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 1
      },
      emphasis: {
        label: {
          fontSize: 16
        }
      },
      data: data.stages.map((s, index) => ({
        value: s.count,
        name: s.name,
        itemStyle: {
          color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'][index % 5]
        }
      }))
    }]
  }

  // 表格列定义
  const columns = [
    {
      title: '阶段',
      dataIndex: 'name',
      key: 'name',
      width: 120
    },
    {
      title: '客户数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      sorter: (a: FunnelStage, b: FunnelStage) => a.count - b.count
    },
    {
      title: '转化率',
      dataIndex: 'conversionRate',
      key: 'conversionRate',
      width: 120,
      render: (rate: number) => `${rate}%`,
      sorter: (a: FunnelStage, b: FunnelStage) => a.conversionRate - b.conversionRate
    },
    {
      title: '平均停留天数',
      dataIndex: 'avgDaysInStage',
      key: 'avgDaysInStage',
      width: 140,
      render: (days: number) => `${days}天`,
      sorter: (a: FunnelStage, b: FunnelStage) => a.avgDaysInStage - b.avgDaysInStage
    }
  ]

  return (
    <div>
      {/* 核心指标 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic 
              title="整体转化率" 
              value={data.overallConversionRate}
              suffix="%"
              precision={2}
              valueStyle={{ color: data.overallConversionRate > 20 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic 
              title="平均销售周期" 
              value={data.avgSalesCycle}
              suffix="天"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 漏斗图和表格 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card>
            <CRMChart
              option={funnelOption} 
              style={{ height: 400 }}
              opts={{ renderer: 'svg' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="各阶段详情">
            <Table
              dataSource={data.stages}
              columns={columns}
              rowKey="stage"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
