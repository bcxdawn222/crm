'use client'

import React from 'react'
import { Layout, Button, Avatar, Dropdown } from 'antd'
import { MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { signOut, useSession } from 'next-auth/react'
import { useUIStore } from '@/stores/uiStore'
import { clearAllDrafts } from '@/lib/forms/draft-storage'

const { Header } = Layout

export default function AppHeader() {
  const { data: session } = useSession()
  const { sidebarCollapsed, toggleSidebar, openMobileSidebar } = useUIStore()
  const displayName = session?.user.realName || session?.user.username || '用户'

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        clearAllDrafts()
        void signOut({ callbackUrl: '/login' })
      },
    },
  ]

  return (
    <Header
      className={`crm-app-header${sidebarCollapsed ? ' crm-app-header--collapsed' : ''}`}
    >
      <Button
        className="crm-header-menu-button crm-header-menu-button--desktop"
        type="text"
        icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
        title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
      />
      <Button
        className="crm-header-menu-button crm-header-menu-button--mobile"
        type="text"
        icon={<MenuOutlined />}
        onClick={openMobileSidebar}
        aria-label="打开导航菜单"
        title="打开导航菜单"
      />

      <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
        <Button type="text" className="crm-account-trigger" aria-label={`${displayName}，打开账号菜单`}>
          <Avatar icon={<UserOutlined />} />
          <span className="crm-account-name">{displayName}</span>
        </Button>
      </Dropdown>
    </Header>
  )
}
