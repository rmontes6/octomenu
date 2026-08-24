import { createHash } from "node:crypto";
import type { MetadataRoute } from "next";
import { MANTLE_PATH_D, TENTACLE_PATHS } from "@/lib/logoMark";

// pwa-icon responses are served with a far-future immutable Cache-Control, and the manifest
// URLs are otherwise static, so a browser that already fetched them before a mark redesign
// would keep serving the stale cached image forever (unlike icon.svg/apple-icon, which Next
// auto-versions with a content-hash query param). Append the same kind of hash by hand here
// so changing the mark busts the cache on next deploy.
const MARK_VERSION = createHash("sha1").update(MANTLE_PATH_D + TENTACLE_PATHS.join("")).digest("hex").slice(0, 8);

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OctoMenu",
    short_name: "OctoMenu",
    description: "Generador de menús semanales y lista de la compra",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f1ed",
    theme_color: "#f97316",
    icons: [
      { src: `/pwa-icon/192?v=${MARK_VERSION}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/pwa-icon/512?v=${MARK_VERSION}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/pwa-icon/512?v=${MARK_VERSION}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
