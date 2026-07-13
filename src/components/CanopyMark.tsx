import { useId } from 'react';

/**
 * CanopyStudio brand mark — growth bars fanning into a canopy dome (a rising
 * chart that reads as a tree) with a lime "reach" spark. Ported from the
 * Claude Design brand-mark export ("Canopy Studio Logo.html").
 *
 * Renders the app-icon lockup by default: the mark on a pine rounded-square
 * tile, which reads on any background (this is the placeholder the old
 * `.logo-mark` "C" square stood in for). Pass `tile={false}` for the bare
 * mark on an already-branded surface.
 *
 * The palette: Pine #0E3B2B · Canopy #1E7A56 · Growth #43C77E · Spark #B7F05B.
 */
type Props = {
  /** Rendered pixel size (square). Default 22 to match the old `.logo-mark`. */
  size?: number;
  /** Draw the pine rounded-square tile behind the mark. Default true. */
  tile?: boolean;
  className?: string;
  title?: string;
};

// Native mark bbox spans roughly x15–105 / y22–110 in the 120 viewBox; scale it
// toward the tile centre so it sits with even padding inside the rounded square.
const MARK_SCALE = 0.62;

// Symmetric bars: [x, y, height]. Widths are all 10, radius 5.
const BARS: [number, number, number][] = [
  [15, 66, 26],
  [31, 50, 42],
  [47, 34, 58],
  [63, 26, 66],
  [79, 34, 58],
  [95, 50, 42],
];

export function CanopyMark({ size = 22, tile = true, className, title }: Props) {
  const uid = useId().replace(/:/g, '');
  const barGrad = `cm-bar-${uid}`;
  const tileGrad = `cm-tile-${uid}`;
  // On the dark pine tile, use the brighter growth→spark gradient so the mark
  // stays legible; on a bare (light) surface, use the pine→growth gradient.
  const stops = tile
    ? [
        { o: 0, c: '#2E8B67' },
        { o: 0.55, c: '#43C77E' },
        { o: 1, c: '#B7F05B' },
      ]
    : [
        { o: 0, c: '#0E3B2B' },
        { o: 0.55, c: '#1E7A56' },
        { o: 1, c: '#43C77E' },
      ];
  const stemFill = tile ? '#2E8B67' : '#0E3B2B';
  const sparkFill = tile ? '#DAFB9A' : '#B7F05B';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, display: 'block' }}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={barGrad} x1="0" y1="1" x2="0" y2="0">
          {stops.map((s) => (
            <stop key={s.o} offset={s.o} stopColor={s.c} />
          ))}
        </linearGradient>
        {tile ? (
          <linearGradient id={tileGrad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0E3B2B" />
            <stop offset="1" stopColor="#13492F" />
          </linearGradient>
        ) : null}
      </defs>

      {tile ? <rect x="0" y="0" width="120" height="120" rx="30" fill={`url(#${tileGrad})`} /> : null}

      <g transform={`translate(60 60) scale(${MARK_SCALE}) translate(-60 -60)`}>
        {/* trunk / stem */}
        <rect x="59" y="90" width="8" height="20" rx="4" fill={stemFill} />
        {BARS.map(([x, y, h]) => (
          <rect key={x} x={x} y={y} width="10" height={h} rx="5" fill={`url(#${barGrad})`} />
        ))}
        {/* reach spark */}
        <circle cx="68" cy="22" r="5" fill={sparkFill} />
      </g>
    </svg>
  );
}
