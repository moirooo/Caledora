import { PageHeader, SectionHeading, StatGrid } from '../components/Bits'
import { FLEET, FLEET_STATS } from '../data/fleet'

export default function Fleet() {
  return (
    <div>
      <PageHeader
        eyebrow="Flotte"
        title="105 appareils, une flotte entièrement Airbus"
        lede="De l'A220 pour les lignes européennes à demande modérée à l'A380 sur nos routes les plus denses, une flotte pensée pour réduire la complexité d'exploitation."
      />

      <section className="section--tight">
        <div className="container">
          <StatGrid stats={FLEET_STATS} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow="Appareils en service" title="La flotte 2026" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {FLEET.map((f) => (
              <FleetRow key={f.code} aircraft={f} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--mist">
        <div className="container">
          <SectionHeading
            eyebrow="Maintenance"
            title="Caledora Airways Engineering"
            lede="La maintenance lourde est réalisée dans la zone technique de l'Aéroport international de Caledora, avec des hangars capables d'accueillir monocouloirs et gros-porteurs. Les opérations les plus spécialisées sur l'A380 sont menées en coopération avec les constructeurs et des prestataires européens."
          />
        </div>
      </section>
    </div>
  )
}

interface AircraftType {
  code: string
  name: string
  count: number
  role: string
  note: string
  cabins: string[]
}

function FleetRow({ aircraft }: { aircraft: AircraftType }) {
  return (
    <div className="fleet-row">
      <div className="fleet-row__id">
        <span className="mono-tag" style={{ color: 'var(--gold-dark)' }}>{aircraft.code}</span>
        <h3>{aircraft.name}</h3>
      </div>
      <div className="fleet-row__count">
        <span className="stat__value" style={{ fontSize: 30 }}>{aircraft.count}</span>
        <span className="stat__label">appareils</span>
      </div>
      <div className="fleet-row__detail">
        <p style={{ fontWeight: 600, marginBottom: 6 }}>{aircraft.role}</p>
        <p style={{ color: 'var(--navy-light)', fontSize: 14.5, marginBottom: 10 }}>{aircraft.note}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {aircraft.cabins.map((c) => (
            <span className="badge" key={c}>{c}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
