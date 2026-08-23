'use client'

import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, Card, List, message, Space, Tag } from 'antd'
import { BellOutlined, DeleteOutlined, MailOutlined } from '@ant-design/icons'

import { usePermission } from '@/hooks/usePermission'


interface MessageItem {
  id: string
  title: string | null
  content: string
  type: 'TEXT' | 'SYSTEM' | 'NOTIFICATION'
  isRead: boolean
  createdAt: string
  sender: { realName: string }
}

interface MessageResponse {
  success: boolean
  data: { list: MessageItem[]; total: number; unread: number }
  error?: string
}

export default function MessagesPage() {
  const { can } = usePermission()
  const [items, setItems] = useState<MessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState(0)

  const loadMessages = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/messages?page=1&pageSize=50')
      const result = (await response.json()) as MessageResponse
      if (!response.ok) throw new Error(result.error || '加载消息失败')
      setItems(result.data.list)
      setUnread(result.data.unread)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载消息失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  const markRead = async (item: MessageItem) => {
    if (item.isRead) return
    const response = await fetch(`/api/messages/${item.id}`, { method: 'PATCH' })
    if (!response.ok) {
      message.error('标记已读失败')
      return
    }
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry))
    setUnread((current) => Math.max(0, current - 1))
  }

  const markAllRead = async () => {
    const response = await fetch('/api/messages/read-all', { method: 'POST' })
    if (!response.ok) {
      message.error('全部标记已读失败')
      return
    }
    setItems((current) => current.map((entry) => ({ ...entry, isRead: true })))
    setUnread(0)
    message.success('已全部标记为已读')
  }

  const deleteMessage = async (id: string) => {
    const response = await fetch(`/api/messages/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      message.error('删除消息失败')
      return
    }
    setItems((current) => current.filter((entry) => entry.id !== id))
    message.success('消息已删除')
  }

  return (
    <Card
      title={<Space>消息中心{unread > 0 && <Tag color="red">{unread} 条未读</Tag>}</Space>}
      extra={<Button icon={<MailOutlined />} disabled={unread === 0} onClick={() => void markAllRead()}>全部已读</Button>}
    >
      <List
        loading={loading}
        itemLayout="horizontal"
        dataSource={items}
        locale={{ emptyText: '暂无消息' }}
        renderItem={(item) => (
          <List.Item
            onClick={() => void markRead(item)}
            actions={can('delete', 'message') ? [
              <Button key="delete" type="text" danger icon={<DeleteOutlined />} onClick={(event) => {
                event.stopPropagation()
                void deleteMessage(item.id)
              }}>删除</Button>,
            ] : []}
          >
            <List.Item.Meta
              avatar={<Avatar icon={item.type === 'SYSTEM' ? <BellOutlined /> : <MailOutlined />} />}
              title={<Space>{item.title || '消息'}{!item.isRead && <Tag color="blue">未读</Tag>}</Space>}
              description={<><div>{item.content}</div><small>{item.sender.realName} · {new Date(item.createdAt).toLocaleString()}</small></>}
            />
          </List.Item>
        )}
      />
    </Card>
  )
}
