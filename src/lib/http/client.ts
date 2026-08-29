'use client'

import { notifySessionExpired } from './events'

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'OFFLINE'
  | 'CANCELLED'
  | 'SERVER_ERROR'

export interface ApiRequestOptions {
  timeoutMs?: number
  retryPolicy?: 'none' | 'get'
  requestKey?: string
  redirectOnUnauthorized?: boolean
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly requestId: string
  readonly payload: unknown

  constructor(message: string, code: ApiErrorCode, status: number, requestId: string, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
    this.payload = payload
  }
}

const inFlightRequests = new Map<string, Promise<unknown>>()
let redirectingToLogin = false

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function errorCode(status: number): ApiErrorCode {
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status >= 400 && status < 500) return 'VALIDATION_ERROR'
  return 'SERVER_ERROR'
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return response.json() as Promise<unknown>
  return response.text()
}

function requestMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || typeof payload.error !== 'string') return fallback
  return payload.error
}

function requestIdFrom(response: Response, payload: unknown): string {
  if (isRecord(payload) && typeof payload.requestId === 'string') return payload.requestId
  return response.headers.get('x-request-id') || createRequestId()
}

function redirectToLogin(): void {
  if (typeof window === 'undefined' || redirectingToLogin) return
  redirectingToLogin = true
  notifySessionExpired()
  const callbackUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.assign(`/login?reason=session-expired&callbackUrl=${encodeURIComponent(callbackUrl)}`)
}

async function executeRequest<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: Required<Pick<ApiRequestOptions, 'timeoutMs' | 'retryPolicy' | 'redirectOnUnauthorized'>>,
): Promise<T> {
  const method = (init.method || 'GET').toUpperCase()
  const canRetry = method === 'GET' && options.retryPolicy === 'get'
  const attempts = canRetry ? 2 : 1
  const headers = new Headers(init.headers)
  const requestId = headers.get('x-request-id') || createRequestId()
  headers.set('x-request-id', requestId)

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ApiError('当前处于离线状态，请检查网络连接', 'OFFLINE', 0, requestId)
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), options.timeoutMs)
    const externalSignal = init.signal
    const abortExternal = () => controller.abort()
    externalSignal?.addEventListener('abort', abortExternal, { once: true })
    try {
      const response = await fetch(input, {
        ...init,
        method,
        headers,
        signal: controller.signal,
        cache: init.cache ?? (method === 'GET' ? 'no-store' : undefined),
      })
      const payload = await readResponseBody(response)
      if (!response.ok) {
        const currentRequestId = requestIdFrom(response, payload)
        if (response.status === 401 && options.redirectOnUnauthorized) redirectToLogin()
        throw new ApiError(
          requestMessage(payload, `请求失败（${response.status}）`),
          errorCode(response.status),
          response.status,
          currentRequestId,
          payload,
        )
      }
      return payload as T
    } catch (error) {
      if (error instanceof ApiError) {
        if (canRetry && error.status >= 500 && attempt < attempts) continue
        throw error
      }
      if (externalSignal?.aborted) throw new ApiError('请求已取消', 'CANCELLED', 0, requestId)
      if (controller.signal.aborted) {
        if (attempt < attempts) continue
        throw new ApiError('请求超时，请稍后重试', 'TIMEOUT', 0, requestId)
      }
      if (attempt < attempts) continue
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      throw new ApiError(offline ? '网络连接已断开' : '网络请求失败，请稍后重试', offline ? 'OFFLINE' : 'SERVER_ERROR', 0, requestId)
    } finally {
      window.clearTimeout(timer)
      externalSignal?.removeEventListener('abort', abortExternal)
    }
  }
  throw new ApiError('请求未完成', 'SERVER_ERROR', 0, requestId)
}

export function apiRequest<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<T> {
  const method = (init.method || 'GET').toUpperCase()
  const resolved = {
    timeoutMs: options.timeoutMs ?? 15_000,
    retryPolicy: options.retryPolicy ?? (method === 'GET' ? 'get' : 'none'),
    redirectOnUnauthorized: options.redirectOnUnauthorized ?? true,
  } as const
  if (!options.requestKey) return executeRequest<T>(input, init, resolved)
  const pending = inFlightRequests.get(options.requestKey)
  if (pending) return pending as Promise<T>
  const request = executeRequest<T>(input, init, resolved).finally(() => {
    inFlightRequests.delete(options.requestKey as string)
  })
  inFlightRequests.set(options.requestKey, request)
  return request
}
