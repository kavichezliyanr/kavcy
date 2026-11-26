export function KavcyEmblem({
  size = 44,
  active = false,
}: {
  size?: number;
  active?: boolean;
}) {
  return (
    <div
      className={`aegis-emblem ${active ? 'is-active' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" width={size} height={size} fill="none">
        <circle
          cx="32"
          cy="32"
          r="29"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1"
          strokeDasharray="4 6"
          className="aegis-ring-outer"
        />
        <circle
          cx="32"
          cy="32"
          r="23"
          stroke="currentColor"
          strokeOpacity="0.38"
          strokeWidth="1"
          strokeDasharray="14 10"
          className="aegis-ring-inner"
        />
        <path
          d="M32 13L46 19.5V31.5C46 40.2 40 47.4 32 51C24 47.4 18 40.2 18 31.5V19.5L32 13Z"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="currentColor"
          fillOpacity="0.08"
        />
        {/* Crisp Kavcy "K" Monogram inside the Lattice Shield */}
        <path
          d="M27 23V41M27 32L37 23M30.5 29L38 41"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="13" r="1.7" fill="currentColor" className="aegis-core" />
      </svg>
    </div>
  );
}
