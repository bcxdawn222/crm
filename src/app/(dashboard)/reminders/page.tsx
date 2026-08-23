'use client'

import { useState, useEffect } from 'react'
import { Card, Tabs, Tag, Badge, Button, Empty, Spin, message, Modal, Form, Radio, Input } from 'antd'
import { 
  BellOutlined, 
  PhoneOutlined, 
  CalendarOutlined, 
  FileTextOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'

interface ReminderItem {
  type: string
  customerId?: string
  customerName: string
  company?: string
  phone?: string
  message: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  daysSinceLastFollowUp?: number | null
  daysUntilExpiry?: number | null
  daysUntilVisit?: number | null
  daysUntilFollowUp?: number | null
  lastFollowUpAt?: string | null
  contractEndDate?: string | null
  nextVisitAt?: string | null
  nextFollowUpAt?: string | null
  contractAmount?: number | null
  visitFrequency?: string | null
  content?: string
  followUpId?: string
}

interface DisabledCustomer {
  customerId: string
  customerName: string
  company?: string
  phone?: string
  reminderDisabledReason?: string
  reminderDisabledAt?: string
  daysSinceDisabled?: number | null
}

interface Summary {
  totalOverdue: number
  totalExpiring: number
  totalUpcomingVisits: number
  totalPlannedFollowUps: number
  totalReminders: number
}

export default function RemindersPage() {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [reminders, setReminders] = useState<{
    overdueFollowUp: ReminderItem[]
    expiringContracts: ReminderItem[]
    upcomingVisits: ReminderItem[]
    plannedFollowUps: ReminderItem[]
    summary: Summary
  } | null>(null)
  const [disabledList, setDisabledList] = useState<DisabledCustomer[]>([])
  const [disableModalVisible, setDisableModalVisible] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<ReminderItem | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchReminders()
    fetchDisabledList()
  }, [])

  const fetchReminders = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/reminders')
      if (!res.ok) throw new Error('Failed to fetch reminders')
      const data = await res.json()
      if (data.success) {
        setReminders(data.data)
      } else {
        message.error(data.error || '获取提醒失败')
      }
    } catch (error) {
      console.error(error)
      message.error('获取提醒失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchDisabledList = async () => {
    try {
      const res = await fetch('/api/reminders/disabled')
      if (!res.ok) throw new Error('Failed to fetch disabled list')
      const data = await res.json()
      if (data.success) {
        setDisabledList(data.data)
      }
    } catch (error) {
      console.error(error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'red'
      case 'MEDIUM': return 'orange'
      case 'LOW': return 'blue'
      default: return 'default'
    }
  }

  const handleFollowUp = (customerId: string) => {
    window.location.href = `/customers?id=${customerId}`
  }

  const handleDisableReminder = (item: ReminderItem) => {
    setSelectedCustomer(item)
    form.resetFields()
    setDisableModalVisible(true)
  }

  const confirmDisableReminder = async () => {
    try {
      const values = await form.validateFields()
      const res = await fetch('/api/reminders/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer?.customerId,
          reason: values.reason === 'OTHER' ? values.otherReason : values.reason,
        }),
      })
      
      if (!res.ok) throw new Error('Failed to disable reminder')
      const data = await res.json()
      
      if (data.success) {
        message.success('已设置为不再提醒')
        setDisableModalVisible(false)
        fetchReminders()
        fetchDisabledList()
      } else {
        message.error(data.error || '操作失败')
      }
    } catch (error) {
      console.error(error)
      message.error('操作失败')
    }
  }

  const handleEnableReminder = async (customerId: string) => {
    try {
      const res = await fetch('/api/reminders/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      })
      
      if (!res.ok) throw new Error('Failed to enable reminder')
      const data = await res.json()
      
      if (data.success) {
        message.success('已恢复提醒')
        fetchReminders()
        fetchDisabledList()
      } else {
        message.error(data.error || '操作失败')
      }
    } catch (error) {
      console.error(error)
      message.error('操作失败')
    }
  }

  const renderReminderCard = (item: ReminderItem) => {
    const priorityTag = (
      <Tag color={getPriorityColor(item.priority)} style={{ marginRight: 8 }}>
        {item.priority === 'HIGH' ? '紧急' : item.priority === 'MEDIUM' ? '重要' : '普通'}
      </Tag>
    )

    let icon
    let actionButton
    
    switch (item.type) {
      case 'OVERDUE_FOLLOWUP':
        icon = <PhoneOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
        actionButton = (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleFollowUp(item.customerId!)}
            >
              立即跟进
            </Button>
            <Button 
              size="small"
              onClick={() => handleDisableReminder(item)}
            >
              不再提醒
            </Button>
          </div>
        )
        break
      case 'EXPIRING_CONTRACT':
        icon = <FileTextOutlined style={{ fontSize: 24, color: '#faad14' }} />
        actionButton = (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleFollowUp(item.customerId!)}
            >
              联系续签
            </Button>
            <Button 
              size="small"
              onClick={() => handleDisableReminder(item)}
            >
              不再提醒
            </Button>
          </div>
        )
        break
      case 'UPCOMING_VISIT':
        icon = <CalendarOutlined style={{ fontSize: 24, color: '#1890ff' }} />
        actionButton = (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleFollowUp(item.customerId!)}
            >
              查看计划
            </Button>
            <Button 
              size="small"
              onClick={() => handleDisableReminder(item)}
            >
              不再提醒
            </Button>
          </div>
        )
        break
      case 'PLANNED_FOLLOWUP':
        icon = <ClockCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
        actionButton = (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleFollowUp(item.customerId!)}
            >
              开始跟进
            </Button>
            <Button 
              size="small"
              onClick={() => handleDisableReminder(item)}
            >
              不再提醒
            </Button>
          </div>
        )
        break
    }

    return (
      <Card 
        key={`${item.type}-${item.customerId || item.followUpId}`}
        size="small"
        style={{ marginBottom: 12 }}
        hoverable
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flexShrink: 0 }}>{icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 8 }}>
              {priorityTag}
              <strong style={{ fontSize: 16 }}>{item.customerName}</strong>
              {item.company && <span style={{ marginLeft: 8, color: '#666' }}>({item.company})</span>}
            </div>
            
            <div style={{ marginBottom: 8, color: '#333' }}>
              {item.message}
            </div>

            {item.phone && (
              <div style={{ marginBottom: 8, color: '#666', fontSize: 14 }}>
                 {item.phone}
              </div>
            )}

            {item.contractAmount && (
              <div style={{ marginBottom: 8, color: '#666', fontSize: 14 }}>
                💰 合同金额: ¥{item.contractAmount.toLocaleString()}
              </div>
            )}

            {item.content && (
              <div style={{ marginBottom: 8, color: '#666', fontSize: 14 }}>
                📝 {item.content}
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0 }}>
            {actionButton}
          </div>
        </div>
      </Card>
    )
  }

  const renderDisabledCard = (item: DisabledCustomer) => {
    return (
      <Card 
        key={item.customerId}
        size="small"
        style={{ marginBottom: 12 }}
        hoverable
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flexShrink: 0 }}>
            <CloseCircleOutlined style={{ fontSize: 24, color: '#999' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 16 }}>{item.customerName}</strong>
              {item.company && <span style={{ marginLeft: 8, color: '#666' }}>({item.company})</span>}
            </div>
            
            {item.reminderDisabledReason && (
              <div style={{ marginBottom: 8, color: '#666', fontSize: 14 }}>
                禁用原因: {item.reminderDisabledReason}
              </div>
            )}

            {item.daysSinceDisabled !== null && (
              <div style={{ marginBottom: 8, color: '#999', fontSize: 12 }}>
                已禁用 {item.daysSinceDisabled} 天
              </div>
            )}

            {item.phone && (
              <div style={{ marginBottom: 8, color: '#666', fontSize: 14 }}>
                📞 {item.phone}
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0 }}>
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleEnableReminder(item.customerId)}
            >
              恢复提醒
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const tabs = [
    {
      key: 'all',
      label: (
        <span>
          <BellOutlined />
          全部提醒
          <Badge count={reminders?.summary.totalReminders || 0} style={{ marginLeft: 8 }} />
        </span>
      ),
      children: (
        <div>
          {reminders?.overdueFollowUp.map(renderReminderCard)}
          {reminders?.expiringContracts.map(renderReminderCard)}
          {reminders?.upcomingVisits.map(renderReminderCard)}
          {reminders?.plannedFollowUps.map(renderReminderCard)}
        </div>
      ),
    },
    {
      key: 'overdue',
      label: (
        <span>
          <ExclamationCircleOutlined />
          未跟进提醒
          <Badge count={reminders?.summary.totalOverdue || 0} style={{ marginLeft: 8 }} />
        </span>
      ),
      children: (
        <div>
          {reminders?.overdueFollowUp.length === 0 ? (
            <Empty description="暂无未跟进的客户" />
          ) : (
            reminders?.overdueFollowUp.map(renderReminderCard)
          )}
        </div>
      ),
    },
    {
      key: 'contract',
      label: (
        <span>
          <FileTextOutlined />
          合同到期
          <Badge count={reminders?.summary.totalExpiring || 0} style={{ marginLeft: 8 }} />
        </span>
      ),
      children: (
        <div>
          {reminders?.expiringContracts.length === 0 ? (
            <Empty description="暂无即将到期的合同" />
          ) : (
            reminders?.expiringContracts.map(renderReminderCard)
          )}
        </div>
      ),
    },
    {
      key: 'visit',
      label: (
        <span>
          <CalendarOutlined />
          回访计划
          <Badge count={reminders?.summary.totalUpcomingVisits || 0} style={{ marginLeft: 8 }} />
        </span>
      ),
      children: (
        <div>
          {reminders?.upcomingVisits.length === 0 ? (
            <Empty description="暂无回访计划" />
          ) : (
            reminders?.upcomingVisits.map(renderReminderCard)
          )}
        </div>
      ),
    },
    {
      key: 'followup',
      label: (
        <span>
          <ClockCircleOutlined />
          计划跟进
          <Badge count={reminders?.summary.totalPlannedFollowUps || 0} style={{ marginLeft: 8 }} />
        </span>
      ),
      children: (
        <div>
          {reminders?.plannedFollowUps.length === 0 ? (
            <Empty description="暂无计划跟进任务" />
          ) : (
            reminders?.plannedFollowUps.map(renderReminderCard)
          )}
        </div>
      ),
    },
    {
      key: 'disabled',
      label: (
        <span>
          <CloseCircleOutlined />
          已禁用提醒
          <Badge count={disabledList.length} style={{ marginLeft: 8 }} />
        </span>
      ),
      children: (
        <div>
          {disabledList.length === 0 ? (
            <Empty description="暂无已禁用的提醒" />
          ) : (
            disabledList.map(renderDisabledCard)
          )}
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" tip="加载提醒中..." />
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BellOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <span>智能提醒中心</span>
            {(reminders?.summary.totalReminders ?? 0) > 0 && (
              <Badge 
                count={reminders?.summary.totalReminders ?? 0} 
                style={{ backgroundColor: '#ff4d4f' }}
              />
            )}
          </div>
        }
        extra={
          <Button onClick={() => { fetchReminders(); fetchDisabledList(); }}>刷新</Button>
        }
      >
        {/* Statistics Overview */}
        {reminders && (
          <div style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <Card size="small" style={{ background: '#fff1f0', borderColor: '#ffccc7' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff4d4f' }}>
                  {reminders.summary.totalOverdue}
                </div>
                <div style={{ color: '#666', marginTop: 8 }}>未跟进客户</div>
              </div>
            </Card>
            <Card size="small" style={{ background: '#fffbe6', borderColor: '#ffe58f' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#faad14' }}>
                  {reminders.summary.totalExpiring}
                </div>
                <div style={{ color: '#666', marginTop: 8 }}>合同到期</div>
              </div>
            </Card>
            <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff' }}>
                  {reminders.summary.totalUpcomingVisits}
                </div>
                <div style={{ color: '#666', marginTop: 8 }}>回访计划</div>
              </div>
            </Card>
            <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#52c41a' }}>
                  {reminders.summary.totalPlannedFollowUps}
                </div>
                <div style={{ color: '#666', marginTop: 8 }}>计划跟进</div>
              </div>
            </Card>
          </div>
        )}

        {/* Reminder List */}
        <Tabs items={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </Card>

      {/* Disable Reminder Modal */}
      <Modal
        title="确认不再提醒"
        open={disableModalVisible}
        onCancel={() => setDisableModalVisible(false)}
        onOk={confirmDisableReminder}
        okText="确认禁用"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p><strong>客户:</strong> {selectedCustomer?.customerName}</p>
          {selectedCustomer?.company && <p><strong>公司:</strong> {selectedCustomer.company}</p>}
          <p><strong>提醒内容:</strong> {selectedCustomer?.message}</p>
        </div>
        
        <Form form={form} layout="vertical">
          <Form.Item 
            label="请选择禁用原因" 
            name="reason" 
            rules={[{ required: true, message: '请选择禁用原因' }]}
          >
            <Radio.Group>
              <Radio value="LOST">客户已流失</Radio>
              <Radio value="NO_INTEREST">客户无意向</Radio>
              <Radio value="TEMPORARY">暂时不需要跟进</Radio>
              <Radio value="OTHER">其他</Radio>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item 
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.reason !== currentValues.reason}
          >
            {({ getFieldValue }) =>
              getFieldValue('reason') === 'OTHER' ? (
                <Form.Item
                  name="otherReason"
                  rules={[{ required: true, message: '请输入禁用原因' }]}
                >
                  <Input placeholder="请输入具体原因" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
