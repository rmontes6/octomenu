import { renderMarkImage } from "@/lib/logoMarkImage";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderMarkImage({ size: 180 });
}
