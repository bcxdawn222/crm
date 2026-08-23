'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, message, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'


interface UserRole {
  role: { name: string; displayName: string }
}

interface UserItem {
  id: string
  username: string
  realName: string
  email: string | null
  phone: string | null
  department: string | null
  position: string | null
  roles: UserRole[]
}

interface UserResponse {
  success: boolean
  data: UserItem[]
  error?: string
}

const columns: ColumnsType<UserItem> = [
  { title: '用户名', dataIndex: 'username', width: 130 },
  { title: '姓名', dataIndex: 'realName', width: 130 },
  { title: '邮箱', dataIndex: 'email' },
  { title: '电话', dataIndex: 'phone', width: 140 },
  { title: '部门', dataIndex: 'department', width: 130 },
  { title: '职位', dataIndex: 'position', width: 130 },
  {
    title: '角色',
    dataIndex: 'roles',
    width: 180,
    render: (roles: UserRole[]) => roles.map(({ role }) => <Tag key={role.name}>{role.displayName || role.name}</Tag>),
  },
]

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users')
      const result = (await response.json()) as UserResponse
      if (!response.ok) throw new Error(result.error || '加载用户失败')
      setUsers(result.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载用户失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  return (
    <Card title="用户管理">
      <Table
        columns={columns}
        dataSource={users}
        loading={loading}
        rowKey="id"
        scroll={{ x: 920 }}
        pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }}
      />
    </Card>
  )
}
