import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BookingLayout from '../../components/BookingLayout'
import { useBooking } from '../../context/BookingContext'

export default function BookingConfirmation() {
  const navigate = useNavigate()
  const { search, selectedFlight, selectedReturnFlight, selectedSeats, passengerNames, bookingReference, resetBooking } =
    useBooking()

  useEffect(() => {
    if (!selectedFlight || !bookingReference) navigate('/reservation', { replace: true })
  }, [selectedFlight, bookingReference, navigate])

  if (!selectedFlight || !bookingReference) return null

  const legs = [
    { key: 'aller', label: 'Vol aller', flight: selectedFlight },
    ...(selectedReturnFlight ? [{ key: 'retour', label: 'Vol retour', flight: selectedReturnFlight }] : []),
  ]

  const fareTotal = legs.reduce((sum, l) => sum + l.flight.prices[l.flight.cabin] * (search.passengers || 1), 0)
  const seatTotal = legs.reduce(
    (sum, l) => sum + (selectedSeats[l.key] || []).reduce((s: number, seat: any) => s + seat.price, 0),
    0
  )

  const handleNewBooking = () => {
    resetBooking()
    navigate('/')
  }

  return (
    <BookingLayout step={3}>
      <div className="confirmation-card" style={{ margin: '0 auto' }}>
        <span className="eyebrow" style={{ justifyContent: 'center' }}>Réservation confirmée</span>
        <div className="confirmation-ref">{bookingReference}</div>
        <p className="lede" style={{ margin: '0 auto' }}>
          Merci {passengerNames[0]}. Un e-mail de confirmation aurait été envoyé pour ce vol simulé.
        </p>

        <div className="confirmation-details">
          {legs.map((l) => (
            <div key={l.key}>
              <div className="confirmation-details__row">
                <span>{l.label}</span>
                <span>{l.flight.flightNumber}</span>
              </div>
              <div className="confirmation-details__row">
                <span>Trajet</span>
                <span>{l.flight.origin} → {l.flight.destination}</span>
              </div>
              <div className="confirmation-details__row">
                <span>Horaires</span>
                <span>{l.flight.departTime} – {l.flight.arriveTime}{l.flight.nextDay ? '+1' : ''}</span>
              </div>
              <div className="confirmation-details__row">
                <span>Cabine</span>
                <span>{l.flight.cabin}</span>
              </div>
              <div className="confirmation-details__row">
                <span>Sièges</span>
                <span>{(selectedSeats[l.key] || []).map((s: any) => s.id).join(', ') || '—'}</span>
              </div>
              <hr className="hairline" style={{ margin: '10px 0' }} />
            </div>
          ))}

          <div className="confirmation-details__row">
            <span>Passagers</span>
            <span>{passengerNames.join(', ')}</span>
          </div>
          <div className="confirmation-details__row">
            <span>Total estimé</span>
            <span>{fareTotal + seatTotal} €</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, marginTop: 32, justifyContent: 'center' }}>
          <button className="btn btn--outline-dark" onClick={handleNewBooking}>Nouvelle recherche</button>
          <Link to="/aurora" className="btn btn--gold">Cumuler des points Aurora</Link>
        </div>
      </div>
    </BookingLayout>
  )
}
