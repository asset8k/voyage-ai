import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, generateTrip, getCurrentUser, getPublicTrips, login, refineTrip, saveTrip, updateTrip, deleteTrip } from './api'
import { generatedTripFixture } from '../test/fixtures'

describe('login', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts credentials and returns the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'test-token',
      token_type: 'bearer',
    })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(login({ username: 'traveler_1', password: 'securepassword123' })).resolves.toEqual({
      access_token: 'test-token',
      token_type: 'bearer',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'traveler_1', password: 'securepassword123' }),
      }),
    )
  })
})

describe('startup resilience', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retries transient read failures with bounded exponential backoff', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)

    const result = getPublicTrips()
    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops after three failed reads and exposes a useful error', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)
    const result = expect(getPublicTrips()).rejects.toThrow('We could not reach the server')
    await vi.runAllTimersAsync()
    await result
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([401, 403, 404, 422, 429, 500])('does not retry HTTP %i', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Rejected' }), { status }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getCurrentUser('token')).rejects.toMatchObject({ status, message: 'Rejected' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([502, 503, 504])('recovers after a gateway returns HTTP %i', async (status) => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status }))
      .mockResolvedValueOnce(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    const result = getPublicTrips()
    await vi.runAllTimersAsync()
    await expect(result).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each(['login', 'save', 'update', 'delete', 'generate', 'refine'])('never replays a failed %s operation', async (operation) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const calls = {
      login: () => login({ username: 'traveler_1', password: 'password' }),
      save: () => saveTrip({ title: 'Trip', generation_request: generatedTripFixture.request, trip_plan: generatedTripFixture.tripPlan }, 'token'),
      update: () => updateTrip(1, { title: 'New title' }, 'token'),
      delete: () => deleteTrip(1, 'token'),
      generate: () => generateTrip(generatedTripFixture.request, []),
      refine: () => refineTrip(1, { instruction: 'More museums' }, 'token'),
    }
    await expect(calls[operation as keyof typeof calls]()).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  function mockStalledFetch() {
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('aborts stalled reads and eventually exits the loading state', async () => {
    vi.useFakeTimers()
    const fetchMock = mockStalledFetch()
    const result = expect(getPublicTrips()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('taking longer') })
    await vi.runAllTimersAsync()
    await result
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.every(([, init]) => init.signal?.aborted)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('allows longer AI generation but still aborts it without replaying', async () => {
    vi.useFakeTimers()
    const fetchMock = mockStalledFetch()
    const result = expect(generateTrip(generatedTripFixture.request, [])).rejects.toMatchObject({ status: 0, message: expect.stringContaining('may still finish') })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(120_000)
    await result
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps the timeout active while reading the response body', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => Promise.resolve({
      ok: true,
      json: () => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      }),
    })))
    const result = expect(getPublicTrips()).rejects.toMatchObject({ status: 0 })
    await vi.runAllTimersAsync()
    await result
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
