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

export interface UploadOptions {
  orgId?: string | null
  onProgress?: (fraction: number) => void
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

  async function authHeaders(orgId?: string | null): Promise<Record<string, string>> {
    const headers: Record<string, string> = {}
    const token = await options.getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const org = orgId ?? options.getOrgId?.() ?? null
    if (!org) throw new ApiError(0, 'no_org', t('errors.noOrg'))
    headers['X-Org-Id'] = org
    return headers
  }

  function errorFrom(status: number, text: string): ApiError {
    let data: unknown
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    const env = parseEnvelope(data)
    const fallback = status === 403 ? t('errors.forbidden') : t('errors.generic')
    const error = new ApiError(status, env?.code ?? `http_${status}`, env?.message || fallback, env?.details)
    if (status === 401) options.onUnauthorized?.(error)
    return error
  }

  /** GET a binary/text resource (e.g. a CSV) with auth headers, as a Blob. */
  async function blob(path: string, orgId?: string | null): Promise<Blob> {
    const headers = await authHeaders(orgId)
    const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
    let res: Response
    try {
      res = await doFetch(`${base}${path}`, { method: 'GET', headers })
    } catch {
      throw new ApiError(0, 'network_error', t('errors.network'))
    }
    if (!res.ok) throw errorFrom(res.status, await res.text())
    return res.blob()
  }

  /**
   * POST multipart form data. Uses XMLHttpRequest in the browser so upload progress can be
   * reported; falls back to fetch (no progress) when a fetch implementation is injected.
   */
  async function upload<T>(path: string, form: FormData, opts: UploadOptions = {}): Promise<T> {
    const headers = await authHeaders(opts.orgId)
    const url = `${base}${path}`
    if (options.fetchImpl || typeof XMLHttpRequest === 'undefined') {
      const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
      let res: Response
      try {
        res = await doFetch(url, { method: 'POST', headers, body: form, signal: opts.signal })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e
        throw new ApiError(0, 'network_error', t('errors.network'))
      }
      const text = await res.text()
      if (!res.ok) throw errorFrom(res.status, text)
      opts.onProgress?.(1)
      return (text ? JSON.parse(text) : undefined) as T
    }
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url)
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
      xhr.setRequestHeader('Accept', 'application/json')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total)
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          opts.onProgress?.(1)
          try {
            resolve(JSON.parse(xhr.responseText) as T)
          } catch {
            reject(new ApiError(xhr.status, 'bad_response', t('errors.generic')))
          }
        } else reject(errorFrom(xhr.status, xhr.responseText))
      }
      xhr.onerror = () => reject(new ApiError(0, 'network_error', t('errors.network')))
      xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'))
      opts.signal?.addEventListener('abort', () => xhr.abort())
      xhr.send(form)
    })
  }

  /** POST and return the raw Response so the caller can read a server-sent event stream. */
  async function stream(path: string, body: unknown, opts: { orgId?: string | null; signal?: AbortSignal } = {}): Promise<Response> {
    const headers = await authHeaders(opts.orgId)
    headers['Content-Type'] = 'application/json'
    headers.Accept = 'text/event-stream'
    const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
    let res: Response
    try {
      res = await doFetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: opts.signal })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw new ApiError(0, 'network_error', t('errors.network'))
    }
    if (!res.ok) throw errorFrom(res.status, await res.text())
    return res
  }

  return {
    request,
    blob,
    upload,
    stream,
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, { ...opts, body }),
    get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('POST', path, { ...opts, body }),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('PATCH', path, { ...opts, body }),
    delete: <T = void>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
  }
}
