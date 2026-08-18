export default function HorizonScene() {
  return (
    <svg
      viewBox="0 0 1440 640"
      preserveAspectRatio="xMidYMax slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B2340" />
          <stop offset="55%" stopColor="#17365D" />
          <stop offset="100%" stopColor="#2C4C74" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8C77A" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#C89B3C" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#C89B3C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="waveFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B2340" stopOpacity="0" />
          <stop offset="100%" stopColor="#0B2340" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <rect width="1440" height="640" fill="url(#sky)" />

      {/* halo solaire */}
      <circle cx="1080" cy="430" r="260" fill="url(#sunGlow)" />
      <circle cx="1080" cy="430" r="34" fill="#E8C77A" opacity="0.9" />

      {/* ligne d'horizon */}
      <line x1="0" y1="430" x2="1440" y2="430" stroke="#C89B3C" strokeWidth="1.5" opacity="0.75" />

      {/* vagues */}
      <path
        d="M0 470 C 220 440, 340 440, 520 468 C 720 500, 860 500, 1040 466 C 1200 436, 1320 436, 1440 460 L1440 640 L0 640 Z"
        fill="url(#waveFade)"
      />
      <path
        d="M0 500 C 220 470, 340 470, 520 498 C 720 530, 860 530, 1040 496 C 1200 466, 1320 466, 1440 490"
        stroke="#E8C77A"
        strokeWidth="1.2"
        opacity="0.4"
        fill="none"
      />
    </svg>
  )
}
