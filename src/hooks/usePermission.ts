'use client'

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { defineAbility } from '@/lib/casl'
import type { Actions, Subjects } from '@/lib/casl'

/**
 * 权限检查Hook
 * @returns ability对象和便捷的检查方法
 */
export function usePermission() {
  const { data: session } = useSession()
  
  const ability = useMemo(() => {
    if (!session?.user?.permissions) {
      return defineAbility([])
    }
    return defineAbility(session.user.permissions)
  }, [session])
  
  const can = (action: Actions, subject: Subjects) => {
    return ability.can(action, subject)
  }
  
  const cannot = (action: Actions, subject: Subjects) => {
    return ability.cannot(action, subject)
  }
  
  return {
    ability,
    can,
    cannot,
    user: session?.user,
    roles: session?.user?.roles || [],
    permissions: session?.user?.permissions || [],
  }
}
