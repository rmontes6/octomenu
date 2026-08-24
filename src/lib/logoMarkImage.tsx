import { ImageResponse } from "next/og";
import OctopusMark from "@/components/OctopusMark";

const BRAND_GRADIENT = "linear-gradient(180deg, #f97316 0%, #c2410c 55%, #9a3412 100%)";
const MARK_CREAM = "#fdf3e7";

type RenderMarkImageOptions = {
  size: number;
  /** Fraction of `size` occupied by the mark's own bounding box (0-1). */
  markScale?: number;
  background?: string;
  color?: string;
  showPlate?: boolean;
};

export function renderMarkImage({
  size,
  markScale = 0.82,
  background = BRAND_GRADIENT,
  color = MARK_CREAM,
  showPlate = true,
}: RenderMarkImageOptions) {
  const markSize = Math.round(size * markScale);
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
        }}
      >
        <OctopusMark color={color} showPlate={showPlate} size={markSize} />
      </div>
    ),
    { width: size, height: size }
  );
}
