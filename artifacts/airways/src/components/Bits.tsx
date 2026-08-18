interface SectionHeadingProps {
  eyebrow?: string
  title: string
  lede?: string
  align?: 'left' | 'center'
}

export function SectionHeading({ eyebrow, title, lede, align = 'left' }: SectionHeadingProps) {
  return (
    <div className={`section-heading section-heading--${align}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {lede && <p className="lede">{lede}</p>}
    </div>
  )
}

interface PageHeaderProps {
  eyebrow?: string
  title: string
  lede?: string
}

export function PageHeader({ eyebrow, title, lede }: PageHeaderProps) {
  return (
    <section className="section--navy" style={{ paddingTop: 160, paddingBottom: 72 }}>
      <div className="container">
        <span className="eyebrow" style={{ marginBottom: 20, display: 'inline-flex' }}>{eyebrow}</span>
        <h1 style={{ fontSize: 'clamp(34px, 4.4vw, 54px)', maxWidth: '18ch' }}>{title}</h1>
        {lede && <p className="lede" style={{ marginTop: 20 }}>{lede}</p>}
      </div>
    </section>
  )
}

interface Stat {
  label: string
  value: string
  suffix?: string
}

interface StatGridProps {
  stats: Stat[]
}

export function StatGrid({ stats }: StatGridProps) {
  return (
    <div className="stat-grid">
      {stats.map((s) => (
        <div className="stat" key={s.label}>
          <span className="stat__value">{s.value}</span>
          <span className="stat__label">{s.label}</span>
          {s.suffix && <span className="stat__suffix">{s.suffix}</span>}
        </div>
      ))}
    </div>
  )
}
