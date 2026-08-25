'use client'

import { Card, List, Tag, Badge, Button, Empty } from 'antd'
import { BellOutlined, PhoneOutlined, FileTextOutlined, CalendarOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/http/client'

interface ReminderItem {
  type: string
  customerId?: string
  customerName: string
  company?: string
  message: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export default function SmartReminders() {
  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReminders()
  }, [])

  const loadReminders = async () => {
    try {
      setLoading(true)
      const result = await apiRequest<{
        success: true
        data: {
          overdueFollowUp: ReminderItem[]
          expiringContracts: ReminderItem[]
          upcomingVisits: ReminderItem[]
        }
      }>('/api/reminders')
      const allReminders: ReminderItem[] = [
        ...result.data.overdueFollowUp.map((reminder) => ({ ...reminder, type: 'OVERDUE' })),
        ...result.data.expiringContracts.map((reminder) => ({ ...reminder, type: 'CONTRACT' })),
        ...result.data.upcomingVisits.map((reminder) => ({ ...reminder, type: 'VISIT' })),
      ]
      allReminders.sort((a, b) => {
        const priorityOrder: Record<ReminderItem['priority'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
      setReminders(allReminders.slice(0, 5))
    } catch (error) {
      console.error('Failed to load reminders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'OVERDUE':
        return <PhoneOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
      case 'CONTRACT':
        return <FileTextOutlined style={{ color: '#faad14', fontSize: 20 }} />
      case 'VISIT':
        return <CalendarOutlined style={{ color: '#1890ff', fontSize: 20 }} />
      default:
        return <BellOutlined style={{ color: '#666', fontSize: 20 }} />
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

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'HIGH': return '紧急'
      case 'MEDIUM': return '重要'
      case 'LOW': return '普通'
      default: return priority
    }
  }

  return (
    <Card
      loading={loading}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BellOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 'bold' }}>智能提醒</span>
          {reminders.length > 0 && (
            <Badge 
              count={reminders.length} 
              style={{ backgroundColor: '#ff4d4f', marginLeft: 8 }}
            />
          )}
        </div>
      }
      extra={
        <Link href="/reminders">
          <Button type="link" size="small">查看全部 →</Button>
        </Link>
      }
      style={{
        minHeight: 263,
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}
    >
      {!loading && reminders.length > 0 ? (
        <List
          dataSource={reminders}
          renderItem={(item) => (
            <List.Item
              style={{
                padding: '12px 0',
                borderBottom: '1px solid #f0f0f0',
                transition: 'background 0.3s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f5f5f5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <List.Item.Meta
                avatar={
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: item.priority === 'HIGH' ? 'rgba(255, 77, 79, 0.1)' : 'rgba(250, 173, 20, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {getIcon(item.type)}
                  </div>
                }
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color={getPriorityColor(item.priority)} style={{ margin: 0 }}>
                      {getPriorityText(item.priority)}
                    </Tag>
                    <span style={{ fontWeight: 500 }}>{item.customerName}</span>
                    {item.company && (
                      <span style={{ color: '#999', fontSize: 12 }}>({item.company})</span>
                    )}
                  </div>
                }
                description={
                  <div style={{ marginTop: 4, color: '#666' }}>
                    {item.message}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        !loading && (
          <Empty 
            description="暂无提醒" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )
      )}
    </Card>
  )
}
