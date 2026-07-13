/**
 * Zellige geometry.
 *
 * The eight-point khatim star is built the way the tilemakers build it — two
 * squares rotated 45° over each other — which fixes the inner radius at
 * √2 / (1 + √2) of the outer. Everything here is derived from that one ratio.
 */
const INNER = Math.SQRT2 / (1 + Math.SQRT2); // ≈ 0.5858

function starPoints(cx: number, cy: number, r: number, points = 8): string {
  const step = Math.PI / points;
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : r * INNER;
    const angle = i * step - Math.PI / 2;
    coords.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return coords.join(" ");
}

/** Tessellating star field. One flat colour, carried by the parent's opacity. */
export function ZelligePattern({ className }: { className?: string }) {
  const S = 120; // tile size
  return (
    <svg className={className} aria-hidden focusable="false">
      <defs>
        <pattern
          id="zellige-tile"
          width={S}
          height={S}
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" style={{ stroke: "var(--brass)" }} strokeWidth="1">
            <polygon points={starPoints(S / 2, S / 2, S * 0.34)} />
            <polygon points={starPoints(S / 2, S / 2, S * 0.19)} />
            {/* corner quarter-stars complete the tessellation across tiles */}
            <polygon points={starPoints(0, 0, S * 0.34)} />
            <polygon points={starPoints(S, 0, S * 0.34)} />
            <polygon points={starPoints(0, S, S * 0.34)} />
            <polygon points={starPoints(S, S, S * 0.34)} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#zellige-tile)" />
    </svg>
  );
}

/**
 * The signature: the khatim star as the grade dial.
 *
 * The ring reads the general average against the /20 scale, and the star sits
 * inside it — the Moroccan mention system rendered as Moroccan geometry.
 */
export function GradeStar({
  average,
  outOf = 20,
  mention,
  mentionLabel,
  averageLabel,
}: {
  average: number;
  outOf?: number;
  mention: string;
  mentionLabel: string;
  averageLabel: string;
}) {
  const size = 260;
  const c = size / 2;
  const ringR = 110;
  // The star is inscribed in the ring — its points just reach the track, so the
  // two read as one object rather than a star floating inside a circle.
  const starR = 100;
  const circumference = 2 * Math.PI * ringR;
  const filled = Math.min(Math.max(average / outOf, 0), 1);

  return (
    <figure className="relative mx-auto w-full max-w-[260px]">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full"
        role="img"
        aria-label={`${averageLabel}: ${average} / ${outOf} — ${mention}`}
      >
        {/* track */}
        <circle
          cx={c}
          cy={c}
          r={ringR}
          fill="none"
          style={{ stroke: "var(--ink-line)" }}
          strokeWidth="6"
        />
        {/* the average, drawn once on load */}
        <circle
          className="ring"
          cx={c}
          cy={c}
          r={ringR}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`}
          style={
            {
              stroke: "var(--brass)",
              "--dash": circumference,
              "--dash-end": circumference * (1 - filled),
            } as React.CSSProperties
          }
        />
        {/* khatim — one star, drawn to be seen */}
        <polygon
          points={starPoints(c, c, starR)}
          style={{ fill: "var(--ink-soft)" }}
          stroke="#33566b"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>

      <figcaption className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7f97a3]">
          {averageLabel}
        </span>
        <span className="figures display mt-1 text-[2.9rem] leading-none text-white">
          {average.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
        </span>
        <span className="mt-2 rounded-full bg-[var(--brass)] px-3 py-1 text-xs font-semibold text-[#1a1206]">
          {mention}
        </span>
        <span className="sr-only">{mentionLabel}</span>
      </figcaption>
    </figure>
  );
}
