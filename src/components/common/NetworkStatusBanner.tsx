'use client'

import { Alert } from 'antd'
import { DisconnectOutlined, WifiOutlined } from '@ant-design/icons'

interface NetworkStatusBannerProps {
  online: boolean
  restored: boolean
}

export default function NetworkStatusBanner({ online, restored }: NetworkStatusBannerProps) {
  if (online && !restored) return null

  return (
    <Alert
      showIcon
      type={online ? 'success' : 'warning'}
      icon={online ? <WifiOutlined /> : <DisconnectOutlined />}
      message={online ? '网络已恢复' : '当前处于离线状态'}
      description={online ? '当前页面的只读数据已重新加载，未确认的写入不会自动重试。' : '只读数据暂时无法更新，请恢复网络后再提交业务操作。'}
      style={{ marginBottom: 16 }}
    />
  )
}
