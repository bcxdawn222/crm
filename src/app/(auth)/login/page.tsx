'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        username: values.username,
        password: values.password,
        redirect: false,
      })

      if (result?.error) {
        message.error('用户名或密码错误')
      } else {
        message.success('登录成功')
        router.push('/')
        router.refresh()
      }
    } catch (error) {
      message.error('登录失败,请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="crm-login-shell">
      <div className="crm-login-backdrop" aria-hidden="true" />
      <div className="crm-login-content">
        <section className="crm-login-intro" aria-label="CRM 系统介绍">
          <div className="crm-login-mark">CRM</div>
          <p className="crm-login-kicker">销售管理平台</p>
          <h1>把每一次客户联系，变成清晰的业务进展。</h1>
          <div className="crm-login-meta">
            <span>客户关系</span>
            <span>销售跟进</span>
            <span>经营数据</span>
          </div>
        </section>

        <Card
          title="CRM系统登录"
          className="crm-login-card"
          headStyle={{ textAlign: 'center', fontSize: 20 }}
        >
          <Form
            name="login"
            onFinish={handleSubmit}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名!' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码!' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
      <p className="crm-login-footer">客户信息、销售动作与团队目标，统一在一个工作台里推进</p>
    </main>
  )
}
