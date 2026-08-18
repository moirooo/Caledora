interface StepTrackerProps {
  steps: string[]
  currentIndex: number
}

export default function StepTracker({ steps, currentIndex }: StepTrackerProps) {
  return (
    <ol className="step-tracker" aria-label="Étapes de la réservation">
      {steps.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming'
        return (
          <li key={step} className={`step-tracker__item step-tracker__item--${state}`}>
            <span className="step-tracker__dot">{i < currentIndex ? '✓' : i + 1}</span>
            <span className="step-tracker__label">{step}</span>
            {i < steps.length - 1 && <span className="step-tracker__line" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}
