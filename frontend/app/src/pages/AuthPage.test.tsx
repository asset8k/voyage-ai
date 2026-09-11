import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthProvider'
import { userFixture } from '../test/fixtures'
import { AuthPage } from './AuthPage'

function renderAuthPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/auth']}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<p>Returned to planner</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('AuthPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('logs in, persists the access token, and restores the user', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token-123', token_type: 'bearer' })))
      .mockResolvedValueOnce(new Response(JSON.stringify(userFixture)))
    vi.stubGlobal('fetch', fetchMock)

    renderAuthPage()
    await user.type(screen.getByLabelText('Username'), 'traveler_1')
    await user.type(screen.getByLabelText('Password'), 'securepassword123')
    await user.click(screen.getByRole('button', { name: 'Sign in to Voyage AI' }))

    await screen.findByText('Returned to planner')
    expect(localStorage.getItem('voyage-ai.access-token')).toBe('token-123')
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8000/api/auth/me',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-123' }) }),
    )
  })

  it('shows the backend error for an invalid login', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Incorrect username or password' }), { status: 401 })))

    renderAuthPage()
    await user.type(screen.getByLabelText('Username'), 'traveler_1')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in to Voyage AI' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password')
    expect(localStorage.getItem('voyage-ai.access-token')).toBeNull()
  })

  it('registers, then automatically starts a session', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(userFixture), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'new-token', token_type: 'bearer' })))
      .mockResolvedValueOnce(new Response(JSON.stringify(userFixture)))
    vi.stubGlobal('fetch', fetchMock)

    renderAuthPage()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await user.type(screen.getByLabelText('Username'), 'traveler_1')
    await user.type(screen.getByLabelText('Password'), 'securepassword123')
    await user.click(screen.getByRole('button', { name: 'Create my account' }))

    await screen.findByText('Returned to planner')
    expect(localStorage.getItem('voyage-ai.access-token')).toBe('new-token')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('shows a duplicate username error during registration', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Username already exists' }), { status: 409 })))

    renderAuthPage()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await user.type(screen.getByLabelText('Username'), 'traveler_1')
    await user.type(screen.getByLabelText('Password'), 'securepassword123')
    await user.click(screen.getByRole('button', { name: 'Create my account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Username already exists')
  })

  it('clears a stored invalid token during session restoration', async () => {
    localStorage.setItem('voyage-ai.access-token', 'expired-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Invalid or expired token' }), { status: 401 })))

    renderAuthPage()

    await waitFor(() => expect(localStorage.getItem('voyage-ai.access-token')).toBeNull())
  })
})
