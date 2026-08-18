import type { CSSProperties } from 'react'

interface LogoMarkProps {
  size?: number
  ink?: string
  gold?: string
}

export function LogoMark({ size = 36, ink = 'var(--navy)', gold = 'var(--gold)' }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M27 4 L38 4 L31 24 L38 44 L27 44 L20 24 Z" fill={ink} />
      <g clipPath="url(#sunclip)">
        <circle cx="27" cy="26" r="3.4" fill={gold} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <rect key={deg} x="26.3" y="16" width="1.4" height="6" fill={gold} transform={`rotate(${deg} 27 26)`} />
        ))}
      </g>
      <path d="M2 38 C 10 32, 18 32, 26 37 C 34 42, 42 38, 46 34" stroke={ink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M2 43 C 10 37, 18 37, 26 42 C 34 47, 42 43, 46 39" stroke={gold} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <defs>
        <clipPath id="sunclip">
          <path d="M27 4 L38 4 L31 24 L38 44 L27 44 L20 24 Z" />
        </clipPath>
      </defs>
    </svg>
  )
}

interface LogoProps {
  dark?: boolean
  size?: number
}

export function Logo({ dark = false, size = 32 }: LogoProps) {
  const ink = dark ? '#FFFFFF' : 'var(--navy)'
  const gold = 'var(--gold)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <LogoMark size={size} ink={ink} gold={gold} />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: size * 0.62,
          letterSpacing: '0.01em',
          color: dark ? '#FFFFFF' : 'var(--ink)',
          lineHeight: 1,
        } as CSSProperties}
      >
        Caledora <span style={{ color: dark ? 'var(--gold-light)' : 'var(--gold-dark)', fontStyle: 'normal' }}>Airways</span>
      </span>
    </span>
  )
}
