import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '@/app/Sidebar'
import { ORG_ID, renderWithOrg } from '@/test/utils'
import { COLUMN_MAP, ENTITIES, REPORT, makeImport } from './fixtures'
import { ImportWizardPage } from './ImportWizardPage'
import { ImportsPage } from './ImportsPage'
import type { ImportRecord } from './types'

function Wizard() {
  return (
    <Routes>
      <Route path="/imports/new" element={<ImportWizardPage />} />
      <Route path="/imports" element={<p>history</p>} />
    </Routes>
  )
}

/** A tiny server: holds one import and advances background jobs after N polls. */
function fakeServer(initial: ImportRecord, opts: { failValidation?: string } = {}) {
  let rec = initial
  let polls = 0
  const calls: string[] = []
  const routes = {
    'GET /imports/entities': ENTITIES,
    'GET /imports': () => [],
    'POST /imports': (init?: RequestInit) => {
      calls.push('upload')
      const body = init?.body as FormData
      expect(body.get('entity_type')).toBe('sales')
      expect((body.get('file') as File).name).toBe('sales_q1_2025.csv')
      return new Response(JSON.stringify(rec), { status: 201 })
    },
    'GET /imports/imp-1': () => {
      calls.push(`poll:${rec.status}`)
      if (rec.status === 'validating' && ++polls >= 2) {
        rec = opts.failValidation
          ? { ...rec, status: 'failed', last_error: opts.failValidation }
          : { ...rec, status: 'validated', quality_report: REPORT, rows_total: REPORT.rows_total }
        polls = 0
      } else if (rec.status === 'importing' && ++polls >= 2) {
        rec = { ...rec, status: 'done', rows_imported: 4655, rows_rejected: 121, rows_duplicate: 36, rows_total: 4812 }
        polls = 0
      }
      return rec
    },
    'PUT /imports/imp-1/mapping': (init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      calls.push('mapping')
      expect(body.column_map.receipt_no).toBe('Receipt No')
      rec = { ...rec, status: 'mapped', column_map: body.column_map }
      return rec
    },
    'POST /imports/imp-1/validate': () => {
      calls.push('validate')
      rec = { ...rec, status: 'validating' }
      return new Response(JSON.stringify(rec), { status: 202 })
    },
    'POST /imports/imp-1/commit': (init?: RequestInit) => {
      calls.push(`commit:${JSON.parse(String(init?.body)).conflict_mode}`)
      rec = { ...rec, status: 'importing' }
      return new Response(JSON.stringify(rec), { status: 202 })
    },
  }
  return { routes, calls }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
})

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('import wizard', () => {
  it('runs upload, mapping, validation, review and commit through to done', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const server = fakeServer(makeImport())
    renderWithOrg(<Wizard />, { role: 'owner', routes: server.routes, path: '/imports/new' })

    // Step 1: type and file.
    await user.click(await screen.findByRole('radio', { name: /Sales/ }))
    const file = new File(['Receipt No,Branch\nR1,EOS-01\n'], 'sales_q1_2025.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText('Browse files'), file)
    await user.click(screen.getByRole('button', { name: 'Upload and continue' }))

    // Step 2: columns prefilled from the suggestion.
    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument()
    expect(screen.getByLabelText(/Receipt \/ invoice no\./)).toHaveValue('Receipt No')
    await user.click(screen.getByRole('button', { name: 'Check file' }))
    expect(await screen.findByText('Checking your file')).toBeInTheDocument()

    // Poll until validated.
    await advance(1600)
    await advance(1600)
    expect(await screen.findByText('Step 3 of 3')).toBeInTheDocument()
    expect(screen.getAllByText('Branch not set up').length).toBeGreaterThan(0)
    expect(screen.getByText('4,655')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Import 4,655 rows' }))
    expect(await screen.findByText('Importing your data')).toBeInTheDocument()
    await advance(1600)
    await advance(1600)
    expect(await screen.findByText('Import complete')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View import history' })).toHaveAttribute('href', '/imports')

    expect(server.calls.filter((c) => !c.startsWith('poll'))).toEqual(['upload', 'mapping', 'validate', 'commit:skip'])
  })

  it('blocks "Check file" until every required field is matched', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const partial: Record<string, string> = { ...COLUMN_MAP }
    delete partial.receipt_no
    const server = fakeServer(makeImport({ column_map: partial }))
    renderWithOrg(<Wizard />, { role: 'owner', routes: server.routes, path: '/imports/new?id=imp-1' })

    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Check file' }))
    expect(await screen.findByText(/Match every required field to continue: Receipt \/ invoice no\./)).toBeInTheDocument()
    expect(server.calls).not.toContain('mapping')
    expect(server.calls).not.toContain('validate')

    await user.selectOptions(screen.getByLabelText(/Receipt \/ invoice no\./), 'Receipt No')
    await user.click(screen.getByRole('button', { name: 'Check file' }))
    await waitFor(() => expect(server.calls).toContain('validate'))
  })

  it('shows last_error when validation fails, with a retry', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const server = fakeServer(makeImport({ status: 'validating' }), {
      failValidation: "Header row is beyond the end of the file",
    })
    renderWithOrg(<Wizard />, { role: 'owner', routes: server.routes, path: '/imports/new?id=imp-1' })

    expect(await screen.findByText('Checking your file')).toBeInTheDocument()
    await advance(1600)
    await advance(1600)
    expect(await screen.findByText('This import stopped')).toBeInTheDocument()
    expect(screen.getByText('Header row is beyond the end of the file')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Check again' }))
    await waitFor(() => expect(server.calls).toContain('validate'))
  })

  it('resumes on the review step from ?id when the import is validated', async () => {
    const server = fakeServer(makeImport({ status: 'validated', quality_report: REPORT }))
    renderWithOrg(<Wizard />, { role: 'owner', routes: server.routes, path: '/imports/new?id=imp-1' })
    expect(await screen.findByText('Step 3 of 3')).toBeInTheDocument()
    expect(screen.getByText('12 repeated in the file')).toBeInTheDocument()
    expect(screen.getByText('24 already in EOS')).toBeInTheDocument()
  })

  it('downloads the error CSV with auth and org headers', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const server = fakeServer(makeImport({ status: 'validated', quality_report: REPORT }))
    const createUrl = vi.fn(() => 'blob:errors')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { fetchImpl } = renderWithOrg(<Wizard />, {
      role: 'owner',
      routes: { ...server.routes, 'GET /imports/imp-1/errors.csv': () => new Response('Row,Column\n8,Branch\n', { status: 200 }) },
      path: '/imports/new?id=imp-1',
    })

    await user.click(await screen.findByRole('button', { name: 'Download error rows (CSV)' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    const call = fetchImpl.mock.calls.find(([u]) => String(u).endsWith('/imports/imp-1/errors.csv'))
    expect(call).toBeDefined()
    const headers = (call![1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-token')
    expect(headers['X-Org-Id']).toBe(ORG_ID)
    expect(createUrl).toHaveBeenCalled()
    click.mockRestore()
  })
})

describe('imports access', () => {
  it('hides Data imports from viewers and shows it to managers', () => {
    const { unmount } = renderWithOrg(<Sidebar />, { role: 'viewer' })
    expect(screen.queryByRole('link', { name: /Data imports/ })).not.toBeInTheDocument()
    unmount()
    renderWithOrg(<Sidebar />, { role: 'manager' })
    expect(screen.getByRole('link', { name: /Data imports/ })).toHaveAttribute('href', '/imports')
  })

  it('tells viewers they cannot import and makes no API calls', () => {
    const { fetchImpl } = renderWithOrg(<ImportsPage />, { role: 'viewer' })
    expect(screen.getByText('Only owners and managers can import data.')).toBeInTheDocument()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('shows history with status pills and hides owner-only types from managers', async () => {
    renderWithOrg(<ImportsPage />, {
      role: 'manager',
      routes: {
        'GET /imports/entities': ENTITIES,
        'GET /imports': [
          { id: 'a', entity_type: 'sales', file_name: 'sales_q1_2025.csv', status: 'done', rows_total: 4812, rows_imported: 4655, rows_rejected: 121, rows_duplicate: 36, created_at: '2026-10-30T09:10:00Z', finished_at: '2026-10-30T09:12:00Z' },
        ],
      },
    })
    const table = await screen.findByRole('table', { name: 'Import history' })
    expect(within(table).getByText('sales_q1_2025.csv')).toBeInTheDocument()
    expect(within(table).getByText('Imported')).toBeInTheDocument()
    expect(await screen.findByText('Recommended order')).toBeInTheDocument()
    expect(screen.queryByText('Stores, outlets or locations.')).not.toBeInTheDocument()
  })
})
