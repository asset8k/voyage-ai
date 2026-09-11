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

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const detail =
      typeof payload === 'object' && payload !== null && 'detail' in payload
        ? String(payload.detail)
        : 'Something went wrong. Please try again.'

    throw new ApiError(detail, response.status)
  }

  return payload as T
}

function jsonRequest<T>(
  path: string,
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST',
  body?: object,
  accessToken?: string,
): Promise<T> {
  return request<T>(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
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
  })
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
  return jsonRequest<TripDetail>(`/api/trips/${tripId}/refine`, 'POST', data, accessToken)
}
