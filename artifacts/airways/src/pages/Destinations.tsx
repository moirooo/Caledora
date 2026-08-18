import { Link } from 'react-router-dom'
import { SectionHeading, StatGrid, PageHeader } from '../components/Bits'
import RouteLine from '../components/RouteLine'
import { REGIONS, NETWORK_STATS, HUB } from '../data/destinations'

export default function Destinations() {
  return (
    <div>
      <PageHeader
        eyebrow="Réseau"
        title="Cinq continents, un hub méditerranéen"
        lede="Depuis Caledora, la compagnie dessert environ 135 destinations selon les saisons, avec une majorité de fréquences concentrées sur l'Europe et le bassin méditerranéen."
      />

      <section className="section--tight">
        <div className="container">
          <StatGrid stats={NETWORK_STATS} />
        </div>
      </section>

      {REGIONS.map((region, i) => (
        <section className={`section section--tight ${i % 2 === 1 ? 'section--mist' : ''}`} key={region.id}>
          <div className="container">
            <SectionHeading eyebrow={region.label} title={region.label} lede={region.blurb} />
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {region.destinations.map((d) => (
                <div className="tile" key={d.code}>
                  <RouteLine
                    originCode={HUB.code}
                    destinationCode={'viaHub' in d && d.viaHub ? d.viaHub : d.code}
                    stopLabel={'viaHub' in d && d.viaHub ? `Via ${d.viaHub}` : 'Direct'}
                  />
                  <span className="tile__title">{d.city}</span>
                  <span className="tile__meta">{d.code} · {d.country}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="section--navy section--tight">
        <div className="container cta-band">
          <div>
            <h2 style={{ fontSize: 28, marginBottom: 10 }}>Votre destination n'y figure pas ?</h2>
            <p className="lede">Grâce à SkyTeam, retrouvez des centaines de destinations supplémentaires via nos partenaires.</p>
          </div>
          <Link to="/a-propos" className="btn btn--outline">Voir nos partenaires SkyTeam</Link>
        </div>
      </section>
    </div>
  )
}
