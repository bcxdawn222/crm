'use client'

import React from 'react'
import { Drawer, Layout, Menu } from 'antd'
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
import { hasAnyPermission } from '@/lib/access/page-access'

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
        permissions: ['lead:view'],
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
    permissions: null,
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
    permissions: null,
    children: [
      {
        key: '/admin/users',
        label: <Link href="/admin/users">用户管理</Link>,
        permission: 'user:view',
      },
      {
        key: '/admin/roles',
        label: <Link href="/admin/roles">角色管理</Link>,
        permissions: ['role:view', 'role:manage'],
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
  mobileOpen: boolean
  onMobileClose: () => void
}

interface MenuItem {
  key: string
  icon?: React.ReactNode
  label: React.ReactNode
  permission?: string | null
  permissions?: readonly string[] | null
  children?: MenuItem[]
}

function selectedMenuKey(pathname: string, items: MenuItem[]): string {
  const childKeys = items.flatMap((item) => item.children || [])
  const routeKeys = [...items, ...childKeys]
    .map((item) => item.key)
    .filter((key) => key.startsWith('/'))
    .sort((left, right) => right.length - left.length)
  return routeKeys.find((key) => pathname === key || pathname.startsWith(`${key}/`)) || pathname
}

function openMenuKeys(pathname: string): string[] {
  if (pathname.startsWith('/admin')) return ['/admin']
  if (pathname.startsWith('/finance')) return ['/finance']
  if (pathname.startsWith('/customers') || ['/public-pool', '/daily-leads', '/telemarketing'].some((path) => pathname.startsWith(path))) {
    return ['/customer-management']
  }
  return []
}

export default function Sidebar({ collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const { permissions } = usePermission()

  const filterMenuByPermission = (items: MenuItem[]): MenuItem[] => {
    return items
      .map(item => {
        const requiredPermissions = item.permissions
          ?? (item.permission ? [item.permission] : [])
        if (requiredPermissions.length > 0 && !hasAnyPermission(permissions, requiredPermissions)) {
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
  const selectedKey = selectedMenuKey(pathname, visibleMenuItems)
  const defaultOpenKeys = openMenuKeys(pathname)

  const renderMenu = (mobile: boolean) => (
    <Menu
      className="crm-sidebar-menu"
      mode="inline"
      theme="dark"
      selectedKeys={[selectedKey]}
      defaultOpenKeys={defaultOpenKeys}
      items={visibleMenuItems as MenuProps['items']}
      onClick={mobile ? onMobileClose : undefined}
    />
  )

  return (
    <>
      <Sider
        className="crm-desktop-sidebar"
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        width={200}
        collapsedWidth={80}
      >
        {renderMenu(false)}
      </Sider>
      <Drawer
        rootClassName="crm-mobile-sidebar"
        placement="left"
        width="min(82vw, 280px)"
        open={mobileOpen}
        closable={false}
        onClose={onMobileClose}
        styles={{ body: { padding: 0, background: '#0f172a' } }}
      >
        <nav aria-label="主导航">{renderMenu(true)}</nav>
      </Drawer>
    </>
  )
}
