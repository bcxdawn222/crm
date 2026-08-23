'use client'

import { Card, List, Avatar, Tag, Button, Space } from 'antd'
import { MailOutlined, BellOutlined } from '@ant-design/icons'

const mockMessages = [
  {
    id: '1',
    title: '系统通知',
    content: '欢迎使用CRM系统!',
    type: 'SYSTEM',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: '任务提醒',
    content: '您有一个新任务需要处理',
    type: 'TASK',
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
]

export default function MessagesPage() {
  return (
    <div>
      <Card
        title="消息中心"
        extra={
          <Space>
            <Button icon={<MailOutlined />}>标记全部已读</Button>
          </Space>
        }
      >
        <List
          itemLayout="horizontal"
          dataSource={mockMessages}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button type="link">查看</Button>,
                <Button type="link">删除</Button>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={item.type === 'SYSTEM' ? <BellOutlined /> : <MailOutlined />}
                    style={{ backgroundColor: item.isRead ? '#d9d9d9' : '#1890ff' }}
                  />
                }
                title={
                  <Space>
                    {item.title}
                    {!item.isRead && <Tag color="red">未读</Tag>}
                  </Space>
                }
                description={
                  <div>
                    <p>{item.content}</p>
                    <small style={{ color: '#999' }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </small>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
