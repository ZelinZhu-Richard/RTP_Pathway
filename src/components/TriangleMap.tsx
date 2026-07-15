const EDGES = [
  { id: "durham-chapelhill", d: "M190,96 L118,300", delay: "0s" },
  { id: "chapelhill-raleigh", d: "M118,300 L428,252", delay: "0.3s" },
  { id: "raleigh-durham", d: "M428,252 L190,96", delay: "0.6s" },
];

const CITIES = [
  { name: "Durham", x: 190, y: 96, labelX: 190, labelY: 70 },
  { name: "Chapel Hill", x: 118, y: 300, labelX: 118, labelY: 332 },
  { name: "Raleigh", x: 428, y: 252, labelX: 428, labelY: 232 },
];

// Unlabeled: Carrboro, Morrisville, Cary.
const SATELLITES = [
  { x: 92, y: 316 },
  { x: 322, y: 258 },
  { x: 352, y: 292 },
];

// One amber dot per edge — opportunities moving between the three cities.
const DRIFTERS = [
  { edge: EDGES[0].d, dur: "13s", begin: "-4s" },
  { edge: EDGES[1].d, dur: "16s", begin: "-9s" },
  { edge: EDGES[2].d, dur: "14s", begin: "-1s" },
];

// Where the drifting dots rest when the visitor prefers reduced motion.
const STATIC_DOTS = [
  { x: 154, y: 198 },
  { x: 273, y: 276 },
  { x: 309, y: 174 },
];

/**
 * The Research Triangle drawn as a living map-diagram: the three anchor cities
 * in (roughly) true geographic arrangement, edges that draw themselves in, and
 * amber "opportunity" dots drifting between them. Pure SVG + CSS/SMIL — no JS.
 */
export function TriangleMap() {
  return (
    <svg
      viewBox="0 0 520 440"
      className="h-auto w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="tri-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="245" cy="216" r="215" fill="url(#tri-glow)" />

      <polygon points="190,96 118,300 428,252" fill="#ffffff" opacity="0.04" />

      {EDGES.map((edge) => (
        <path
          key={edge.id}
          d={edge.d}
          pathLength={1}
          className="tri-edge"
          style={{ animationDelay: edge.delay }}
          stroke="#5eead4"
          strokeOpacity="0.4"
          strokeWidth="1.5"
          fill="none"
        />
      ))}

      {/* Research Triangle Park sits between the three cities. */}
      <g transform="translate(258 190)">
        <rect
          x="-4"
          y="-4"
          width="8"
          height="8"
          transform="rotate(45)"
          fill="none"
          stroke="#99f6e4"
          strokeOpacity="0.7"
          strokeWidth="1.25"
        />
        <text
          y="-14"
          textAnchor="middle"
          fill="#99f6e4"
          fillOpacity="0.6"
          fontSize="10"
          letterSpacing="3"
          fontFamily="var(--font-geist-mono)"
        >
          RTP
        </text>
      </g>

      {SATELLITES.map((dot) => (
        <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r="2.5" fill="#2dd4bf" opacity="0.45" />
      ))}

      {CITIES.map((city, i) => (
        <g key={city.name}>
          <circle
            cx={city.x}
            cy={city.y}
            r="10"
            fill="#2dd4bf"
            className="tri-node-pulse"
            style={{ animationDelay: `${i * 1.1}s` }}
          />
          <circle cx={city.x} cy={city.y} r="4.5" fill="#e9f4f1" />
          <text
            x={city.labelX}
            y={city.labelY}
            textAnchor="middle"
            fill="#99f6e4"
            fontSize="11"
            letterSpacing="3"
            fontFamily="var(--font-geist-mono)"
          >
            {city.name.toUpperCase()}
          </text>
        </g>
      ))}

      {DRIFTERS.map((drifter) => (
        <g key={drifter.edge + drifter.dur} className="tri-dot">
          <circle r="7" fill="#fbbf24" opacity="0.25" />
          <circle r="3" fill="#fbbf24" />
          <animateMotion
            path={drifter.edge}
            dur={drifter.dur}
            begin={drifter.begin}
            repeatCount="indefinite"
          />
        </g>
      ))}

      {STATIC_DOTS.map((dot) => (
        <g key={`static-${dot.x}`} className="tri-dot-static">
          <circle cx={dot.x} cy={dot.y} r="7" fill="#fbbf24" opacity="0.25" />
          <circle cx={dot.x} cy={dot.y} r="3" fill="#fbbf24" />
        </g>
      ))}
    </svg>
  );
}
