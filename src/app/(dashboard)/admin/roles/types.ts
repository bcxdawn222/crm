export interface PermissionOption {
  id: string
  code: string
  name: string
  module: string
}

export interface RoleItem {
  id: string
  name: string
  displayName: string
  description: string | null
  permissions: string[]
  permissionIds: string[]
  userCount: number
  permissionCount: number
}

export interface RoleListResponse {
  success: true
  data: RoleItem[]
  availablePermissions?: PermissionOption[]
}

export interface RoleMutationResponse {
  success: true
  data: RoleItem
}

export interface RoleFormValues {
  displayName: string
  description?: string
  permissionIds: string[]
}
