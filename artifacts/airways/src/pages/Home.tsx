import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HorizonScene from '../components/HorizonScene'
import { SectionHeading, StatGrid } from '../components/Bits'
import RouteLine from '../components/RouteLine'
import { HUB, REGIONS, ALL_DESTINATIONS } from '../data/destinations'
import { FLEET } from '../data/fleet'
import { CABINS } from '../data/cabins'
import { KEY_FIGURES } from '../data/history'
import { useBooking } from '../context/BookingContext'

export default function Home() {
  const navigate = useNavigate()
  const { search, setSearch } = useBooking()
  const [destCode, setDestCode] = useState('JFK')

  const today = new Date().toISOString().slice(0, 10)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const dest = ALL_DESTINATIONS.find((d) => d.code === destCode)
    setSearch({
      ...search,
      origin: HUB,
      destination: dest ?? null,
      date: search.date || today,
    })
    navigate('/reservation')
  }

  return (
    <div>
      {/* ---------------- HERO ---------------- */}
      <section className="hero">
        <video
          className="hero__video"
          src="/images/videopub2.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
        />
        <div className="hero__video-overlay" aria-hidden="true" />
        <HorizonScene />
        <div className="container hero__content">
          <h1>
            Le monde a rendez-vous <em>au lever du jour</em>
          </h1>
          <p className="hero__lede">
            Depuis notre hub de Caledora, nous relions l'Europe, l'Amérique, l'Afrique, le Moyen-Orient, l'Asie et
            l'Océanie — environ 135 destinations et 18 millions de voyageurs chaque année.
          </p>
          <div className="hero__ctas">
            <a href="#recherche" className="btn btn--gold">Réserver un vol</a>
            <a href="/airways/destinations" className="btn btn--outline">Explorer le réseau</a>
          </div>

          <form id="recherche" className="search-bar" onSubmit={handleSearch}>
            <div className="search-field">
              <label htmlFor="origin">Départ</label>
              <input id="origin" value={`${HUB.city} (${HUB.code})`} readOnly />
            </div>
            <div className="search-field">
              <label htmlFor="destination">Destination</label>
              <select id="destination" value={destCode} onChange={(e) => setDestCode(e.target.value)}>
                {REGIONS.map((region) => (
                  <optgroup label={region.label} key={region.id}>
                    {region.destinations.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.city} ({d.code})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="search-field">
              <label htmlFor="date">Date de départ</label>
              <input
                id="date"
                type="date"
                min={today}
                value={search.date || today}
                onChange={(e) => setSearch({ ...search, date: e.target.value })}
              />
            </div>
            <div className="search-bar__submit pl-[25px] pr-[25px]">
              <button type="submit" className="btn btn--gold">Rechercher</button>
            </div>
          </form>
        </div>
      </section>
      {/* ---------------- BRAND FILM ---------------- */}
      <section className="brand-film section">
        <div className="container brand-film__layout">
          <div className="brand-film__copy">
            <span className="eyebrow">À bord</span>
            <h2>L'Expérience Caledora Airways</h2>
            <p className="lede">
              Un service attentif, une cuisine inspirée par la Méditerranée et le calme d'un voyage pensé jusque dans
              les détails.
            </p>
          </div>
          <div className="brand-film__player">
            <video
              controls
              playsInline
              preload="auto"
              aria-label="Film de marque Caledora Airways"
            >
              <source src="/images/videopubson.mp4" type="video/mp4" />
              <source src={`${import.meta.env.BASE_URL}images/videopubson.mp4`} type="video/mp4" />
              Votre navigateur ne prend pas en charge la lecture vidéo.
            </video>
          </div>
        </div>
      </section>
      {/* ---------------- PILLARS ---------------- */}
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Pourquoi Caledora Airways"
            title="Un hub méditerranéen, un réseau mondial"
            lede="Un modèle construit autour de la connectivité de Caledora, complété par les correspondances de l'alliance SkyTeam."
          />
          <div className="pillar-grid">
            <div className="pillar">
              <span className="mono-tag" style={{ color: 'var(--gold-dark)' }}>RÉSEAU</span>
              <h3>135 destinations</h3>
              <p>Un réseau dense en Europe et en Méditerranée, complété par des liaisons long-courrier vers cinq continents.</p>
            </div>
            <div className="pillar">
              <span className="mono-tag" style={{ color: 'var(--gold-dark)' }}>FLOTTE</span>
              <h3>105 appareils Airbus</h3>
              <p>De l'A220 à l'A380, une flotte modernisée autour des familles A220, A320neo et A350.</p>
            </div>
            <div className="pillar">
              <span className="mono-tag" style={{ color: 'var(--gold-dark)' }}>ALLIANCE</span>
              <h3>Membre SkyTeam</h3>
              <p>Partenariats étroits avec Air France-KLM et Delta Air Lines, et le programme de fidélité Aurora.</p>
            </div>
          </div>
        </div>
      </section>
      {/* ---------------- NETWORK SPLIT ---------------- */}
      <section className="section section--mist">
        <div className="container split">
          <div>
            <SectionHeading
              eyebrow="Réseau"
              title="Depuis Caledora, cinq continents"
              lede="Environ un cinquième de nos passagers voyagent en correspondance, grâce à des vagues d'arrivées et de départs organisées au hub."
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 32 }}>
              <RouteLine originCode="CLR" destinationCode="JFK" stopLabel="Direct · 8h40" />
              <RouteLine originCode="CLR" destinationCode="HND" stopLabel="Direct · 12h10" />
              <RouteLine originCode="CLR" destinationCode="SYD" stopLabel="Via SIN" />
            </div>
            <a href="/airways/destinations" className="btn btn--outline-dark">Voir toutes les destinations</a>
          </div>
          <div className="split__media map-scene">
            <NetworkGlyph />
          </div>
        </div>
      </section>
      {/* ---------------- STATS ---------------- */}
      <section className="section--navy section--tight">
        <div className="container">
          <span className="eyebrow" style={{ marginBottom: 24, display: 'inline-flex' }}>Caledora Airways en 2026</span>
          <StatGrid stats={KEY_FIGURES.slice(0, 4)} />
        </div>
      </section>
      {/* ---------------- FLEET SPLIT ---------------- */}
      <section className="section">
        <div className="container split split--reverse">
          <div className="split__media map-scene">
            <FleetGlyph />
          </div>
          <div>
            <SectionHeading
              eyebrow="Flotte"
              title="Une flotte 100% Airbus, renouvelée en profondeur"
              lede="Les A220, A321neo, A321XLR et A350 remplacent progressivement les générations précédentes pour réduire la consommation par siège."
            />
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
              {FLEET.slice(0, 4).map((f) => (
                <li key={f.code} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                  <span style={{ fontWeight: 600 }}>{f.name}</span>
                  <span className="mono-tag" style={{ color: 'var(--navy-light)' }}>{f.count} appareils</span>
                </li>
              ))}
            </ul>
            <a href="/airways/flotte" className="btn btn--outline-dark">Découvrir la flotte complète</a>
          </div>
        </div>
      </section>
      {/* ---------------- CABINS TEASER ---------------- */}
      <section className="section section--mist">
        <div className="container">
          <SectionHeading
            align="center"
            eyebrow="Cabines & services"
            title="Voyager selon vos besoins"
            lede="De l'Economy à la Première, un produit conçu selon les standards des grandes compagnies européennes."
          />
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {CABINS.map((c) => (
              <div className="card card--white" key={c.id}>
                <span className="eyebrow">{c.name}</span>
                <h3 style={{ fontSize: 20, marginTop: 12, marginBottom: 10 }}>{c.tagline}</h3>
                <p style={{ fontSize: 14.5, color: 'var(--navy-light)' }}>{c.description.slice(0, 110)}…</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ---------------- CTA BAND ---------------- */}
      <section className="section--navy section--tight">
        <div className="container cta-band">
          <div>
            <h2 style={{ fontSize: 30, marginBottom: 10 }}>Prêt·e à décoller ?</h2>
            <p className="lede">Recherchez un vol et laissez-vous porter par le réseau Caledora Airways.</p>
          </div>
          <a href="/airways/reservation" className="btn btn--gold">Réserver un vol</a>
        </div>
      </section>
    </div>
  );
}

function NetworkGlyph() {
  return (
    <svg viewBox="0 0 400 340" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
      <defs>
        <radialGradient id="glowHome" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#2C4C74" />
          <stop offset="100%" stopColor="#17365D" />
        </radialGradient>
      </defs>
      <rect width="400" height="340" fill="url(#glowHome)" />
      <circle cx="80" cy="200" r="3" fill="var(--gold-light)" />
      {([[80, 200, 200, 90], [80, 200, 320, 150], [80, 200, 260, 260], [80, 200, 120, 60]] as [number,number,number,number][]).map(([x1, y1, x2, y2], i) => (
        <path key={i} d={`M${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 40} ${x2} ${y2}`} stroke="var(--gold)" strokeWidth="1" fill="none" opacity="0.55" strokeDasharray="1 5" />
      ))}
      {([[200, 90], [320, 150], [260, 260], [120, 60]] as [number,number][]).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="var(--gold-light)" opacity="0.85" />
      ))}
      <circle cx="80" cy="200" r="7" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
    </svg>
  )
}

function FleetGlyph() {
  return (
    <img
      src="/images/airbus.png"
      alt="Avion Airbus de la flotte Caledora Airways"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}
