import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookingLayout from '../../components/BookingLayout'
import RouteLine from '../../components/RouteLine'
import { useBooking } from '../../context/BookingContext'
import { generateFlights } from '../../data/flights'
import { regionFor } from '../../data/destinations'

const CABIN_OPTIONS = ['Economy', 'Premium Economy', 'Business', 'Première']

export default function BookingResults() {
  const navigate = useNavigate()
  const { search, setSearch, setSelectedFlight, setSelectedReturnFlight } = useBooking()
  const [phase, setPhase] = useState<'aller' | 'retour'>('aller')
  const [cabin, setCabin] = useState(search.cabin || 'Economy')

  useEffect(() => {
    if (!search.origin || !search.destination || !search.date) {
      navigate('/reservation', { replace: true })
    }
  }, [search, navigate])

  const region = search.origin && search.destination ? regionFor(search.origin, search.destination) : 'Europe'

  const outboundFlights = useMemo(() => {
    if (!search.origin || !search.destination) return []
    return generateFlights({
      origin: search.origin.code,
      destination: search.destination.code,
      date: search.date,
      region,
    })
  }, [search.origin, search.destination, search.date, region])

  const returnFlights = useMemo(() => {
    if (search.tripType !== 'aller-retour' || !search.origin || !search.destination || !search.returnDate) return []
    return generateFlights({
      origin: search.destination.code,
      destination: search.origin.code,
      date: search.returnDate,
      region,
    })
  }, [search.tripType, search.origin, search.destination, search.returnDate, region])

  if (!search.origin || !search.destination) return null

  const isReturn = phase === 'retour'
  const flights = isReturn ? returnFlights : outboundFlights
  const legOrigin = isReturn ? search.destination : search.origin
  const legDestination = isReturn ? search.origin : search.destination
  const legDate = isReturn ? search.returnDate : search.date

  const handleChoose = (flight: (typeof flights)[0]) => {
    const withCabin = { ...flight, cabin }
    if (isReturn) {
      setSelectedReturnFlight(withCabin as any)
      setSearch({ ...search, cabin })
      navigate('/reservation/sieges')
    } else {
      setSelectedFlight(withCabin as any)
      setSearch({ ...search, cabin })
      if (search.tripType === 'aller-retour') {
        setPhase('retour')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        navigate('/reservation/sieges')
      }
    }
  }

  return (
    <BookingLayout
      step={1}
      title={isReturn ? 'Choisissez votre vol retour' : 'Choisissez votre vol aller'}
      lede={`${legOrigin.city} (${legOrigin.code}) → ${legDestination.city} (${legDestination.code}) · ${formatDate(legDate)} · ${search.passengers} passager${search.passengers > 1 ? 's' : ''}`}
    >
      <div className="cabin-toggle">
        {CABIN_OPTIONS.map((c) => (
          <button key={c} type="button" className={c === cabin ? 'active' : ''} onClick={() => setCabin(c)}>
            {c}
          </button>
        ))}
      </div>

      {flights.length === 0 && (
        <p className="lede">Aucun vol disponible pour cette recherche — essayez une autre date.</p>
      )}

      {flights.map((f) => {
        const available = f.cabinsAvailable.includes(cabin)
        return (
          <div className="flight-card" key={f.id}>
            <div>
              <div className="flight-card__times">
                <span>{f.departTime}</span>
                <span className="sep">—</span>
                <span>{f.arriveTime}{f.nextDay ? '+1' : ''}</span>
              </div>
              <div className="flight-card__meta">
                <span>{f.flightNumber}</span>
                <span>{f.duration}</span>
                <span>{f.stops}</span>
              </div>
            </div>

            <div>
              <RouteLine originCode={legOrigin.code} destinationCode={legDestination.code} stopLabel={f.stops} />
              <p style={{ marginTop: 10, fontSize: 13, color: 'var(--navy-light)' }}>{f.aircraft}</p>
            </div>

            <div className="flight-card__price">
              {available ? (
                <>
                  <span className="amount">{f.prices[cabin]} €</span>
                  <span className="label">par passager, {cabin}</span>
                  <button className="btn btn--gold btn--sm" style={{ marginTop: 14 }} onClick={() => handleChoose(f)}>
                    Choisir ce vol
                  </button>
                </>
              ) : (
                <span className="label">Cabine {cabin} non proposée sur cet appareil</span>
              )}
            </div>
          </div>
        )
      })}
    </BookingLayout>
  )
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}
