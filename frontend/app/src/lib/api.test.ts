import { afterEach, describe, expect, it, vi } from 'vitest'

import { login } from './api'

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
