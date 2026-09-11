import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthProvider'
import { savedTripFixture, userFixture } from '../test/fixtures'
import { MyTripsPage } from './MyTripsPage'

function renderMyTrips() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/my-trips']}>
        <Routes>
          <Route path="/my-trips" element={<MyTripsPage />} />
          <Route path="/auth" element={<p>Authentication page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('MyTripsPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads the current user’s saved trips with their bearer token', async () => {
    localStorage.setItem('voyage-ai.access-token', 'token-123')
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(new Response(JSON.stringify(userFixture)))
      return Promise.resolve(new Response(JSON.stringify([
        savedTripFixture,
        { ...savedTripFixture, id: 11, title: 'Published Tokyo', is_public: true },
      ])))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderMyTrips()

    expect(await screen.findByText('Tokyo food notes')).toBeInTheDocument()
    expect(screen.getByText('Published Tokyo')).toBeInTheDocument()
    expect(screen.getByText('Private')).toBeInTheDocument()
    expect(screen.getByText('Public')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /open itinerary/i })[0]).toHaveAttribute('href', '/my-trips/10')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/trips/mine',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-123' }) }),
    )
  })

  it('redirects a guest to sign in before showing saved trips', async () => {
    renderMyTrips()
    expect(await screen.findByText('Authentication page')).toBeInTheDocument()
  })
})
