import { createHash } from "node:crypto";
import { MANTLE_PATH_D, TENTACLE_PATHS } from "@/lib/logoMark";

// Content hash of the octopus mark's path data. Used to version icon URLs by path segment
// (not just query string) — iOS Safari's Home Screen webclip icon cache is known to ignore
// query-string cache-busting on apple-touch-icon, so a path-only change is the reliable way
// to force a refetch after the mark artwork changes. Server-only (node:crypto): don't import
// this from anything that also renders client-side (e.g. OctopusMark.tsx).
export const MARK_VERSION = createHash("sha1")
  .update(MANTLE_PATH_D + TENTACLE_PATHS.join(""))
  .digest("hex")
  .slice(0, 8);
