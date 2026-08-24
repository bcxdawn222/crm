'use client'

import React from 'react'
import { Layout, Button, Avatar, Dropdown } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { signOut } from 'next-auth/react'
import { useUIStore } from '@/stores/uiStore'
import { clearAllDrafts } from '@/lib/forms/draft-storage'

const { Header } = Layout

interface HeaderProps {
  userName: string
}

export default function AppHeader({ userName }: HeaderProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

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
      style={{
        padding: 0,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0,21,41,.08)',
        position: 'fixed',
        top: 0,
        right: 0,
        left: sidebarCollapsed ? 80 : 200,
        zIndex: 100,
        height: 64,
      }}
    >
      <Button
        type="text"
        icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={toggleSidebar}
        style={{ fontSize: '16px', width: 64, height: 64 }}
      />
      
      <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer',
          padding: '0 16px',
        }}>
          <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
          <span>{userName}</span>
        </div>
      </Dropdown>
    </Header>
  )
}
