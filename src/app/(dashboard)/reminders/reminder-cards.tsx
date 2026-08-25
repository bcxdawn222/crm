'use client'

import { CalendarOutlined, ClockCircleOutlined, CloseCircleOutlined, FileTextOutlined, PhoneOutlined } from '@ant-design/icons'
import { Button, Card, Tag } from 'antd'

import type { DisabledCustomer, ReminderItem } from './types'

interface ReminderCardProps {
  item: ReminderItem
  canCreateFollowUp: boolean
  canUpdateCustomer: boolean
  onFollowUp: (item: ReminderItem) => void
  onDisable: (item: ReminderItem) => void
}

const priorityColors = { HIGH: 'red', MEDIUM: 'orange', LOW: 'blue' }
const priorityLabels = { HIGH: '紧急', MEDIUM: '重要', LOW: '普通' }

export function ReminderCard(props: ReminderCardProps) {
  const { item } = props
  const iconMap = {
    OVERDUE_FOLLOWUP: <PhoneOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
    EXPIRING_CONTRACT: <FileTextOutlined style={{ fontSize: 24, color: '#faad14' }} />,
    UPCOMING_VISIT: <CalendarOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
    PLANNED_FOLLOWUP: <ClockCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
  }
  const actionLabels = { OVERDUE_FOLLOWUP: '立即跟进', EXPIRING_CONTRACT: '联系续签', UPCOMING_VISIT: '查看计划', PLANNED_FOLLOWUP: '开始跟进' }
  return (
    <Card key={`${item.type}-${item.customerId || item.followUpId}`} size="small" style={{ marginBottom: 12 }} hoverable>
      <div className="crm-reminder-card-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flexShrink: 0 }}>{iconMap[item.type as keyof typeof iconMap]}</div>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div className="crm-reminder-card-title" style={{ marginBottom: 8 }}>
            <Tag color={priorityColors[item.priority]} style={{ marginRight: 8 }}>{priorityLabels[item.priority]}</Tag>
            <strong className="crm-reminder-card-name" style={{ fontSize: 16 }}>{item.customerName}</strong>
            {item.company && <span className="crm-reminder-card-company" style={{ marginLeft: 8, color: '#666' }}>({item.company})</span>}
          </div>
          <div style={{ marginBottom: 8, color: '#333' }}>{item.message}</div>
          {item.phone && <div style={{ marginBottom: 8, color: '#666', fontSize: 14 }}>{item.phone}</div>}
          {item.contractAmount !== null && item.contractAmount !== undefined && <div style={{ marginBottom: 8, color: '#666', fontSize: 14 }}>合同金额: ¥{Number(item.contractAmount).toLocaleString('zh-CN')}</div>}
          {item.content && <div style={{ marginBottom: 8, color: '#666', fontSize: 14 }}>📝 {item.content}</div>}
        </div>
        {(props.canCreateFollowUp || props.canUpdateCustomer) && (
          <div className="crm-reminder-card-actions" style={{ flexShrink: 0, display: 'flex', gap: 8 }}>
            {props.canCreateFollowUp && <Button type="primary" size="small" onClick={() => props.onFollowUp(item)}>{actionLabels[item.type as keyof typeof actionLabels]}</Button>}
            {props.canUpdateCustomer && <Button size="small" onClick={() => props.onDisable(item)}>不再提醒</Button>}
          </div>
        )}
      </div>
    </Card>
  )
}

export function DisabledReminderCard(props: { item: DisabledCustomer; loading: boolean; disabled: boolean; onEnable: (id: string) => void }) {
  const { item } = props
  return (
    <Card key={item.customerId} size="small" style={{ marginBottom: 12 }} hoverable>
      <div className="crm-reminder-card-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <CloseCircleOutlined style={{ fontSize: 24, color: '#999' }} />
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div className="crm-reminder-card-title" style={{ marginBottom: 8 }}><strong className="crm-reminder-card-name" style={{ fontSize: 16 }}>{item.customerName}</strong>{item.company && <span className="crm-reminder-card-company" style={{ marginLeft: 8, color: '#666' }}>({item.company})</span>}</div>
          {item.reminderDisabledReason && <div style={{ marginBottom: 8, color: '#666', fontSize: 14 }}>禁用原因: {item.reminderDisabledReason}</div>}
          {item.daysSinceDisabled !== null && <div style={{ marginBottom: 8, color: '#999', fontSize: 12 }}>已禁用 {item.daysSinceDisabled} 天</div>}
          {item.phone && <div style={{ marginBottom: 8, color: '#666', fontSize: 14 }}>📞 {item.phone}</div>}
        </div>
        <div className="crm-reminder-card-actions">
          <Button type="primary" size="small" loading={props.loading} disabled={props.disabled} onClick={() => props.onEnable(item.customerId)}>恢复提醒</Button>
        </div>
      </div>
    </Card>
  )
}
