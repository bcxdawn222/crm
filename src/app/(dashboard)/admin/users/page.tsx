'use client'

import { EditOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons'
import { Button, message, Modal, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { usePermission } from '@/hooks/usePermission'
import { apiRequest } from '@/lib/http/client'
import { PageShell } from '@/components/common/PageShell'
import UserFormModal from './UserFormModal'
import type {
  RoleListResponse,
  RoleOption,
  UserFormValues,
  UserItem,
  UserListResponse,
  UserMutationResponse,
  UserStatus,
} from './types'


const statusLabels: Record<UserStatus, { text: string; color: string }> = {
  ACTIVE: { text: '启用', color: 'success' },
  INACTIVE: { text: '停用', color: 'default' },
  LOCKED: { text: '锁定', color: 'error' },
}

export default function UsersPage() {
  const { can, user: currentUser } = usePermission()
  const canManageRoles = can('update', 'role')
  const [users, setUsers] = useState<UserItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [userResult, roleResult] = await Promise.all([
        apiRequest<UserListResponse>(`/api/users?includeInactive=true&page=${page}&pageSize=${pageSize}`),
        canManageRoles
          ? apiRequest<RoleListResponse>('/api/roles')
          : Promise.resolve<RoleListResponse>({ success: true, data: [] }),
      ])
      setUsers(userResult.data)
      setTotal(userResult.pagination.total)
      setRoles(roleResult.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载用户失败')
    } finally {
      setLoading(false)
    }
  }, [canManageRoles, page, pageSize])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const saveUser = async (values: UserFormValues) => {
    setSubmitting(true)
    try {
      const endpoint = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PATCH' : 'POST'
      const { roleIds, ...userFields } = values
      const payload = canManageRoles ? { ...userFields, roleIds } : userFields
      await apiRequest<UserMutationResponse>(
        endpoint,
        { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
        { requestKey: `user-save:${editingUser?.id || 'new'}` },
      )
      message.success(editingUser ? '用户已更新' : '用户已创建')
      setModalOpen(false)
      await loadData()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存用户失败')
    } finally {
      setSubmitting(false)
    }
  }

  const disableUser = (user: UserItem) => {
    Modal.confirm({
      title: '停用用户',
      content: `确认停用“${user.realName}”吗？`,
      okText: '停用',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiRequest<UserMutationResponse>(
            `/api/users/${user.id}`,
            { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'INACTIVE' }) },
            { requestKey: `user-disable:${user.id}` },
          )
          message.success('用户已停用')
          await loadData()
        } catch (error) {
          message.error(error instanceof Error ? error.message : '停用用户失败')
          throw error
        }
      },
    })
  }

  const columns = useMemo<ColumnsType<UserItem>>(() => [
    { title: '用户名', dataIndex: 'username', width: 130 },
    { title: '姓名', dataIndex: 'realName', width: 120 },
    { title: '邮箱', dataIndex: 'email', width: 200 },
    { title: '部门', dataIndex: 'department', width: 120, render: (value: string | null) => value || '-' },
    { title: '职位', dataIndex: 'position', width: 120, render: (value: string | null) => value || '-' },
    { title: '上级', dataIndex: 'manager', width: 120, render: (manager: UserItem['manager']) => manager?.realName || '-' },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 200,
      render: (assigned: UserItem['roles']) => assigned.map(({ role }) => (
        <Tag key={role.id}>{role.displayName || role.name}</Tag>
      )),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: UserStatus) => <Tag color={statusLabels[status].color}>{statusLabels[status].text}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      fixed: 'right',
      render: (_, user) => (
        <Space size={4}>
          {can('update', 'user') ? (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
              setEditingUser(user)
              setModalOpen(true)
            }}>编辑</Button>
          ) : null}
          {can('delete', 'user') && user.status === 'ACTIVE' && user.id !== currentUser?.id ? (
            <Button danger type="link" size="small" icon={<StopOutlined />} onClick={() => disableUser(user)}>停用</Button>
          ) : null}
        </Space>
      ),
    },
  ], [can, currentUser?.id])

  return (
    <PageShell
      title="用户管理"
      actions={can('create', 'user') && canManageRoles ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditingUser(null)
            setModalOpen(true)
          }}>新增用户</Button>
        ) : null}
    >
      <Table
        columns={columns}
        dataSource={users}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1180 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (value) => `共 ${value} 条`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPageSize === pageSize ? nextPage : 1)
            setPageSize(nextPageSize)
          },
        }}
      />
      <UserFormModal
        open={modalOpen}
        submitting={submitting}
        user={editingUser}
        roles={roles}
        managers={users}
        canManageRoles={canManageRoles}
        onCancel={() => setModalOpen(false)}
        onSubmit={saveUser}
      />
    </PageShell>
  )
}
