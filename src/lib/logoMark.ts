// Single source of truth for the octopus-in-a-plate mark's coordinates.
// 200x200 native coordinate space; MARK_VIEWBOX frames it with a small margin.

export const MARK_VIEWBOX = "6 6 188 188";

// Applied to the octopus group only, to recenter it inside the plate ring.
export const OCTOPUS_Y_SHIFT = -9;

// Mantle body + two eye holes (evenodd cutout).
export const MANTLE_PATH_D = `
  M70,108 Q55,70 78,45 Q100,32 122,45 Q145,70 130,108 Q100,122 70,108 Z
  M76,68 a6,7 0 1,0 12,0 a6,7 0 1,0 -12,0 Z
  M112,68 a6,7 0 1,0 12,0 a6,7 0 1,0 -12,0 Z
`;

// Fallback if the evenodd eye cutout doesn't render correctly under Satori:
// a solid mantle outline (no eye subpaths) plus two eye ellipses to paint on
// top in the surrounding background color instead.
export const MANTLE_OUTLINE_ONLY_D = `
  M70,108 Q55,70 78,45 Q100,32 122,45 Q145,70 130,108 Q100,122 70,108 Z
`;
export const EYE_HOLES = [
  { cx: 82, cy: 68, rx: 6, ry: 7 },
  { cx: 118, cy: 68, rx: 6, ry: 7 },
] as const;

export interface TentaclePath {
  d: string;
  strokeWidth: number;
}
export const TENTACLES: TentaclePath[] = [
  { d: "M60,98 Q35,90 30,70 Q28,55 42,60", strokeWidth: 9 },
  { d: "M70,108 Q45,125 40,150 Q38,162 50,165", strokeWidth: 10 },
  { d: "M82,115 Q95,140 130,168 Q145,178 138,185", strokeWidth: 11 },
  { d: "M94,118 Q88,145 78,172 Q74,182 84,186", strokeWidth: 9 },
  { d: "M106,118 Q112,145 122,172 Q126,182 116,186", strokeWidth: 9 },
  { d: "M118,115 Q105,140 70,168 Q55,178 62,185", strokeWidth: 11 },
  { d: "M130,108 Q155,125 160,150 Q162,162 150,165", strokeWidth: 10 },
  { d: "M140,98 Q165,90 170,70 Q172,55 158,60", strokeWidth: 9 },
];

export interface SuckerLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
// Suckers only on the two front tentacles.
export const SUCKERS: SuckerLine[] = [
  { x1: 92, y1: 138, x2: 99, y2: 144 },
  { x1: 107, y1: 153, x2: 114, y2: 159 },
  { x1: 122, y1: 168, x2: 129, y2: 174 },
  { x1: 108, y1: 138, x2: 101, y2: 144 },
  { x1: 93, y1: 153, x2: 86, y2: 159 },
  { x1: 78, y1: 168, x2: 71, y2: 174 },
];

export interface PlateRing {
  r: number;
  strokeWidth: number;
  opacity: number;
}
export const PLATE_RINGS: PlateRing[] = [
  { r: 88, strokeWidth: 6, opacity: 1 },
  { r: 74, strokeWidth: 2.5, opacity: 0.5 },
];
