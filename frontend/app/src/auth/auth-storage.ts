const ACCESS_TOKEN_KEY = 'voyage-ai.access-token'

export function readAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function writeAccessToken(accessToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}
