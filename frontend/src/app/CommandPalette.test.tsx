import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { renderWithOrg } from '@/test/utils'
import { CommandPalette } from './CommandPalette'

function Harness({ onAsk }: { onAsk?: (q: string) => void }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  return (
    <>
      <p data-testid="location">{location.pathname + location.search}</p>
      <Routes>
        <Route path="*" element={null} />
      </Routes>
      <CommandPalette open={open} onOpenChange={setOpen} onAsk={onAsk} />
    </>
  )
}

describe('command palette', () => {
  it('opens with Ctrl+K and navigates to the chosen page', async () => {
    const user = userEvent.setup()
    renderWithOrg(<Harness />, { role: 'owner' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('combobox', { name: 'Ask a question or jump to a page…' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.type(input, 'branches')
    expect(screen.getByRole('option', { name: /Branches/ })).toBeInTheDocument()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('location')).toHaveTextContent('/settings/branches')
  })

  it('offers owner actions and org switching, and runs an action with a click', async () => {
    const user = userEvent.setup()
    renderWithOrg(<Harness />, { role: 'owner' })
    await user.keyboard('{Control>}k{/Control}')
    expect(await screen.findByRole('option', { name: 'Invite a member' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Eos Demo Retail' })).toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: 'Add a branch' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/settings/branches?new=1')
  })

  it('hides owner-only actions and Members from a viewer', async () => {
    const user = userEvent.setup()
    renderWithOrg(<Harness />, { role: 'viewer' })
    await user.keyboard('{Control>}k{/Control}')
    await screen.findByRole('combobox', { name: 'Ask a question or jump to a page…' })
    expect(screen.queryByRole('option', { name: 'Invite a member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Members' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Toggle light and dark theme' })).toBeInTheDocument()
  })

  it('routes free text to "Ask EOS" as the first row and hands the question over', async () => {
    const user = userEvent.setup()
    const onAsk = vi.fn()
    renderWithOrg(<Harness onAsk={onAsk} />, { role: 'owner' })
    await user.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('combobox', { name: 'Ask a question or jump to a page…' })

    // A page name still leads with the page; the ask row follows it.
    await user.type(input, 'branches')
    let options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options[0]).toHaveTextContent('Branches')
    expect(options.at(-1)).toHaveTextContent('Ask EOS: branches')

    // A question (words, or a question mark) leads with the ask row.
    await user.clear(input)
    await user.type(input, 'why did sales drop at EOS-02?')
    options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options[0]).toHaveTextContent('Ask EOS: why did sales drop at EOS-02?')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Enter}')
    expect(onAsk).toHaveBeenCalledWith('why did sales drop at EOS-02?')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
