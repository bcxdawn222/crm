'use client'

import { Button, Form, Input, message, Spin } from 'antd'
import { useCallback, useEffect, useState } from 'react'

import { usePermission } from '@/hooks/usePermission'
import { apiRequest } from '@/lib/http/client'
import { PageShell } from '@/components/common/PageShell'
import type { SettingsFormValues, SettingsResponse } from './types'


export default function SettingsPage() {
  const { can } = usePermission()
  const canEdit = can('update', 'setting')
  const [form] = Form.useForm<SettingsFormValues>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiRequest<SettingsResponse>('/api/settings')
      form.setFieldsValue(result.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载系统设置失败')
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const saveSettings = async (values: SettingsFormValues) => {
    setSaving(true)
    try {
      const result = await apiRequest<SettingsResponse>(
        '/api/settings',
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) },
        { requestKey: 'settings-save' },
      )
      form.setFieldsValue(result.data)
      message.success('设置保存成功')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存系统设置失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell title="系统设置" maxWidth={720}>
      <Spin spinning={loading}>
        <Form<SettingsFormValues>
          form={form}
          layout="vertical"
          disabled={!canEdit}
          onFinish={saveSettings}
        >
          <Form.Item
            name="systemName"
            label="系统名称"
            rules={[
              { max: 100, message: '系统名称不能超过 100 个字符' },
            ]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item
            name="companyName"
            label="公司名称"
            rules={[{ max: 200, message: '公司名称不能超过 200 个字符' }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          {canEdit ? (
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>保存设置</Button>
            </Form.Item>
          ) : null}
        </Form>
      </Spin>
    </PageShell>
  )
}
