import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { hasPageAccess } from '@/lib/access/page-access'

// 公开路由(不需要认证)
const publicRoutes = ['/login', '/api/auth', '/api/health']

function externalOrigin(request: NextRequest, protocol: string): string {
  const configuredUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL
  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin
    } catch {
      // 配置错误时继续使用代理请求头，避免中间件直接中断。
    }
  }
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim()
    || request.headers.get('host')
    || request.nextUrl.host
  return `${protocol}://${host}`
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
    const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const loginUrl = new URL('/login', externalOrigin(request, forwardedProtocol))
    loginUrl.searchParams.set('callbackUrl', callbackUrl)
    return NextResponse.redirect(loginUrl)
  }
  
  const userPermissions = Array.isArray(token.permissions)
    ? token.permissions.filter((permission): permission is string => typeof permission === 'string')
    : []
  if (!hasPageAccess(pathname, userPermissions)) {
    const forbiddenUrl = request.nextUrl.clone()
    forbiddenUrl.pathname = '/403'
    forbiddenUrl.search = ''
    return NextResponse.redirect(forbiddenUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
