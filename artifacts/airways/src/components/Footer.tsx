import { Link } from 'react-router-dom'
import { Logo } from './Logo'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__top">
        <div className="footer__brand">
          <Logo dark size={28} />
          <p className="lede footer__tagline">
            Compagnie aérienne nationale de la République de Caledora. Membre de SkyTeam depuis 2004.
          </p>
        </div>

        <div className="footer__col">
          <span className="eyebrow">Voyager</span>
          <Link to="/reservation">Réserver un vol</Link>
          <Link to="/destinations">Destinations</Link>
          <Link to="/cabines">Cabines & services</Link>
          <Link to="/flotte">Notre flotte</Link>
        </div>

        <div className="footer__col">
          <span className="eyebrow">Programme</span>
          <Link to="/aurora">Programme Aurora</Link>
          <Link to="/aurora">Salons Aurora Lounge</Link>
          <Link to="/a-propos">SkyTeam & partenaires</Link>
        </div>

        <div className="footer__col">
          <span className="eyebrow">Compagnie</span>
          <Link to="/a-propos">Notre histoire</Link>
          <Link to="/a-propos">Gouvernance</Link>
          <Link to="/a-propos">Engagement environnemental</Link>
        </div>
      </div>

      <hr className="hairline" style={{ background: 'rgba(255,255,255,0.14)' }} />

      <div className="container footer__bottom">
        <span>© 2026 Caledora Airways — Univers fictif, projet Caledora.</span>
        <span className="mono-tag">CW · CDA · Hub CLR</span>
      </div>
    </footer>
  )
}
