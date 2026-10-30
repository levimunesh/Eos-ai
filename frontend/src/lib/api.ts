import { t } from './strings'

export interface ApiErrorEnvelope {
  error: { code: string; message: string; details?: unknown }
}

/** Every failed API call becomes one of these; `message` is safe to show to users. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details ?? null
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

/** The text to show a user for any thrown value. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.status === 403 && !e.message ? t('errors.forbidden') : e.message
  return t('errors.generic')
}

export interface RequestOptions {
  body?: unknown
  /** Send X-Org-Id (default true). */
  orgScoped?: boolean
  /** Explicit org id; falls back to `getOrgId()`. */
  orgId?: string | null
  signal?: AbortSignal
}

export interface ApiClientOptions {
  baseUrl: string
  getAccessToken: () => Promise<string | null> | string | null
  getOrgId?: () => string | null
  onUnauthorized?: (error: ApiError) => void
  fetchImpl?: typeof fetch
}

export type ApiClient = ReturnType<typeof createApiClient>

function parseEnvelope(data: unknown): ApiErrorEnvelope['error'] | null {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error: unknown }).error
    if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
      return err as ApiErrorEnvelope['error']
    }
  }
  return null
}

export function createApiClient(options: ApiClientOptions) {
  const base = options.baseUrl.replace(/\/+$/, '')

  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

    const token = await options.getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`

    if (opts.orgScoped !== false) {
      const orgId = opts.orgId ?? options.getOrgId?.() ?? null
      if (!orgId) throw new ApiError(0, 'no_org', t('errors.noOrg'))
      headers['X-Org-Id'] = orgId
    }

    const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
    let res: Response
    try {
      res = await doFetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: opts.signal,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw new ApiError(0, 'network_error', t('errors.network'))
    }

    if (res.status === 204) return undefined as T

    const text = await res.text()
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = null
      }
    }

    if (!res.ok) {
      const env = parseEnvelope(data)
      const fallback = res.status === 403 ? t('errors.forbidden') : t('errors.generic')
      const error = new ApiError(
        res.status,
        env?.code ?? `http_${res.status}`,
        env?.message || fallback,
        env?.details,
      )
      if (res.status === 401) options.onUnauthorized?.(error)
      throw error
    }
    return data as T
  }

  return {
    request,
    get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('POST', path, { ...opts, body }),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('PATCH', path, { ...opts, body }),
    delete: <T = void>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
  }
}
