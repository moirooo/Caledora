interface RouteLineProps {
  originCode: string
  destinationCode: string
  stopLabel?: string
}

export default function RouteLine({ originCode, destinationCode, stopLabel = 'Direct' }: RouteLineProps) {
  return (
    <div className="route-line">
      <span className="route-line__code">{originCode}</span>
      <span className="route-line__track" aria-hidden="true">
        <svg viewBox="0 0 100 20" preserveAspectRatio="none">
          <line x1="2" y1="14" x2="98" y2="14" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="1 4" />
          <circle cx="50" cy="14" r="1.6" fill="var(--gold)" />
          <path d="M42 14 L50 8 L58 14 L50 12 Z" fill="var(--gold-dark)" />
        </svg>
      </span>
      <span className="route-line__stop">{stopLabel}</span>
      <span className="route-line__track" aria-hidden="true">
        <svg viewBox="0 0 100 20" preserveAspectRatio="none">
          <line x1="2" y1="14" x2="98" y2="14" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="1 4" />
        </svg>
      </span>
      <span className="route-line__code">{destinationCode}</span>
    </div>
  )
}
