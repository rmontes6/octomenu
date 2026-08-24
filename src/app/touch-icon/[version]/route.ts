import { renderMarkImage } from "@/lib/logoMarkImage";

// The [version] segment isn't read — it only exists so the URL path itself changes when the
// mark artwork changes (see MARK_VERSION), which is what actually busts iOS's Home Screen
// icon cache. Always renders the current mark, so even a stale-but-still-resolvable old
// version path serves the up-to-date image rather than 404ing.
export async function GET() {
  return renderMarkImage({ size: 180 });
}
