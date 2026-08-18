import { PageHeader, SectionHeading } from '../components/Bits'
import { CABINS } from '../data/cabins'

export default function Cabins() {
  return (
    <div>
      <PageHeader
        eyebrow="Cabines & services"
        title="Un produit pensé pour chaque type de voyage"
        lede="De l'Economy à la Première, la compagnie se positionne comme un transporteur européen de service complet, sans viser une offre ultra-luxueuse."
      />

      <section className="section">
        <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
          {CABINS.map((c, i) => (
            <CabinRow key={c.id} cabin={c} reverse={i % 2 === 1} />
          ))}
        </div>
      </section>

      <section className="section section--mist">
        <div className="container">
          <SectionHeading
            eyebrow="Restauration"
            title="Cuisine internationale, accent calédorien"
            lede="Les menus long-courriers associent poissons méditerranéens, légumes, huile d'olive, agrumes, pâtes et produits des collines. La compagnie collabore ponctuellement avec des chefs calédoriens et étrangers pour renouveler les menus de Business et Première."
          />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Salons"
            title="Aurora Lounge, Terminal 2"
            lede="Le principal ensemble, Aurora Lounge, comprend zones de restauration, espaces de travail, douches et salles de repos. Un espace distinct est réservé aux passagers Première et aux statuts les plus élevés du programme Aurora. À l'étranger : salons SkyTeam ou partenaires contractuels."
          />
        </div>
      </section>
    </div>
  )
}

interface CabinType {
  id: string
  name: string
  tagline: string
  description: string
  features: string[]
}

function CabinRow({ cabin, reverse }: { cabin: CabinType; reverse: boolean }) {
  return (
    <div className="cabin-row card--white" style={{ flexDirection: reverse ? 'row-reverse' : 'row' }}>
      <div className="cabin-row__visual">
        <CabinGlyph id={cabin.id} />
      </div>
      <div className="cabin-row__text">
        <span className="eyebrow">{cabin.name}</span>
        <h3 style={{ fontSize: 28, margin: '14px 0 12px' }}>{cabin.tagline}</h3>
        <p style={{ color: 'var(--navy-light)', marginBottom: 20, maxWidth: '52ch' }}>{cabin.description}</p>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cabin.features.map((f) => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5 }}>
              <span style={{ width: 4, height: 4, background: 'var(--gold)', display: 'inline-block' }} />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function CabinGlyph({ id }: { id: string }) {
  const density = ({ economy: 3, premium: 4, business: 6, premiere: 10 } as Record<string, number>)[id] || 3
  return (
    <svg viewBox="0 0 200 160" style={{ width: '100%', height: '100%' }} aria-hidden="true">
      <rect width="200" height="160" fill="var(--navy)" />
      {Array.from({ length: density }).map((_, row) => (
        <g key={row}>
          <rect x="30" y={20 + row * 13} width="26" height="9" rx="1.5" fill="var(--gold-light)" opacity="0.9" />
          <rect x="70" y={20 + row * 13} width="26" height="9" rx="1.5" fill="var(--gold-light)" opacity="0.6" />
          <rect x="130" y={20 + row * 13} width="26" height="9" rx="1.5" fill="var(--gold-light)" opacity="0.6" />
        </g>
      ))}
    </svg>
  )
}
