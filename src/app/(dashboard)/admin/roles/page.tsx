'use client'

import { Card, Table, Button, Space, Tag, message } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useState, useEffect } from 'react'

interface Role {
  id: string
  name: string
  displayName: string
  description?: string
  permissions: string[]
  userCount: number
  permissionCount: number
}

export default function RolesPage() {
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])

  // Fetch roles from API
  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/roles')
      const json = await res.json()
      if (json.success) {
        setRoles(json.data)
      } else {
        message.error(json.error || 'Failed to load roles')
      }
    } catch (error) {
      console.error('Fetch roles failed:', error)
      message.error('Network error')
    } finally {
      setLoading(false)
    }
  }
  const columns: ColumnsType<Role> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 150,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 80,
      render: (count) => <Tag color="blue">{count}</Tag>,
    },
    {
      title: '权限数',
      dataIndex: 'permissionCount',
      key: 'permissionCount',
      width: 80,
      render: (count) => <Tag color="green">{count}</Tag>,
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: string[]) =>
        permissions.map((permission) => <Tag key={permission}>{permission}</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: () => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />}>
            编辑
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card title="角色管理">
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  )
}
