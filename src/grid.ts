export type Point = { x: number; y: number }
export type TileRect = { left: number; right: number; top: number; bottom: number }
export const GRID_WIDTH = 18
export const GRID_HEIGHT = 32
// Renderer/network coordinates are an adapter. Geometry is defined in tiles:
// origin top-left, X right, Y down; integers are cell centres.
export const toTile = (p: Point): Point => ({ x: .5 + p.y * 18 / 100, y: 31.5 - p.x * 32 / 100 })
export const fromTile = (p: Point): Point => ({ x: (31.5 - p.y) * 100 / 32, y: (p.x - .5) * 100 / 18 })
export const snapToTile = (p: Point): Point => {
  const t = toTile(p)
  return fromTile({ x: Math.round(t.x), y: Math.round(t.y) })
}
export function validTile(x: number, y: number) {
  return Number.isInteger(x) && Number.isInteger(y) &&
    ((x >= 1 && x <= 18 && y >= 1 && y <= 30) ||
      (x >= 6 && x <= 13 && (y === 0 || y === 31)))
}
export function walkablePoint(p: Point) {
  const t = toTile(p)
  if (!validTile(Math.round(t.x), Math.round(t.y))) return false
  return t.y < 14.5 || t.y > 16.5 ||
    (t.x >= 2.5 && t.x <= 5.5) || (t.x >= 13.5 && t.x <= 16.5)
}
export const tileDistance = (a: Point, b: Point) => {
  const p = toTile(a), q = toTile(b)
  return Math.hypot(p.x - q.x, p.y - q.y)
}
export const TILE_BUILDINGS = {
  redFortress: { left: 8, right: 11, top: 1, bottom: 4 },
  blueFortress: { left: 8, right: 11, top: 27, bottom: 30 },
  redPubOne: { left: 3, right: 5, top: 5, bottom: 7 },
  redPubTwo: { left: 14, right: 16, top: 5, bottom: 7 },
  bluePubOne: { left: 3, right: 5, top: 24, bottom: 26 },
  bluePubTwo: { left: 14, right: 16, top: 24, bottom: 26 },
} satisfies Record<string, TileRect>
export const rectCenter = (r: TileRect) => fromTile({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 })
export const insideRect = (p: Point, r: TileRect, padding = 0) => {
  const t = toTile(p)
  return t.x > r.left - .5 - padding && t.x < r.right + .5 + padding &&
    t.y > r.top - .5 - padding && t.y < r.bottom + .5 + padding
}
