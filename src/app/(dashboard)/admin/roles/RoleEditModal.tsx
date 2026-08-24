'use client'

import { Checkbox, Form, Input, Modal } from 'antd'
import { useEffect, useMemo } from 'react'

import type { PermissionOption, RoleFormValues, RoleItem } from './types'


interface RoleEditModalProps {
  open: boolean
  submitting: boolean
  role: RoleItem | null
  permissions: PermissionOption[]
  onCancel: () => void
  onSubmit: (values: RoleFormValues) => Promise<void>
}

export default function RoleEditModal({
  open,
  submitting,
  role,
  permissions,
  onCancel,
  onSubmit,
}: RoleEditModalProps) {
  const [form] = Form.useForm<RoleFormValues>()
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionOption[]>()
    permissions.forEach((permission) => {
      groups.set(permission.module, [...(groups.get(permission.module) || []), permission])
    })
    return Array.from(groups.entries())
  }, [permissions])

  useEffect(() => {
    if (!open || !role) return
    form.resetFields()
    form.setFieldsValue({
      displayName: role.displayName,
      description: role.description || undefined,
      permissionIds: role.name === 'admin' ? permissions.map(({ id }) => id) : role.permissionIds,
    })
  }, [form, open, permissions, role])

  return (
    <Modal
      title={role ? `编辑角色：${role.displayName}` : '编辑角色'}
      open={open}
      confirmLoading={submitting}
      destroyOnHidden
      width={760}
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form<RoleFormValues> form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="displayName" label="显示名称" rules={[{ required: true }, { max: 100 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="描述" rules={[{ max: 255 }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="permissionIds" label="权限" rules={[{ required: true, type: 'array', min: 1 }]}>
          <Checkbox.Group style={{ width: '100%' }} disabled={role?.name === 'admin'}>
            {groupedPermissions.map(([module, options]) => (
              <section key={module} style={{ marginBottom: 16 }}>
                <strong style={{ display: 'block', marginBottom: 8 }}>{module}</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                  {options.map((permission) => (
                    <Checkbox key={permission.id} value={permission.id}>{permission.name}</Checkbox>
                  ))}
                </div>
              </section>
            ))}
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Modal>
  )
}
