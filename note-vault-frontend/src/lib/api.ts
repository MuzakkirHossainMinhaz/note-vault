import { toast } from 'sonner'
import { API_BASE_URL } from '@/lib/config'
import type { ApiError as ApiErrorShape, ApiErrorPayload, ApiErrorResponse } from '@/types'

const TOKEN_KEY = 'notevault-token'

export class ApiError extends Error implements ApiErrorShape {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  authenticated?: boolean
}

function isApiErrorResponse(payload: unknown): payload is ApiErrorResponse {
  return typeof payload === 'object' && payload !== null && 'error' in payload
}

function getErrorPayload(payload: unknown): ApiErrorPayload | undefined {
  if (!isApiErrorResponse(payload) || typeof payload.error !== 'object' || payload.error === null) {
    return undefined
  }
  return payload.error
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, authenticated = true, headers: requestHeaders, ...init } = options
  const controller = new AbortController()
  const requestId = `server-starting-${crypto.randomUUID()}`
  const slowTimer = window.setTimeout(
    () => toast.info('Server is starting, please wait...', { id: requestId }),
    3000,
  )
  const timeout = window.setTimeout(() => controller.abort(), 30000)
  const headers = new Headers(requestHeaders)
  const token = authenticated ? sessionStorage.getItem(TOKEN_KEY) : null

  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (body !== undefined) headers.set('Content-Type', 'application/json')

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    let payload: unknown
    if (response.status !== 204) {
      const text = await response.text()
      if (text) {
        try {
          payload = JSON.parse(text) as unknown
        } catch {
          if (response.ok) {
            throw new ApiError(response.status, 'The server returned an invalid JSON response.')
          }
          payload = { error: { message: text } }
        }
      }
    }

    if (!response.ok) {
      const apiError = getErrorPayload(payload)
      const message = apiError?.message ?? `Request failed (${response.status})`
      if (response.status === 401 && token) {
        window.dispatchEvent(new Event('notevault:unauthorized'))
      }
      throw new ApiError(response.status, message, apiError?.details)
    }

    if (response.status === 204) return undefined as T
    if (payload === undefined) {
      throw new ApiError(response.status, 'The server returned an empty response.')
    }
    return payload as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'The server did not respond within 30 seconds. Please try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    window.clearTimeout(slowTimer)
    toast.dismiss(requestId)
  }
}

export function notifyError(error: unknown): void {
  if (error instanceof ApiError && Array.isArray(error.details)) {
    const details = error.details
      .filter(
        (detail): detail is { path?: string; message: string } =>
          typeof detail === 'object' &&
          detail !== null &&
          'message' in detail &&
          typeof detail.message === 'string',
      )
      .map((detail) => `${detail.path ? `${detail.path}: ` : ''}${detail.message}`)
      .join('; ')
    toast.error(error.message, details ? { description: details } : undefined)
    return
  }

  toast.error(error instanceof Error ? error.message : 'Something went wrong.')
}
