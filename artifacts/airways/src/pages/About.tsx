import { PageHeader, SectionHeading, StatGrid } from '../components/Bits'
import { TIMELINE, KEY_FIGURES, LEADERSHIP, OWNERSHIP, SKYTEAM_PARTNERS } from '../data/history'

export default function About() {
  return (
    <div>
      <PageHeader
        eyebrow="À propos"
        title="Depuis 1932, connecter Caledora au monde"
        lede="Née en 1947 de la restructuration de la Compagnia Aerea Caledoriana, fondée en 1932, Caledora Airways est aujourd'hui un transporteur européen de service complet, membre de SkyTeam."
      />

      <section className="section--tight">
        <div className="container">
          <StatGrid stats={KEY_FIGURES} />
        </div>
      </section>

      {/* ---------- Timeline ---------- */}
      <section className="section">
        <div className="container">
          <SectionHeading eyebrow="Histoire" title="Les grandes étapes" />
          <ol className="timeline">
            {TIMELINE.map((t) => (
              <li className="timeline__item" key={t.year}>
                <span className="timeline__year mono-tag">{t.year}</span>
                <span className="timeline__dot" aria-hidden="true" />
                <div className="timeline__body">
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Leadership & ownership ---------- */}
      <section className="section section--mist">
        <div className="container split">
          <div>
            <SectionHeading eyebrow="Gouvernance" title="Direction" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {LEADERSHIP.map((p) => (
                <div key={p.name}>
                  <h3 style={{ fontSize: 20 }}>{p.name}</h3>
                  <p className="mono-tag" style={{ color: 'var(--gold-dark)', margin: '4px 0 10px' }}>{p.role}</p>
                  <p style={{ color: 'var(--navy-light)', fontSize: 14.5 }}>{p.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="Actionnariat" title="Répartition du capital" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {OWNERSHIP.map((o) => (
                <div key={o.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14.5 }}>
                    <span style={{ fontWeight: 600 }}>{o.label}</span>
                    <span className="mono-tag">{o.value}%</span>
                  </div>
                  <div className="ownership-bar">
                    <div className="ownership-bar__fill" style={{ width: `${o.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 24, fontSize: 13.5, color: 'var(--navy-light)' }}>
              L'État calédorien conserve une action spécifique sur certaines décisions stratégiques (nationalité de la
              compagnie, créneaux, siège social, prise de contrôle étrangère).
            </p>
          </div>
        </div>
      </section>

      {/* ---------- SkyTeam ---------- */}
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Alliance"
            title="Membre de SkyTeam depuis 2004"
            lede="La coopération avec Air France-KLM est historiquement la plus développée en Europe ; Delta Air Lines est le principal partenaire en Amérique du Nord."
          />
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {SKYTEAM_PARTNERS.map((p) => (
              <div className="tile" key={p.name}>
                <span className="tile__title" style={{ fontSize: 18 }}>{p.name}</span>
                <p style={{ fontSize: 13.5, color: 'var(--navy-light)' }}>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Environment ---------- */}
      <section className="section section--navy">
        <div className="container">
          <SectionHeading
            eyebrow="Environnement"
            title="Renouveler la flotte, investir dans les SAF"
            lede="La réduction de la consommation de carburant reste l'axe principal de la stratégie environnementale : les A220, A320neo, A321neo et A350 remplacent progressivement les appareils plus anciens. La compagnie participe à plusieurs programmes de carburants d'aviation durables (SAF) via des contrats pluriannuels avec des producteurs européens."
          />
        </div>
      </section>
    </div>
  )
}
