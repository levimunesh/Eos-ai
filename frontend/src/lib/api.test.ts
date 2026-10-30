import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient } from './api'

function setup(response: Response, orgId: string | null = 'org-123') {
  const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response)
  const onUnauthorized = vi.fn()
  const api = createApiClient({
    baseUrl: 'http://api.test/api/v1/',
    getAccessToken: async () => 'jwt-abc',
    getOrgId: () => orgId,
    onUnauthorized,
    fetchImpl,
  })
  return { api, fetchImpl, onUnauthorized }
}

function headersOf(fetchImpl: ReturnType<typeof vi.fn>) {
  const init = fetchImpl.mock.calls[0][1] as RequestInit
  return init.headers as Record<string, string>
}

describe('api client', () => {
  it('attaches the bearer token and X-Org-Id on org-scoped calls', async () => {
    const { api, fetchImpl } = setup(new Response(JSON.stringify([{ id: 'b1' }]), { status: 200 }))
    const data = await api.get<{ id: string }[]>('/branches')

    expect(data).toEqual([{ id: 'b1' }])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0][0])).toBe('http://api.test/api/v1/branches')
    const headers = headersOf(fetchImpl)
    expect(headers.Authorization).toBe('Bearer jwt-abc')
    expect(headers['X-Org-Id']).toBe('org-123')
  })

  it('omits X-Org-Id when the call is not org-scoped', async () => {
    const { api, fetchImpl } = setup(new Response(JSON.stringify({ id: 'u' }), { status: 200 }))
    await api.get('/me', { orgScoped: false })
    const headers = headersOf(fetchImpl)
    expect(headers.Authorization).toBe('Bearer jwt-abc')
    expect(headers).not.toHaveProperty('X-Org-Id')
  })

  it('sends JSON bodies', async () => {
    const { api, fetchImpl } = setup(new Response(JSON.stringify({ id: 'b' }), { status: 201 }))
    await api.post('/branches', { code: 'EOS-01', name: 'Central' })
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ code: 'EOS-01', name: 'Central' }))
    expect(headersOf(fetchImpl)['Content-Type']).toBe('application/json')
  })

  it('turns the error envelope into a typed ApiError', async () => {
    const envelope = {
      error: { code: 'duplicate_code', message: "Branch code 'EOS-01' already exists", details: null },
    }
    const { api } = setup(new Response(JSON.stringify(envelope), { status: 409 }))
    const err = await api.post('/branches', { code: 'EOS-01', name: 'x' }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    const apiErr = err as ApiError
    expect(apiErr.status).toBe(409)
    expect(apiErr.code).toBe('duplicate_code')
    expect(apiErr.message).toBe("Branch code 'EOS-01' already exists")
  })

  it('calls onUnauthorized on 401', async () => {
    const envelope = { error: { code: 'token_expired', message: 'Token expired', details: null } }
    const { api, onUnauthorized } = setup(new Response(JSON.stringify(envelope), { status: 401 }))
    await expect(api.get('/org')).rejects.toMatchObject({ code: 'token_expired', status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('returns undefined for 204', async () => {
    const { api } = setup(new Response(null, { status: 204 }))
    await expect(api.delete('/members/m1')).resolves.toBeUndefined()
  })

  it('refuses an org-scoped call with no org selected', async () => {
    const { api, fetchImpl } = setup(new Response('{}'), null)
    await expect(api.get('/org')).rejects.toMatchObject({ code: 'no_org' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('maps network failures to a readable ApiError', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const api = createApiClient({ baseUrl: 'http://x', getAccessToken: () => null, fetchImpl })
    await expect(api.get('/me', { orgScoped: false })).rejects.toMatchObject({ code: 'network_error', status: 0 })
  })
})
