import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthProvider'
import { savedTripFixture, userFixture } from '../test/fixtures'
import { SavedTripDetailPage } from './SavedTripDetailPage'

function renderSavedTrip() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/my-trips/10']}>
        <Routes>
          <Route path="/my-trips/:tripId" element={<SavedTripDetailPage />} />
          <Route path="/my-trips" element={<p>My trips page</p>} />
          <Route path="/auth" element={<p>Authentication page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function authenticatedTripApi(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/me')) return Promise.resolve(new Response(JSON.stringify(userFixture)))
    if (url.endsWith('/api/trips/10') && (!init?.method || init.method === 'GET')) return Promise.resolve(new Response(JSON.stringify(savedTripFixture)))
    return Promise.resolve(new Response(JSON.stringify(savedTripFixture)))
  })
}

describe('SavedTripDetailPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('updates the saved title and visibility through the owner endpoint', async () => {
    localStorage.setItem('voyage-ai.access-token', 'token-123')
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    authenticatedTripApi(fetchMock)
    vi.stubGlobal('fetch', fetchMock)

    renderSavedTrip()
    const title = await screen.findByLabelText('Trip title')
    await user.clear(title)
    await user.type(title, 'Tokyo after dark')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8000/api/trips/10',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
        body: JSON.stringify({ title: 'Tokyo after dark', is_public: true }),
      }),
    )
  })

  it('sends only the refinement instruction to the AI refinement endpoint', async () => {
    localStorage.setItem('voyage-ai.access-token', 'token-123')
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    authenticatedTripApi(fetchMock)
    vi.stubGlobal('fetch', fetchMock)

    renderSavedTrip()
    await screen.findByText('Tokyo food notes')
    await user.type(screen.getByLabelText('What should change?'), 'Add a calmer evening on day one.')
    await user.click(screen.getByRole('button', { name: 'Refine with AI' }))

    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8000/api/trips/10/refine',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ instruction: 'Add a calmer evening on day one.' }),
      }),
    )
  })

  it('deletes only after confirmation and returns to the trip library', async () => {
    localStorage.setItem('voyage-ai.access-token', 'token-123')
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    authenticatedTripApi(fetchMock)
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))

    renderSavedTrip()
    await screen.findByText('Tokyo food notes')
    await user.click(screen.getByRole('button', { name: 'Delete trip' }))

    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8000/api/trips/10',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(await screen.findByText('My trips page')).toBeInTheDocument()
  })
})
