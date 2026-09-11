import { Compass, LogOut, Map, Menu, Plus, Sparkles, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'

function navClassName({ isActive }: { isActive: boolean }): string {
  return `nav-link${isActive ? ' nav-link--active' : ''}`
}

export function AppShell() {
  const { isLoading, signOut, user } = useAuth()

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__content">
          <NavLink className="brand" to="/">
            <span className="brand__mark" aria-hidden="true"><Compass size={18} strokeWidth={2.5} /></span>
            <span>Voyage <strong>AI</strong></span>
          </NavLink>
          <nav className="main-nav" aria-label="Main navigation">
            <NavLink className={navClassName} to="/">Plan a trip</NavLink>
            <NavLink className={navClassName} to="/explore">Explore feed</NavLink>
            <NavLink className={navClassName} to="/my-trips">My trips</NavLink>
          </nav>
          <div className="site-header__actions">
            {isLoading ? <span className="session-status">Checking session…</span> : user ? <><span className="current-user"><UserRound size={15} />@{user.username}</span><button className="sign-out-button" type="button" onClick={signOut}><LogOut size={15} />Sign out</button></> : <NavLink className="text-link" to="/auth">Sign in</NavLink>}
            <NavLink className="button button--small" to="/"><Plus size={16} />Create journey</NavLink>
            <button className="menu-button" type="button" aria-label="Open menu"><Menu size={20} /></button>
          </div>
        </div>
      </header>
      <main className="page-content"><Outlet /></main>
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
