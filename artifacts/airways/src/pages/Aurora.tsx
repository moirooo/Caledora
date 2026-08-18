import { PageHeader, SectionHeading } from '../components/Bits'
import { AURORA_TIERS, AURORA_PARTNERS } from '../data/aurora'

export default function Aurora() {
  return (
    <div>
      <PageHeader
        eyebrow="Programme de fidélité"
        title="Aurora"
        lede="Cumulez des points sur Caledora Airways et ses partenaires, et profitez d'avantages reconnus au sein de SkyTeam."
      />

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow="Statuts" title="Quatre niveaux, des avantages croissants" />
          <div className="tier-grid">
            {AURORA_TIERS.map((t, i) => (
              <div className={`tier-card ${i === 2 ? 'tier-card--highlight' : ''}`} key={t.id}>
                <span className="eyebrow">{t.threshold}</span>
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <ul>
                  {t.benefits.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--mist">
        <div className="container">
          <SectionHeading
            eyebrow="Partenaires"
            title="Cumulez au-delà des vols"
            lede="Le programme Aurora permet d'accumuler des points par l'intermédiaire de nombreux partenaires, en plus des compagnies de l'alliance SkyTeam."
          />
          <ul style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {AURORA_PARTNERS.map((p) => (
              <li key={p} className="badge" style={{ padding: '10px 18px', fontSize: 14 }}>{p}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section--navy section--tight">
        <div className="container cta-band">
          <div>
            <h2 style={{ fontSize: 28, marginBottom: 10 }}>Rejoignez Aurora</h2>
            <p className="lede">L'inscription est gratuite et donne accès immédiatement au niveau Horizon.</p>
          </div>
          <a href="/reservation" className="btn btn--gold">Réserver un vol</a>
        </div>
      </section>
    </div>
  )
}
