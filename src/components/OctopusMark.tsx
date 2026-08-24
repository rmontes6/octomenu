import { MANTLE_PATH_D, MARK_VIEWBOX, OCTOPUS_TRANSFORM, PLATE_RINGS, TENTACLE_PATHS } from "@/lib/logoMark";

type Props = {
  /** Fill color for the whole mark (single tone, no stroke). */
  color: string;
  /** Include the circular plate rings around the octopus. Default: true — the plate is part of
   * the standard mark. Pass false only for very small/dense contexts where the rings turn to mud. */
  showPlate?: boolean;
  /** Pixel size (mark is always square). */
  size: number;
};

// No hooks/client-only APIs: this renders identically in a real browser
// (NavBar) and inside a next/og ImageResponse tree (Satori).
export default function OctopusMark({ color, showPlate = true, size }: Props) {
  return (
    <svg width={size} height={size} viewBox={MARK_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
      {showPlate && (
        <g fill="none" stroke={color}>
          {PLATE_RINGS.map((ring, i) => (
            <circle key={i} cx={100} cy={100} r={ring.r} strokeWidth={ring.strokeWidth} opacity={ring.opacity} />
          ))}
        </g>
      )}
      <g transform={OCTOPUS_TRANSFORM} fill={color}>
        {TENTACLE_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <path d={MANTLE_PATH_D} fillRule="evenodd" />
      </g>
    </svg>
  );
}
