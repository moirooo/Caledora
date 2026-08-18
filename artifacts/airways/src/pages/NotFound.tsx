import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="section" style={{ paddingTop: 180, textAlign: 'center' }}>
      <div className="container">
        <span className="eyebrow" style={{ justifyContent: 'center' }}>Erreur 404</span>
        <h1 style={{ fontSize: 44, margin: '18px 0' }}>Cette destination n'est pas au programme</h1>
        <p className="lede" style={{ margin: '0 auto 32px' }}>La page que vous cherchez n'existe pas ou a changé d'adresse.</p>
        <Link to="/" className="btn btn--gold">Retour à l'accueil</Link>
      </div>
    </section>
  )
}
