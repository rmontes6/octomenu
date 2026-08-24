import { MANTLE_PATH_D, MARK_VIEWBOX, OCTOPUS_Y_SHIFT, PLATE_RINGS, SUCKERS, TENTACLES } from "@/lib/logoMark";

type Props = {
  /** Fill/stroke color for the whole mark (no per-part color mixing). */
  color: string;
  /** Include the circular plate rings around the octopus. Default: false. */
  showPlate?: boolean;
  /** Pixel size (mark is always square). */
  size: number;
};

// No hooks/client-only APIs: this renders identically in a real browser
// (NavBar) and inside a next/og ImageResponse tree (Satori).
export default function OctopusMark({ color, showPlate = false, size }: Props) {
  return (
    <svg width={size} height={size} viewBox={MARK_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
      {showPlate && (
        <g fill="none" stroke={color}>
          {PLATE_RINGS.map((ring, i) => (
            <circle key={i} cx={100} cy={100} r={ring.r} strokeWidth={ring.strokeWidth} opacity={ring.opacity} />
          ))}
        </g>
      )}
      <g transform={`translate(0, ${OCTOPUS_Y_SHIFT})`}>
        <path d={MANTLE_PATH_D} fill={color} fillRule="evenodd" />
        <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
          {TENTACLES.map((t, i) => (
            <path key={i} d={t.d} strokeWidth={t.strokeWidth} />
          ))}
        </g>
        <g stroke={color} strokeWidth={2.5} strokeLinecap="round">
          {SUCKERS.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
          ))}
        </g>
      </g>
    </svg>
  );
}
