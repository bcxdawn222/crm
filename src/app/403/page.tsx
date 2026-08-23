import Link from 'next/link'
import { Button, Result } from 'antd'

export default function ForbiddenPage() {
  return (
    <Result
      status="403"
      title="403"
      subTitle="抱歉,您没有权限访问此页面"
      extra={
        <Button type="primary">
          <Link href="/">返回首页</Link>
        </Button>
      }
    />
  )
}
