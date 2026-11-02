import type {
  Credentials,
  TokenResponse,
  TripCreate,
  TripDetail,
  TripFeedItem,
  TripGenerationRequest,
  TripListItem,
  TripPlan,
  TripRefinementRequest,
  TripUpdate,
  User,
} from '../types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const READ_TIMEOUT_MS = 20_000
const WRITE_TIMEOUT_MS = 60_000
const AI_TIMEOUT_MS = 180_000
const TRANSIENT_STATUSES = new Set([502, 503, 504])

async function request<T>(
  path: string,
  init: RequestInit,
  timeoutMs = init.method === 'GET' ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS,
): Promise<T> {
  // Only reads are retried. Replaying a write could create duplicate trips or AI charges.
  const maxAttempts = init.method === 'GET' ? 3 : 1

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
      })
      const payload: unknown = await response.json().catch((error: unknown) => {
        if (controller.signal.aborted) throw error
        return null
      })

      if (!response.ok) {
        const detail =
          typeof payload === 'object' && payload !== null && 'detail' in payload
            ? String(payload.detail)
            : 'The service is temporarily unavailable. Please try again shortly.'

        throw new ApiError(detail, response.status)
      }

      return payload as T
    } catch (error) {
      const retryable = !(error instanceof ApiError) || TRANSIENT_STATUSES.has(error.status)
      if (!retryable || attempt === maxAttempts - 1) {
        if (error instanceof ApiError) throw error
        const message = controller.signal.aborted
          ? init.method === 'GET'
            ? 'The server is taking longer than expected. Please try again shortly.'
            : 'The request took too long. Check your trips before trying again; it may still finish.'
          : 'We could not reach the server. Check your connection and try again shortly.'
        throw new ApiError(message, 0)
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw new ApiError('The service is temporarily unavailable.', 0)
}

function jsonRequest<T>(
  path: string,
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST',
  body?: object,
  accessToken?: string,
  timeoutMs?: number,
): Promise<T> {
  return request<T>(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, timeoutMs)
}

export async function generateTrip(
  data: TripGenerationRequest,
  files: File[],
): Promise<TripPlan> {
  const formData = new FormData()

  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, String(value))
  })
  files.forEach((file) => formData.append('files', file))

  return request<TripPlan>('/api/trips/generate', {
    method: 'POST',
    body: formData,
  }, AI_TIMEOUT_MS)
}

export function register(credentials: Credentials): Promise<User> {
  return jsonRequest<User>('/api/auth/register', 'POST', credentials)
}

export function login(credentials: Credentials): Promise<TokenResponse> {
  return jsonRequest<TokenResponse>('/api/auth/login', 'POST', credentials)
}

export function getCurrentUser(accessToken: string): Promise<User> {
  return jsonRequest<User>('/api/auth/me', 'GET', undefined, accessToken)
}

export function saveTrip(data: TripCreate, accessToken: string): Promise<TripDetail> {
  return jsonRequest<TripDetail>('/api/trips', 'POST', data, accessToken)
}

export function getMyTrips(accessToken: string): Promise<TripListItem[]> {
  return jsonRequest<TripListItem[]>('/api/trips/mine', 'GET', undefined, accessToken)
}

export function getTrip(tripId: number, accessToken?: string): Promise<TripDetail> {
  return jsonRequest<TripDetail>(`/api/trips/${tripId}`, 'GET', undefined, accessToken)
}

export function getPublicTrips(): Promise<TripFeedItem[]> {
  return jsonRequest<TripFeedItem[]>('/api/trips/feed', 'GET')
}

export function updateTrip(
  tripId: number,
  data: TripUpdate,
  accessToken: string,
): Promise<TripDetail> {
  return jsonRequest<TripDetail>(`/api/trips/${tripId}`, 'PATCH', data, accessToken)
}

export function deleteTrip(tripId: number, accessToken: string): Promise<void> {
  return jsonRequest<void>(`/api/trips/${tripId}`, 'DELETE', undefined, accessToken)
}

export function refineTrip(
  tripId: number,
  data: TripRefinementRequest,
  accessToken: string,
): Promise<TripDetail> {
  return jsonRequest<TripDetail>(`/api/trips/${tripId}/refine`, 'POST', data, accessToken, AI_TIMEOUT_MS)
}
