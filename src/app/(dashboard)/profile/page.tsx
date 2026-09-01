'use client'

import { UserOutlined } from '@ant-design/icons'
import { Avatar, Card, Descriptions, Skeleton, Tag } from 'antd'
import { useSession } from 'next-auth/react'

import { PageShell } from '@/components/common/PageShell'

const ROLE_NAMES: Record<string, string> = {
  admin: '系统管理员',
  manager: '销售主管',
  sales_manager: '销售主管',
  sales: '销售人员',
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const user = session?.user

  return (
    <PageShell title="个人中心" maxWidth={760}>
      <Card title="账号信息">
        {status === 'loading' ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <div className="crm-profile-layout">
            <Avatar className="crm-profile-avatar" size={72} icon={<UserOutlined />} />
            <Descriptions column={{ xs: 1, sm: 1, md: 2 }}>
              <Descriptions.Item label="姓名">{user?.realName || '-'}</Descriptions.Item>
              <Descriptions.Item label="用户名">{user?.username || '-'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="角色">
                <span className="crm-profile-roles">
                  {(user?.roles || []).map((role) => (
                    <Tag key={role}>{ROLE_NAMES[role] || role}</Tag>
                  ))}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Card>
    </PageShell>
  )
}
