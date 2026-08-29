'use client'

import { Alert, Button } from 'antd'

interface DashboardSectionStatusProps {
  error: string | null
  updatedAt: string | null
  hasData: boolean
  onRetry: () => void
}

export function DashboardSectionStatus(props: DashboardSectionStatusProps) {
  if (!props.error) return null
  const updatedText = props.updatedAt
    ? new Date(props.updatedAt).toLocaleString('zh-CN')
    : null

  return (
    <Alert
      type={props.hasData ? 'warning' : 'error'}
      showIcon
      style={{ marginBottom: 12 }}
      message={props.hasData ? '数据可能已过期' : '数据加载失败'}
      description={props.hasData && updatedText
        ? `上次更新时间：${updatedText}。${props.error}`
        : props.error}
      action={<Button size="small" onClick={props.onRetry}>重新加载</Button>}
    />
  )
}
