import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../auth/auth-context'
import { userFixture } from '../test/fixtures'
import { AppShell } from './AppShell'
import { ToastProvider } from './ToastProvider'

function renderShell() {
  const signOut = vi.fn()

  render(
    <AuthContext.Provider value={{ accessToken: 'token', user: userFixture, isLoading: false, signIn: vi.fn(), signUp: vi.fn(), signOut }}>
      <ToastProvider><MemoryRouter>
        <Routes>
          <Route element={<AppShell />}><Route index element={<p>Planner</p>} /></Route>
        </Routes>
      </MemoryRouter></ToastProvider>
    </AuthContext.Provider>,
  )

  return { signOut }
}

describe('AppShell', () => {
  it('opens and closes the responsive navigation menu', () => {
    renderShell()

    const menuButton = screen.getByRole('button', { name: 'Open menu' })
    fireEvent.click(menuButton)

    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toHaveClass('main-nav--open')

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(screen.getByRole('navigation')).not.toHaveClass('main-nav--open')
  })

  it('signs out through the mobile navigation session controls', () => {
    const { signOut } = renderShell()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Sign out' }))

    expect(signOut).toHaveBeenCalledOnce()
    expect(screen.getByRole('navigation')).not.toHaveClass('main-nav--open')
  })
})
