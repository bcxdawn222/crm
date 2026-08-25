import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'

import { writeServerError } from '@/lib/logger'

export function getRequestId(request: Request): string {
  const incoming = request.headers.get('x-request-id')?.trim()
  return incoming && /^[A-Za-z0-9._:-]{1,100}$/.test(incoming) ? incoming : randomUUID()
}

export function jsonWithRequestId<T>(
  body: T,
  requestId: string,
  init?: ResponseInit
): NextResponse<T> {
  const response = NextResponse.json(body, init)
  response.headers.set('x-request-id', requestId)
  return response
}

export async function serverErrorResponse(
  error: unknown,
  context: string,
  requestId: string
): Promise<NextResponse<{ error: string; requestId: string }>> {
  await writeServerError(context, error, requestId)
  return jsonWithRequestId(
    { error: '服务器处理失败，请稍后重试', requestId },
    requestId,
    { status: 500 }
  )
}
