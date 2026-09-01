'use client'

import { Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'

import type { RoleOption, UserFormValues, UserItem } from './types'


interface UserFormModalProps {
  open: boolean
  submitting: boolean
  user: UserItem | null
  roles: RoleOption[]
  managers: UserItem[]
  canManageRoles: boolean
  onCancel: () => void
  onSubmit: (values: UserFormValues) => Promise<void>
}

export default function UserFormModal({
  open,
  submitting,
  user,
  roles,
  managers,
  canManageRoles,
  onCancel,
  onSubmit,
}: UserFormModalProps) {
  const [form] = Form.useForm<UserFormValues>()

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (!user) {
      form.setFieldsValue({ roleIds: [] })
      return
    }
    form.setFieldsValue({
      username: user.username,
      realName: user.realName,
      email: user.email,
      password: undefined,
      phone: user.phone || undefined,
      department: user.department || undefined,
      position: user.position || undefined,
      managerId: user.managerId,
      roleIds: user.roles.map(({ role }) => role.id),
      status: user.status,
    })
  }, [form, open, user])

  return (
    <Modal
      title={user ? '编辑用户' : '新增用户'}
      open={open}
      confirmLoading={submitting}
      destroyOnHidden
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => form.submit()}
      width={640}
    >
      <Form<UserFormValues> form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="username" label="用户名" rules={[{ min: 3 }, { max: 50 }]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="realName" label="姓名" rules={[{ max: 50 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="email" label="邮箱" rules={[{ type: 'email' }, { max: 100 }]}>
          <Input />
        </Form.Item>
        <Form.Item
          name="password"
          label={user ? '重置密码' : '初始密码'}
          rules={[{ min: 6 }, { max: 72 }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="phone" label="电话" rules={[{ max: 20 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="department" label="部门" rules={[{ max: 50 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="position" label="职位" rules={[{ max: 50 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="managerId" label="上级">
          <Select
            allowClear
            options={managers
              .filter((manager) => manager.id !== user?.id && manager.status === 'ACTIVE')
              .map((manager) => ({ value: manager.id, label: `${manager.realName}（${manager.username}）` }))}
          />
        </Form.Item>
        {canManageRoles ? (
          <Form.Item name="roleIds" label="角色">
            <Select
              mode="multiple"
              options={roles.map((role) => ({ value: role.id, label: role.displayName || role.name }))}
            />
          </Form.Item>
        ) : null}
        {user ? (
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 'ACTIVE', label: '启用' },
                { value: 'INACTIVE', label: '停用' },
                { value: 'LOCKED', label: '锁定' },
              ]}
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  )
}
