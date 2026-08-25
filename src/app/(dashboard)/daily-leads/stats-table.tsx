'use client'

import { Button, Space, Statistic, Table, Tag } from 'antd'
import type { ColumnGroupType, ColumnsType, ColumnType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'

import { ResizableHeaderCell } from '@/components/common/ResizableHeaderCell'

import { type DailyLeadStat, sourceLabel } from './types'

interface StatsTableProps {
  data: DailyLeadStat[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number, pageSize: number) => void
  onView: (record: DailyLeadStat) => void
}

const initialWidths = { date: 120, count: 100, byLevel: 250, bySource: 250, action: 100 }

export function StatsTable(props: StatsTableProps) {
  const { data, loading, page, pageSize, total, onPageChange, onView } = props
  const [widths, setWidths] = useState<Record<string, number>>(initialWidths)
  const resize = (key: string) => (_event: unknown, { size }: { size: { width: number } }) => {
    setWidths((current) => ({ ...current, [key]: size.width }))
  }
  const header = (key: string) => (column: ColumnType<DailyLeadStat> | ColumnGroupType<DailyLeadStat>) => ({
    width: 'width' in column ? column.width : undefined,
    onResize: resize(key),
  })

  const columns: ColumnsType<DailyLeadStat> = [
    {
      title: '日期', dataIndex: 'date', key: 'date', width: widths.date, fixed: 'left',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD'), onHeaderCell: header('date'),
    },
    {
      title: '新增数量', dataIndex: 'count', key: 'count', width: widths.count,
      sorter: (left, right) => left.count - right.count,
      render: (count: number) => <Statistic value={count} valueStyle={{ fontSize: 16 }} />,
      onHeaderCell: header('count'),
    },
    {
      title: '客户等级分布', key: 'byLevel', width: widths.byLevel,
      render: (_, record) => (
        <Space wrap>
          {record.byLevel.POTENTIAL > 0 && <Tag color="default">潜在: {record.byLevel.POTENTIAL}</Tag>}
          {record.byLevel.NORMAL > 0 && <Tag color="blue">普通: {record.byLevel.NORMAL}</Tag>}
          {record.byLevel.IMPORTANT > 0 && <Tag color="orange">重要: {record.byLevel.IMPORTANT}</Tag>}
          {record.byLevel.VIP > 0 && <Tag color="red">VIP: {record.byLevel.VIP}</Tag>}
        </Space>
      ),
      onHeaderCell: header('byLevel'),
    },
    {
      title: '来源分布', key: 'bySource', width: widths.bySource,
      render: (_, record) => (
        <Space wrap>
          {Object.entries(record.bySource).map(([source, count]) => (
            <Tag key={source}>{sourceLabel(source)}: {count}</Tag>
          ))}
        </Space>
      ),
      onHeaderCell: header('bySource'),
    },
    {
      title: '操作', key: 'action', width: widths.action, fixed: 'right',
      render: (_, record) => <Button type="link" onClick={() => onView(record)}>查看详情 ({record.count}个客户)</Button>,
      onHeaderCell: header('action'),
    },
  ]

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="date"
      loading={loading}
      components={{ header: { cell: ResizableHeaderCell } }}
      pagination={{
        current: page, pageSize, total, showSizeChanger: true,
        showTotal: (count) => `共 ${count} 天`, onChange: onPageChange,
      }}
      scroll={{ x: 1200 }}
    />
  )
}
