'use client'

import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, Card, List, message, Pagination, Space, Tag } from 'antd'
import { BellOutlined, DeleteOutlined, MailOutlined } from '@ant-design/icons'

import { usePermission } from '@/hooks/usePermission'
import { apiRequest } from '@/lib/http/client'


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
  data: { list: MessageItem[]; total: number; unread: number; page: number; pageSize: number }
  error?: string
}

export default function MessagesPage() {
  const { can } = usePermission()
  const [items, setItems] = useState<MessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState(0)
  const [markingAll, setMarkingAll] = useState(false)
  const [pendingMessageIds, setPendingMessageIds] = useState<ReadonlySet<string>>(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const setMessagePending = (id: string, pending: boolean) => {
    setPendingMessageIds((current) => {
      const next = new Set(current)
      if (pending) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const loadMessages = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
      const result = await apiRequest<MessageResponse>(`/api/messages?${params}`)
      setItems(result.data.list)
      setUnread(result.data.unread)
      setTotal(result.data.total)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载消息失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  const markRead = async (item: MessageItem) => {
    if (item.isRead || pendingMessageIds.has(item.id)) return
    setMessagePending(item.id, true)
    try {
      await apiRequest<{ success: boolean }>(`/api/messages/${item.id}`, { method: 'PATCH' }, { requestKey: `message-read:${item.id}` })
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry))
      setUnread((current) => Math.max(0, current - 1))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '标记消息失败')
    } finally {
      setMessagePending(item.id, false)
    }
  }

  const markAllRead = async () => {
    if (markingAll) return
    setMarkingAll(true)
    try {
      await apiRequest<{ success: boolean }>('/api/messages/read-all', { method: 'POST' }, { requestKey: 'message-read-all' })
      setItems((current) => current.map((entry) => ({ ...entry, isRead: true })))
      setUnread(0)
      message.success('已全部标记为已读')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '标记全部已读失败')
    } finally {
      setMarkingAll(false)
    }
  }

  const deleteMessage = async (id: string) => {
    if (pendingMessageIds.has(id)) return
    setMessagePending(id, true)
    try {
      await apiRequest<{ success: boolean }>(`/api/messages/${id}`, { method: 'DELETE' }, { requestKey: `message-delete:${id}` })
      const deleted = items.find((entry) => entry.id === id)
      setItems((current) => current.filter((entry) => entry.id !== id))
      setTotal((current) => Math.max(0, current - 1))
      if (deleted && !deleted.isRead) setUnread((current) => Math.max(0, current - 1))
      if (items.length === 1 && page > 1) setPage((current) => current - 1)
      message.success('消息已删除')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除消息失败')
    } finally {
      setMessagePending(id, false)
    }
  }

  return (
    <Card
      title={<Space>消息中心{unread > 0 && <Tag color="red">{unread} 条未读</Tag>}</Space>}
      extra={(
        <Button
          icon={<MailOutlined />}
          disabled={unread === 0}
          loading={markingAll}
          onClick={() => void markAllRead()}
        >全部已读</Button>
      )}
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
              <Button
                key="delete"
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={pendingMessageIds.has(item.id)}
                onClick={(event) => {
                event.stopPropagation()
                void deleteMessage(item.id)
                }}
              >删除</Button>,
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
      {total > 0 && (
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showTotal={(count) => `共 ${count} 条`}
          onChange={(nextPage, nextPageSize) => {
            if (nextPageSize !== pageSize) {
              setPageSize(nextPageSize)
              setPage(1)
              return
            }
            setPage(nextPage)
          }}
          style={{ marginTop: 16, textAlign: 'right' }}
        />
      )}
    </Card>
  )
}
