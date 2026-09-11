import { ArrowRight, Compass, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent as ReactFormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { ApiError } from '../lib/api'
import { useAuth } from '../auth/auth-context'

type Mode = 'login' | 'register'
type LocationState = { from?: string }

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const returnPath = (location.state as LocationState | null)?.from ?? '/'

  if (user) return <Navigate replace to={returnPath} />

  async function handleSubmit(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const credentials = { username, password }
      if (mode === 'login') {
        await signIn(credentials)
      } else {
        await signUp(credentials)
      }
      navigate(returnPath, { replace: true })
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'We could not reach Voyage AI. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setError(null)
  }

  return (
    <section className="auth-page">
      <div className="auth-page__story">
        <div className="auth-page__story-content">
          <span className="auth-page__logo"><Compass size={21} /></span>
          <p className="eyebrow eyebrow--light">Voyage AI concierge</p>
          <h1>Keep the journeys that stay with you.</h1>
          <p>
            Save your itineraries, make the best ones public, and return whenever
            you are ready to refine the details.
          </p>
          <div className="auth-page__quote">
            <span>“</span>
            <p>A plan should leave room for a little wonder.</p>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-panel__inner">
          <p className="eyebrow">Your account</p>
          <h2>{mode === 'login' ? 'Welcome back.' : 'Begin your journey.'}</h2>
          <p className="auth-panel__intro">
            {mode === 'login'
              ? 'Sign in to return to your saved trips.'
              : 'Create an account to save and refine your itineraries.'}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button className={mode === 'login' ? 'auth-tab auth-tab--active' : 'auth-tab'} type="button" onClick={() => switchMode('login')}>Sign in</button>
            <button className={mode === 'register' ? 'auth-tab auth-tab--active' : 'auth-tab'} type="button" onClick={() => switchMode('register')}>Create account</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="username">Username</label>
              <div className="field__control">
                <UserRound size={18} />
                <input
                  id="username"
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="[a-z0-9_]+"
                  autoComplete="username"
                  placeholder="your_username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.toLowerCase())}
                />
              </div>
              {mode === 'register' && <small>Use lowercase letters, numbers, and underscores only.</small>}
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="field__control">
                <LockKeyhole size={18} />
                <input
                  id="password"
                  required
                  minLength={8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  type={isPasswordVisible ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                >
                  {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="button button--large button--full" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'One moment…' : mode === 'login' ? 'Sign in to Voyage AI' : 'Create my account'}
              {!isSubmitting && <ArrowRight size={17} />}
            </button>
          </form>
          <p className="auth-panel__switch">
            {mode === 'login' ? 'New to Voyage AI?' : 'Already have an account?'}{' '}
            <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </section>
  )
}
