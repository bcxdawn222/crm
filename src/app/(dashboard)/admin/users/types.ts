export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED'

export interface UserRole {
  role: {
    id: string
    name: string
    displayName: string
  }
}

export interface UserManager {
  id: string
  realName: string
}

export interface UserItem {
  id: string
  username: string
  realName: string
  email: string
  phone: string | null
  department: string | null
  position: string | null
  status: UserStatus
  managerId: string | null
  manager: UserManager | null
  roles: UserRole[]
}

export interface RoleOption {
  id: string
  name: string
  displayName: string
}

export interface UserFormValues {
  username: string
  realName: string
  email: string
  password?: string
  phone?: string
  department?: string
  position?: string
  managerId?: string | null
  roleIds?: string[]
  status?: UserStatus
}

export interface UserListResponse {
  success: true
  data: UserItem[]
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export interface RoleListResponse {
  success: true
  data: Array<RoleOption & { permissions: string[]; userCount: number; permissionCount: number }>
}

export interface UserMutationResponse {
  success: true
  data: UserItem
}
