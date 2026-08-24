'use client'

import { EditOutlined } from '@ant-design/icons'
import { Button, message, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { usePermission } from '@/hooks/usePermission'
import { apiRequest } from '@/lib/http/client'
import RoleEditModal from './RoleEditModal'
import type {
  PermissionOption,
  RoleFormValues,
  RoleItem,
  RoleListResponse,
  RoleMutationResponse,
} from './types'


export default function RolesPage() {
  const { can } = usePermission()
  const canEdit = can('update', 'role')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [permissions, setPermissions] = useState<PermissionOption[]>([])
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)

  const loadRoles = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiRequest<RoleListResponse>(`/api/roles${canEdit ? '?includePermissions=true' : ''}`)
      setRoles(result.data)
      setPermissions(result.availablePermissions || [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载角色失败')
    } finally {
      setLoading(false)
    }
  }, [canEdit])

  useEffect(() => {
    void loadRoles()
  }, [loadRoles])

  const saveRole = async (values: RoleFormValues) => {
    if (!editingRole) return
    setSubmitting(true)
    try {
      await apiRequest<RoleMutationResponse>(
        `/api/roles/${editingRole.id}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) },
        { requestKey: `role-save:${editingRole.id}` },
      )
      message.success('角色已更新')
      setEditingRole(null)
      await loadRoles()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存角色失败')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = useMemo<ColumnsType<RoleItem>>(() => [
    { title: '角色标识', dataIndex: 'name', width: 150 },
    { title: '显示名称', dataIndex: 'displayName', width: 150 },
    { title: '描述', dataIndex: 'description', render: (value: string | null) => value || '-' },
    { title: '用户数', dataIndex: 'userCount', width: 90, render: (count: number) => <Tag color="blue">{count}</Tag> },
    { title: '权限数', dataIndex: 'permissionCount', width: 90, render: (count: number) => <Tag color="green">{count}</Tag> },
    {
      title: '权限',
      dataIndex: 'permissions',
      width: 360,
      render: (assigned: string[]) => (
        <Space size={[0, 4]} wrap>{assigned.map((permission) => <Tag key={permission}>{permission}</Tag>)}</Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, role) => canEdit ? (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setEditingRole(role)}>编辑</Button>
      ) : null,
    },
  ], [canEdit])

  return (
    <section>
      <h1 style={{ margin: '0 0 16px', fontSize: 22 }}>角色管理</h1>
      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1120 }}
        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
      />
      <RoleEditModal
        open={Boolean(editingRole)}
        submitting={submitting}
        role={editingRole}
        permissions={permissions}
        onCancel={() => setEditingRole(null)}
        onSubmit={saveRole}
      />
    </section>
  )
}
