import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { hasPageAccess } from '@/lib/access/page-access'

// 公开路由(不需要认证)
const publicRoutes = ['/login', '/api/auth', '/api/health']
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/

function externalOrigin(request: NextRequest, protocol: string): string {
  const configuredUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL
  if (configuredUrl) {
    return new URL(configuredUrl).origin
  }
  return `${protocol}://${request.nextUrl.host}`
}

function errorResponse(message: string, requestId: string, status: number): NextResponse {
  const response = NextResponse.json({ error: message, requestId }, { status })
  response.headers.set('x-request-id', requestId)
  return response
}

function isCrossOriginWrite(request: NextRequest, expectedOrigin: string): boolean {
  if (!request.nextUrl.pathname.startsWith('/api/') || SAFE_METHODS.has(request.method)) return false
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin !== expectedOrigin
  } catch {
    return true
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const incomingRequestId = request.headers.get('x-request-id')?.trim()
  const requestId = incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)
    ? incomingRequestId
    : crypto.randomUUID()
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
    || request.nextUrl.protocol.replace(':', '')
  let expectedOrigin: string
  try {
    expectedOrigin = externalOrigin(request, forwardedProtocol)
  } catch {
    return errorResponse('服务认证地址配置无效', requestId, 500)
  }
  // 公开路由直接放行
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  if (isCrossOriginWrite(request, expectedOrigin)) {
    return errorResponse('请求来源校验失败', requestId, 403)
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: forwardedProtocol === 'https',
  })
  
  // 未登录用户重定向到登录页
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return errorResponse('登录状态已过期', requestId, 401)
    }
    const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const loginUrl = new URL('/login', expectedOrigin)
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
