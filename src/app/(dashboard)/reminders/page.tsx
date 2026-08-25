'use client'

import { useEffect, useState } from 'react'
import {
  BellOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { Badge, Button, Card, Empty, Form, Spin, Tabs, message } from 'antd'
import dynamic from 'next/dynamic'

import { usePermission } from '@/hooks/usePermission'
import { apiRequest } from '@/lib/http/client'

import { DisableReminderModal } from './disable-reminder-modal'
import { DisabledReminderCard, ReminderCard } from './reminder-cards'
import type { DisabledCustomer, ReminderGroups, ReminderItem } from './types'

const FollowUpModal = dynamic(
  () => import('@/components/customers/follow-up-modal').then((module) => module.FollowUpModal),
  { ssr: false },
)

interface ReminderResponse {
  success: boolean
  data: ReminderGroups
}

interface DisabledResponse {
  success: boolean
  data: DisabledCustomer[]
}

function ReminderStats({ reminders }: { reminders: ReminderGroups }) {
  const stats = [
    { value: reminders.summary.totalOverdue, label: '未跟进客户', color: '#ff4d4f', background: '#fff1f0', border: '#ffccc7' },
    { value: reminders.summary.totalExpiring, label: '合同到期', color: '#faad14', background: '#fffbe6', border: '#ffe58f' },
    { value: reminders.summary.totalUpcomingVisits, label: '回访计划', color: '#1890ff', background: '#e6f7ff', border: '#91d5ff' },
    { value: reminders.summary.totalPlannedFollowUps, label: '计划跟进', color: '#52c41a', background: '#f6ffed', border: '#b7eb8f' },
  ]

  return (
    <div style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {stats.map((stat) => (
        <Card key={stat.label} size="small" style={{ background: stat.background, borderColor: stat.border }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: stat.color }}>{stat.value}</div>
            <div style={{ color: '#666', marginTop: 8 }}>{stat.label}</div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export default function RemindersPage() {
  const { can } = usePermission()
  const canCreateFollowUp = can('create', 'followUp')
  const canUpdateCustomer = can('update', 'customer')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [reminders, setReminders] = useState<ReminderGroups | null>(null)
  const [disabledList, setDisabledList] = useState<DisabledCustomer[]>([])
  const [disableModalVisible, setDisableModalVisible] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<ReminderItem | null>(null)
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false)
  const [disableSubmitting, setDisableSubmitting] = useState(false)
  const [enablingCustomerId, setEnablingCustomerId] = useState<string | null>(null)
  const [form] = Form.useForm()

  const fetchReminders = async () => {
    try {
      setLoading(true)
      const data = await apiRequest<ReminderResponse>('/api/reminders')
      setReminders(data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取提醒失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchDisabledList = async () => {
    try {
      const data = await apiRequest<DisabledResponse>('/api/reminders/disabled')
      setDisabledList(data.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取已禁用提醒失败')
    }
  }

  useEffect(() => {
    void fetchReminders()
    void fetchDisabledList()
  }, [])

  const openFollowUp = (item: ReminderItem) => {
    setSelectedCustomer(item)
    setFollowUpModalVisible(true)
  }

  const handleDisableReminder = (item: ReminderItem) => {
    setSelectedCustomer(item)
    form.resetFields()
    setDisableModalVisible(true)
  }

  const confirmDisableReminder = async () => {
    if (disableSubmitting) return
    try {
      const values = await form.validateFields()
      setDisableSubmitting(true)
      const data = await apiRequest<{ success: boolean }>('/api/reminders/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer?.customerId,
          reason: values.reason === 'OTHER' ? values.otherReason : values.reason,
        }),
      }, { requestKey: `reminder-disable:${selectedCustomer?.customerId || 'unknown'}` })
      if (!data.success) throw new Error('操作未完成')
      message.success('已设置为不再提醒')
      setDisableModalVisible(false)
      void fetchReminders()
      void fetchDisabledList()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败')
    } finally {
      setDisableSubmitting(false)
    }
  }

  const handleEnableReminder = async (customerId: string) => {
    if (enablingCustomerId) return
    setEnablingCustomerId(customerId)
    try {
      const data = await apiRequest<{ success: boolean }>('/api/reminders/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      }, { requestKey: `reminder-enable:${customerId}` })
      if (!data.success) throw new Error('操作未完成')
      message.success('已恢复提醒')
      void fetchReminders()
      void fetchDisabledList()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败')
    } finally {
      setEnablingCustomerId(null)
    }
  }

  const renderItems = (items: ReminderItem[], emptyText: string) => {
    if (items.length === 0) return <Empty description={emptyText} />
    return items.map((item) => (
      <ReminderCard
        key={`${item.type}-${item.customerId || item.followUpId}`}
        item={item}
        canCreateFollowUp={canCreateFollowUp}
        canUpdateCustomer={canUpdateCustomer}
        onFollowUp={openFollowUp}
        onDisable={handleDisableReminder}
      />
    ))
  }

  const allItems = reminders
    ? [...reminders.overdueFollowUp, ...reminders.expiringContracts, ...reminders.upcomingVisits, ...reminders.plannedFollowUps]
    : []

  const tabs = [
    {
      key: 'all',
      label: <><BellOutlined /> 全部提醒 <Badge count={reminders?.summary.totalReminders || 0} style={{ marginLeft: 8 }} /></>,
      children: reminders ? renderItems(allItems, '暂无提醒') : <Empty description="暂无提醒" />,
    },
    {
      key: 'overdue',
      label: <><ExclamationCircleOutlined /> 未跟进提醒 <Badge count={reminders?.summary.totalOverdue || 0} style={{ marginLeft: 8 }} /></>,
      children: reminders ? renderItems(reminders.overdueFollowUp, '暂无未跟进的客户') : <Empty description="暂无提醒" />,
    },
    {
      key: 'contract',
      label: <><FileTextOutlined /> 合同到期 <Badge count={reminders?.summary.totalExpiring || 0} style={{ marginLeft: 8 }} /></>,
      children: reminders ? renderItems(reminders.expiringContracts, '暂无即将到期的合同') : <Empty description="暂无提醒" />,
    },
    {
      key: 'visit',
      label: <><CalendarOutlined /> 回访计划 <Badge count={reminders?.summary.totalUpcomingVisits || 0} style={{ marginLeft: 8 }} /></>,
      children: reminders ? renderItems(reminders.upcomingVisits, '暂无回访计划') : <Empty description="暂无提醒" />,
    },
    {
      key: 'followup',
      label: <><ClockCircleOutlined /> 计划跟进 <Badge count={reminders?.summary.totalPlannedFollowUps || 0} style={{ marginLeft: 8 }} /></>,
      children: reminders ? renderItems(reminders.plannedFollowUps, '暂无计划跟进任务') : <Empty description="暂无提醒" />,
    },
    {
      key: 'disabled',
      label: <><CloseCircleOutlined /> 已禁用提醒 <Badge count={disabledList.length} style={{ marginLeft: 8 }} /></>,
      children: disabledList.length === 0
        ? <Empty description="暂无已禁用的提醒" />
        : disabledList.map((item) => <DisabledReminderCard key={item.customerId} item={item} loading={enablingCustomerId === item.customerId} disabled={enablingCustomerId !== null} onEnable={handleEnableReminder} />),
    },
  ]

  if (loading) return <div style={{ padding: 24, textAlign: 'center' }}><Spin size="large" tip="加载提醒中..." /></div>

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><BellOutlined style={{ fontSize: 24, color: '#1890ff' }} /><span>智能提醒中心</span>{(reminders?.summary.totalReminders ?? 0) > 0 && <Badge count={reminders?.summary.totalReminders ?? 0} style={{ backgroundColor: '#ff4d4f' }} />}</div>}
        extra={<Button onClick={() => { void fetchReminders(); void fetchDisabledList() }}>刷新</Button>}
      >
        {reminders && <ReminderStats reminders={reminders} />}
        <Tabs items={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </Card>
      <FollowUpModal
        open={followUpModalVisible}
        customerId={selectedCustomer?.customerId}
        customerName={selectedCustomer?.customerName}
        plannedFollowUpId={selectedCustomer?.followUpId}
        onClose={() => setFollowUpModalVisible(false)}
        onSaved={() => { setFollowUpModalVisible(false); void fetchReminders() }}
      />
      <DisableReminderModal
        open={disableModalVisible}
        selected={selectedCustomer}
        submitting={disableSubmitting}
        form={form}
        onCancel={() => { if (!disableSubmitting) setDisableModalVisible(false) }}
        onConfirm={confirmDisableReminder}
      />
    </div>
  )
}
