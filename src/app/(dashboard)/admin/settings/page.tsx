'use client'

import { Card, Form, Input, Button, message } from 'antd'

export default function SettingsPage() {
  const [form] = Form.useForm()

  const handleSubmit = async (values: any) => {
    message.success('设置保存成功')
  }

  return (
    <div>
      <Card title="系统设置">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            systemName: 'CRM客户管理系统',
            companyName: '公司名称',
          }}
        >
          <Form.Item
            name="systemName"
            label="系统名称"
            rules={[{ required: true, message: '请输入系统名称' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="companyName" label="公司名称">
            <Input />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
