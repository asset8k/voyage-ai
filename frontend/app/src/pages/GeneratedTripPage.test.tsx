import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthProvider'
import { generatedTripFixture, userFixture } from '../test/fixtures'
import { GeneratedTripPage } from './GeneratedTripPage'
import { ToastProvider } from '../components/ToastProvider'

type GeneratedTripEntry = string | { pathname: string; state?: unknown }

function renderGeneratedTrip(initialEntry: GeneratedTripEntry = '/generated') {
  sessionStorage.setItem('voyage-ai.generated-trip', JSON.stringify(generatedTripFixture))

  return render(
    <AuthProvider><ToastProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/generated" element={<GeneratedTripPage />} />
          <Route path="/auth" element={<p>Authentication page</p>} />
          <Route path="/my-trips" element={<p>My trips page</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider></AuthProvider>,
  )
}

describe('GeneratedTripPage saving', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the arrival transition after a newly generated itinerary', () => {
    renderGeneratedTrip({ pathname: '/generated', state: { itineraryJustCreated: true } })

    expect(screen.getByRole('heading', { name: 'Tokyo' }).closest('section')).toHaveClass(
      'itinerary-page--arrival',
    )
  })

  it('sends the generated request and plan with the user bearer token', async () => {
    localStorage.setItem('voyage-ai.access-token', 'token-123')
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(userFixture)))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 10,
        title: 'Tokyo trip',
        destination: 'Tokyo',
        start_date: '2026-10-10',
        end_date: '2026-10-12',
        trip_plan: generatedTripFixture.tripPlan,
        is_public: false,
        created_at: '2026-09-11T10:00:00Z',
        updated_at: '2026-09-11T10:00:00Z',
      }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    renderGeneratedTrip()
    await user.click(await screen.findByRole('button', { name: 'Save trip' }))

    await screen.findByText('Tokyo trip is in your library.')
    expect(screen.getByRole('status')).toHaveTextContent('Trip saved')
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:8000/api/trips',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
        body: JSON.stringify({
          title: null,
          generation_request: generatedTripFixture.request,
          trip_plan: generatedTripFixture.tripPlan,
        }),
      }),
    )
  })

  it('sends guests to authentication before saving', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn())

    renderGeneratedTrip()
    await user.click(await screen.findByRole('button', { name: 'Sign in to save' }))

    await waitFor(() => expect(screen.getByText('Authentication page')).toBeInTheDocument())
  })
})
