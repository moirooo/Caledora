import type { ReactNode } from 'react'
import StepTracker from './StepTracker'

const STEPS = ['Recherche', 'Vols', 'Sièges', 'Confirmation']

interface BookingLayoutProps {
  step: number
  title?: string
  lede?: string
  children: ReactNode
}

export default function BookingLayout({ step, title, lede, children }: BookingLayoutProps) {
  return (
    <div className="booking-layout">
      <div className="booking-layout__header">
        <div className="container">
          <span className="eyebrow" style={{ marginBottom: 16, display: 'inline-flex' }}>Réservation</span>
          <StepTracker steps={STEPS} currentIndex={step} />
        </div>
      </div>
      <div className="container" style={{ paddingTop: 48, paddingBottom: 96 }}>
        {title && (
          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: 'clamp(28px, 3.6vw, 40px)' }}>{title}</h1>
            {lede && <p className="lede" style={{ marginTop: 12 }}>{lede}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
