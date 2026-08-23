'use client'

import React from 'react'
import { Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeOutlined,
  TeamOutlined,
  DollarOutlined,
  FileTextOutlined,
  MessageOutlined,
  CheckSquareOutlined,
  FolderOutlined,
  SettingOutlined,
  BellOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { usePermission } from '@/hooks/usePermission'

const { Sider } = Layout

const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: <Link href="/">仪表盘</Link>,
    permission: null,
  },
  {
    key: '/reminders',
    icon: <BellOutlined />,
    label: <Link href="/reminders">智能提醒</Link>,
    permission: 'customer:view',
  },
  {
    key: '/statistics',
    icon: <BarChartOutlined />,
    label: <Link href="/statistics">数据统计</Link>,
    permission: 'report:view',
  },
  {
    key: '/customer-management',
    icon: <TeamOutlined />,
    label: '客户管理',
    permission: 'customer:view',
    children: [
      {
        key: '/customers',
        label: <Link href="/customers">我的客户</Link>,
        permission: 'customer:view',
      },
      {
        key: '/public-pool',
        label: <Link href="/public-pool">公海池</Link>,
        permission: 'customer:view',
      },
      {
        key: '/daily-leads',
        label: <Link href="/daily-leads">每日新增客资</Link>,
        permission: 'customer:view',
      },
      {
        key: '/telemarketing',
        label: <Link href="/telemarketing">电销名单</Link>,
        permission: 'customer:create',
      },
      {
        key: '/customers/cooperating',
        label: <Link href="/customers/cooperating">已合作客户</Link>,
        permission: 'customer:view',
      },
    ],
  },
  {
    key: '/finance',
    icon: <DollarOutlined />,
    label: '财务管理',
    permission: 'order:view',
    children: [
      {
        key: '/finance/orders',
        label: <Link href="/finance/orders">订单管理</Link>,
        permission: 'order:view',
      },
      {
        key: '/finance/payments',
        label: <Link href="/finance/payments">收款管理</Link>,
        permission: 'payment:view',
      },
      {
        key: '/finance/reports',
        label: <Link href="/finance/reports">财务报表</Link>,
        permission: 'report:view',
      },
    ],
  },
  {
    key: '/daily-reports',
    icon: <FileTextOutlined />,
    label: <Link href="/daily-reports">日报管理</Link>,
    permission: 'report:daily:view',
  },
  {
    key: '/messages',
    icon: <MessageOutlined />,
    label: <Link href="/messages">消息中心</Link>,
    permission: 'message:view',
  },
  {
    key: '/tasks',
    icon: <CheckSquareOutlined />,
    label: <Link href="/tasks">任务管理</Link>,
    permission: 'task:view',
  },
  {
    key: '/files',
    icon: <FolderOutlined />,
    label: <Link href="/files">文件共享</Link>,
    permission: 'file:view',
  },
  {
    key: '/admin',
    icon: <SettingOutlined />,
    label: '系统管理',
    permission: 'user:view',
    children: [
      {
        key: '/admin/users',
        label: <Link href="/admin/users">用户管理</Link>,
        permission: 'user:view',
      },
      {
        key: '/admin/roles',
        label: <Link href="/admin/roles">角色管理</Link>,
        permission: 'role:manage',
      },
      {
        key: '/admin/settings',
        label: <Link href="/admin/settings">系统设置</Link>,
        permission: 'setting:view',
      },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
}

interface MenuItem {
  key: string
  icon?: React.ReactNode
  label: React.ReactNode
  permission: string | null
  children?: MenuItem[]
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname()
  const { permissions } = usePermission()

  const filterMenuByPermission = (items: MenuItem[]): MenuItem[] => {
    return items
      .map(item => {
        if (item.permission && !permissions.includes(item.permission)) {
          return null
        }
        
        if (item.children) {
          const filteredChildren = filterMenuByPermission(item.children)
          if (filteredChildren.length === 0) {
            return null
          }
          return { ...item, children: filteredChildren }
        }
        
        return item
      })
      .filter((item): item is MenuItem => item !== null)
  }

  const visibleMenuItems = filterMenuByPermission(menuItems)

  return (
    <Sider 
      trigger={null} 
      collapsible 
      collapsed={collapsed}
      theme="dark"
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
      }}
    >
      <div style={{ 
        height: 64, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'white',
        fontSize: collapsed ? 16 : 20,
        fontWeight: 'bold',
      }}>
        {collapsed ? 'CRM' : 'CRM系统'}
      </div>
      <Menu
        mode="inline"
        theme="dark"
        selectedKeys={[pathname]}
        items={visibleMenuItems as MenuProps['items']}
      />
    </Sider>
  )
}
