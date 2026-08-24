import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const LINKS = [
  { to: '/destinations', label: 'Destinations' },
  { to: '/flotte', label: 'Flotte' },
  { to: '/cabines', label: 'Cabines & services' },
  { to: '/aurora', label: 'Aurora' },
  { to: '/a-propos', label: 'À propos' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const onHome = location.pathname === '/'
  const isDark = onHome && !scrolled

  return (
    <header className={`navbar ${onHome ? 'navbar--home' : ''} ${isDark ? 'navbar--transparent' : 'navbar--solid'}`}>
      <div className="container navbar__inner">
        <NavLink to="/" className="navbar__brand" aria-label="Accueil Caledora Airways">
          <img
            src={`${import.meta.env.BASE_URL}images/airways-transparent.png`}
            alt="Caledora Airways"
            className={`navbar__official-logo${isDark ? ' navbar__official-logo--on-dark' : ''}`}
          />
        </NavLink>

        <nav className="navbar__links" aria-label="Navigation principale">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `navbar__link${isActive ? ' navbar__link--active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="navbar__actions">
          <a
            href="/"
            className="navbar__hub-back"
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: isDark ? 'rgba(255,255,255,0.72)' : 'var(--navy-light)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            } as React.CSSProperties}
            title="Retour au hub CaledoraOS"
          >
            ← Hub
          </a>
          <NavLink to="/reservation" className="btn btn--gold btn--sm">
            Réserver un vol
          </NavLink>
          <button
            className="navbar__burger"
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="navbar__mobile">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className="navbar__mobile-link">
              {l.label}
            </NavLink>
          ))}
          <a href="/" className="navbar__mobile-link" style={{ color: 'var(--gold-light)', opacity: 0.85 }}>
            ← Retour au Hub CaledoraOS
          </a>
          <NavLink to="/reservation" className="btn btn--gold btn--block">
            Réserver un vol
          </NavLink>
        </div>
      )}
    </header>
  )
}
