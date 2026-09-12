import { Compass, LogOut, Map, Menu, Plus, Sparkles, UserRound } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { useToast } from './toast-context'

function navClassName({ isActive }: { isActive: boolean }): string {
  return `nav-link${isActive ? ' nav-link--active' : ''}`
}

function AnimatedOutlet() {
  const location = useLocation()

  return <div key={location.key} className="page-transition"><Outlet /></div>
}

export function AppShell() {
  const { isLoading, signOut, user } = useAuth()
  const { success } = useToast()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function closeMenu() {
    setIsMenuOpen(false)
  }

  function handleMobileSignOut() {
    signOut()
    success('Signed out', 'See you on your next journey.')
    closeMenu()
  }

  function handleSignOut() {
    signOut()
    success('Signed out', 'See you on your next journey.')
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__content">
          <NavLink className="brand" to="/">
            <span className="brand__mark" aria-hidden="true"><Compass size={18} strokeWidth={2.5} /></span>
            <span>Voyage <strong>AI</strong></span>
          </NavLink>
          <nav id="main-navigation" className={`main-nav${isMenuOpen ? ' main-nav--open' : ''}`} aria-label="Main navigation">
            <NavLink className={navClassName} to="/" onClick={closeMenu}>Plan a trip</NavLink>
            <NavLink className={navClassName} to="/explore" onClick={closeMenu}>Explore feed</NavLink>
            <NavLink className={navClassName} to="/my-trips" onClick={closeMenu}>My trips</NavLink>
            {!isLoading && <div className="mobile-nav__session">
              {user ? <><span><UserRound size={15} />@{user.username}</span><button type="button" onClick={handleMobileSignOut}><LogOut size={15} />Sign out</button></> : <NavLink className="button button--small" to="/auth" onClick={closeMenu}>Sign in</NavLink>}
            </div>}
          </nav>
          <div className="site-header__actions">
            {isLoading ? <span className="session-status">Checking session…</span> : user ? <><span className="current-user"><UserRound size={15} />@{user.username}</span><button className="sign-out-button" type="button" onClick={handleSignOut}><LogOut size={15} />Sign out</button></> : <NavLink className="text-link" to="/auth">Sign in</NavLink>}
            <NavLink className="button button--small" to="/"><Plus size={16} />Create journey</NavLink>
            <button className="menu-button" type="button" aria-label={isMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMenuOpen} aria-controls="main-navigation" onClick={() => setIsMenuOpen((open) => !open)}><Menu size={20} /></button>
          </div>
        </div>
      </header>
      <main className="page-content"><AnimatedOutlet /></main>
      <footer className="site-footer">
        <div><span className="site-footer__brand">Voyage AI</span><span className="site-footer__tag">Thoughtfully planned journeys.</span></div>
        <span>AI-assisted travel planning</span>
      </footer>
    </div>
  )
}

export function PagePlaceholder({ icon: Icon, title, description }: { icon: typeof Map | typeof Sparkles; title: string; description: string }) {
  return <section className="placeholder-page"><span className="placeholder-page__icon"><Icon size={26} /></span><p className="eyebrow">Voyage AI</p><h1>{title}</h1><p>{description}</p></section>
}
