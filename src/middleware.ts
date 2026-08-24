import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// 公开路由(不需要认证)
const publicRoutes = ['/login', '/api/auth', '/api/health']

// 路由权限映射
const routePermissions: Record<string, string[]> = {
  '/admin': ['user:view', 'role:manage', 'setting:view'],
  '/customers': ['customer:view'],
  '/finance/orders': ['order:view'],
  '/finance/payments': ['payment:view'],
  '/finance/reports': ['report:view'],
  '/daily-reports': ['report:daily:view'],
  '/tasks': ['task:view'],
  '/files': ['file:view'],
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // 公开路由直接放行
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }
  
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
    || request.nextUrl.protocol.replace(':', '')
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: forwardedProtocol === 'https',
  })
  
  // 未登录用户重定向到登录页
  if (!token) {
    if (pathname.startsWith('/api/')) {
      const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
      const response = NextResponse.json(
        { error: '登录状态已过期', requestId },
        { status: 401 },
      )
      response.headers.set('x-request-id', requestId)
      return response
    }
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim()
      || request.headers.get('host')
      || request.nextUrl.host
    const externalOrigin = `${forwardedProtocol}://${forwardedHost}`
    const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const loginUrl = new URL('/login', externalOrigin)
    loginUrl.searchParams.set('callbackUrl', callbackUrl)
    return NextResponse.redirect(loginUrl)
  }
  
  // 检查路由权限
  for (const [route, requiredPermissions] of Object.entries(routePermissions)) {
    if (pathname.startsWith(route)) {
      const userPermissions = (token.permissions as string[]) || []
      
      // 检查是否有任一所需权限
      const hasPermission = requiredPermissions.some(permission =>
        userPermissions.includes(permission)
      )
      
      if (!hasPermission) {
        return NextResponse.redirect(new URL('/403', request.url))
      }
      
      break
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
