export type Card = { name: string; role: string; cost: number; icon: string; color: string; damage: number; hp: number; speed: number; range: number; rate: number; rarity: string; count?: number; scale?: number; kind?: 'unit' | 'spell' | 'building'; hidden?: boolean }
import { fromTile, toTile, snapToTile, snapBuildingToTile, validTile, walkablePoint, tileDistance, TILE_BUILDINGS, rectCenter, insideRect, buildingRectAt } from './grid.ts'
import type { TileRect } from './grid.ts'
export type Side = 'blue' | 'red'
export type UnitState = 'advance' | 'bridge' | 'pursue' | 'surround' | 'attack' | 'siege'
export type MoveDirection = 'forward' | 'backward' | 'left' | 'right' | 'forward-left' | 'forward-right' | 'backward-left' | 'backward-right'
export type Unit = { id: number; lane: number; x: number; y: number; side: Side; card: Card; hp: number; cooldown: number; routeIndex: number; state: UnitState; moveDirection: MoveDirection; targetId?: number; attackTargetId?: number; goalBuilding?: BuildingKey; preferredPub?: BuildingKey; siegeBuilding?: BuildingKey; siegeStructureId?: number; moving: boolean; facingBack: boolean; lateralOffset?: number; spawnDelay?: number; spawnDuration?: number }
export type SausageDrop = { id: number; x: number; y: number; age: number }
export type Structure = { id: number; x: number; y: number; side: Side; card: Card; hp: number; max: number; cooldown: number; age: number }
export function laneRoute(side: Side, lane: number) {
  const x = lane === 0 ? 4 : 15
  return [{ x, y: 18 }, { x, y: 13 }, { x, y: 9.5 }, { x, y: 6 }, { x, y: 4 }, { x: 9.5, y: 2.5 }]
    .map(p => fromTile({ x: p.x, y: side === 'blue' ? p.y : 31 - p.y }))
}
export type Flare = { id: number; source: BuildingKey; side: Side; target: number; x: number; y: number; age: number }
export const FLARE_FLIGHT = .65
export const FLARE_INTERVAL = 1.5
export const GATLING_INTERVAL = .8
export const GATLING_ATTACK_RANGE = 34
export const FLARE_DAMAGE = 30
// Pub guards should open fire as soon as an enemy clears the bridge.
// The bridge-to-pub distance is about 25 renderer units, with a small
// margin so units cannot slip past the lane entrance before the first shot.
export const PUB_ATTACK_RANGE = 28
export const MOVEMENT_SPEED_FACTOR = .92
export const UNIT_ALERT_RADIUS = 16
export const UNIT_PURSUIT_RADIUS = 24
export const FLITZER_DECOY_RADIUS = 24
export const UNIT_COLLISION_DISTANCE = 3.5
export const SAUSAGE_LIFETIME = 2.4
const BRIDGE_START_X = 46.5
const BRIDGE_END_X = 53.5
const BRIDGE_QUEUE_APPROACH = 16
export const BLOOD_STAIN_LIFETIME = 3.2
export const SPELL_FLIGHT = 1.8
export const SMOKE_RADIUS = 18
export const SMOKE_DAMAGE_PER_SECOND = 30
export const SIGNAL_RADIUS = 4
export const SALVO_RADIUS = 15
export const SIGNAL_BUILDING_DAMAGE = 220
export const LATE_BUILDING_DAMAGE_MULTIPLIER = 1.8
export const SUDDEN_DEATH_BUILDING_DAMAGE_MULTIPLIER = 4
export const SUDDEN_DEATH_DURATION = 30
export const BEER_FLIGHT = .5
export const PUDDLE_LIFETIME = 2.4
export type BuildingTarget = BuildingKey | `stall:${number}`
export type Beer = { id: number; fromX: number; fromY: number; x: number; y: number; target: number | BuildingTarget; damage: number; age: number }
export type Torch = Beer & { side: Side }
export type Spell = { id: number; type: 'smoke' | 'signal' | 'salvo' | 'beer-shower'; side: Side; x: number; y: number; fromX: number; fromY: number; age: number; applied?: boolean }
export type DamageEvent = { id: number; x: number; y: number; amount: number; kind: 'hit' | 'area' | 'heal' | 'building'; age: number }
export const TORCH_FLIGHT = .6
export const FIRE_LIFETIME = 3
export const BEER_STALL_DECAY = 30
export const BEER_STALL_SPAWN_INTERVAL = 5
export const cards: Card[] = [
  { name: 'Der Ultra', role: 'Nahkämpfer', cost: 3, icon: '✦', color: '#ef8d32', damage: 55, hp: 430, speed: 5.2, range: 3, rate: .8, rarity: 'Common' },
  { name: 'Der Capo', role: '+25% Schaden für Verbündete', cost: 5, icon: '♛', color: '#d64d45', damage: 65, hp: 620, speed: 4.5, range: 3, rate: 1, rarity: 'Legendary' },
  { name: 'Bierbecher-Werfer', role: 'Mittlere Reichweite', cost: 2, icon: '◈', color: '#e4bd43', damage: 35, hp: 220, speed: 5, range: 10, rate: .9, rarity: 'Common' },
  { name: 'Kutten-Garde', role: 'Tank', cost: 4, icon: '⬟', color: '#536c99', damage: 45, hp: 1100, speed: 3.5, range: 3, rate: 1.1, rarity: 'Rare' },
  { name: 'Der Trommler', role: 'Heilt nahe Verbündete', cost: 3, icon: '◉', color: '#ba4a8b', damage: 22, hp: 340, speed: 5, range: 9, rate: 1, rarity: 'Epic' },
  { name: 'Auswärtsfahrer', role: 'Schneller Angreifer', cost: 4, icon: '➤', color: '#398a78', damage: 70, hp: 420, speed: 10, range: 3, rate: .7, rarity: 'Rare' },
  { name: 'Der Ordner', role: 'Verlangsamt nahe Gegner', cost: 3, icon: '✚', color: '#6e7d52', damage: 40, hp: 600, speed: 4, range: 4, rate: 1, rarity: 'Rare' },
  { name: 'Pyro-Fan', role: 'Flächenschaden', cost: 5, icon: '♨', color: '#db5938', damage: 85, hp: 360, speed: 4.5, range: 11, rate: 1.3, rarity: 'Epic' },
  { name: 'Rauchbombe', role: 'Verlangsamt und verhüllt', cost: 3, icon: '◌', color: '#85877c', damage: 225, hp: 1, speed: 0, range: 0, rate: 0, rarity: 'Rare', kind: 'spell' },
  { name: 'Leuchtrakete', role: 'Markiert und schädigt Gegner', cost: 2, icon: '✹', color: '#f1a642', damage: 220, hp: 1, speed: 0, range: 0, rate: 0, rarity: 'Common', kind: 'spell' },
  { name: 'Bengalo-Salve', role: 'Mehrfacher Flächenschaden', cost: 6, icon: '♨', color: '#e85b36', damage: 300, hp: 1, speed: 0, range: 0, rate: 0, rarity: 'Epic', kind: 'spell' },
  { name: 'Bierdusche', role: 'Heilt Freunde und bremst Feinde', cost: 3, icon: '☂', color: '#d5a53b', damage: 0, hp: 1, speed: 0, range: 0, rate: 0, rarity: 'Rare', kind: 'spell' },
  { name: 'Zaunbrecher', role: 'Schwerer Gebäudestürmer', cost: 5, icon: '⚒', color: '#8d604b', damage: 110, hp: 950, speed: 2.8, range: 3, rate: 1.2, rarity: 'Rare' },
  { name: 'Megafon-Capo', role: 'Verstärkt nahe Verbündete', cost: 4, icon: '📣', color: '#b94f48', damage: 28, hp: 500, speed: 4, range: 3, rate: 1, rarity: 'Epic', hidden: true },
  { name: 'Auswärtsblock', role: 'Vier schnelle Fans', cost: 5, icon: '➤', color: '#3f8d7b', damage: 20, hp: 150, speed: 7.5, range: 3, rate: .8, rarity: 'Rare' },
  { name: 'Pyro-Trupp', role: 'Drei mobile Bengalo-Werfer', cost: 6, icon: '♨', color: '#d95b3b', damage: 55, hp: 260, speed: 4.5, range: 11, rate: 1.3, rarity: 'Epic' },
  { name: 'Bierbude', role: 'Verliert Leben und spawnt alle 5s Bierbecher-Werfer', cost: 4, icon: '▣', color: '#c99b42', damage: 0, hp: 600, speed: 0, range: 0, rate: 5, rarity: 'Rare', kind: 'building' },
  { name: 'Würstchenverkäufer', role: 'Aggressiver Nahkämpfer aus der Würstchenbude', cost: 0, icon: '♨', color: '#d47b3c', damage: 92, hp: 560, speed: 4.2, range: 3, rate: .7, rarity: 'Rare', hidden: true },
  { name: 'Würstchenbude', role: 'Lockt Gegner an; spawnt beim Einsturz einen Verkäufer', cost: 4, icon: '▤', color: '#b87843', damage: 0, hp: 760, speed: 0, range: 0, rate: 0, rarity: 'Rare', kind: 'building' },
  { name: 'Flitzer', role: 'Schneller Gebäudestürmer und Ablenkung', cost: 5, icon: '●', color: '#c58f72', damage: 25, hp: 1500, speed: 4.8, range: 3, rate: 1.2, rarity: 'Epic' },
  { name: 'Fanmarsch', role: 'Geschlossener Gebäudetank mit Banner', cost: 6, icon: '⚑', color: '#7d8f9b', damage: 24, hp: 2600, speed: 1.55, range: 3, rate: 1.4, rarity: 'Legendary' },
  { name: 'Nachwuchs', role: 'Fünfzehn winzige Nachwuchsfans', cost: 3, icon: '✣', color: '#65a9d6', damage: 10, hp: 35, speed: 5, range: 1, rate: .9, rarity: 'Common', count: 15, scale: .44 },
]
export const AI_DECK = [0, 2, 3, 5, 7, 9, 16, 20]
export type BuildingKey = 'blueFortress' | 'redFortress' | 'bluePubOne' | 'bluePubTwo' | 'redPubOne' | 'redPubTwo'
export const buildings: { key: BuildingKey; side: Side; x: number; y: number; max: number }[] = [
  { key: 'blueFortress', side: 'blue', ...rectCenter(TILE_BUILDINGS.blueFortress), max: 2400 },
  { key: 'redFortress', side: 'red', ...rectCenter(TILE_BUILDINGS.redFortress), max: 2400 },
  { key: 'bluePubOne', side: 'blue', ...rectCenter(TILE_BUILDINGS.bluePubOne), max: 1200 },
  { key: 'bluePubTwo', side: 'blue', ...rectCenter(TILE_BUILDINGS.bluePubTwo), max: 1200 },
  { key: 'redPubOne', side: 'red', ...rectCenter(TILE_BUILDINGS.redPubOne), max: 1200 },
  { key: 'redPubTwo', side: 'red', ...rectCenter(TILE_BUILDINGS.redPubTwo), max: 1200 },
]
export type Game = { time: number; overtime: number; hype: number; redHype: number; aiHype: number; aiClock: number; aiDeck: number[]; aiLastCard?: number; multiplayer: boolean; units: Unit[]; structures: Structure[]; hp: Record<BuildingKey, number>; queue: number[]; redQueue: number[]; id: number; result: string | null; endingCountdown?: number; endingResult?: string; log: string[]; shots: number; totalDamage: number; damageEvents: DamageEvent[]; flares: Flare[]; impacts: { id: number; x: number; y: number; age: number }[]; blood: { id: number; x: number; y: number; age: number }[]; bloodStains: { id: number; x: number; y: number; age: number }[]; spells: Spell[]; buildingCooldown: Record<BuildingKey, number>; beers: Beer[]; puddles: { id: number; x: number; y: number; age: number }[]; torches: Torch[]; fires: { id: number; x: number; y: number; age: number }[]; sausages: SausageDrop[] }
export function newGame(deck: number[], aiDeck = AI_DECK, multiplayer = false, redDeck = aiDeck): Game {
  return { time: 180, overtime: 0, hype: 7, redHype: 7, aiHype: 7, aiClock: 2, aiDeck: [...aiDeck], aiLastCard: undefined, multiplayer, units: [], structures: [], hp: Object.fromEntries(buildings.map(b => [b.key, b.max])) as Game['hp'], queue: [...deck], redQueue: [...redDeck], id: 1, result: null, log: ['Anpfiff! Jede Lane führt über die gegnerische Kneipe.'], shots: 0, totalDamage: 0, damageEvents: [], flares: [], impacts: [], blood: [], bloodStains: [], spells: [], buildingCooldown: Object.fromEntries(buildings.map(b => [b.key, 0])) as Game['buildingCooldown'], beers: [], puddles: [], torches: [], fires: [], sausages: [] }
}
const spellType = (card: Card): Spell['type'] | undefined => ({ 8: 'smoke', 9: 'signal', 10: 'salvo', 11: 'beer-shower' } as Record<number, Spell['type']>)[cards.indexOf(card)]
export const unitCount = (card: Card) => card.count ?? (cards.indexOf(card) === 14 ? 4 : cards.indexOf(card) === 15 ? 3 : 1)
export const cardUnitOffsets = (card: Card) => {
  const count = unitCount(card)
  return count === 15
    ? [
      { x: -2.4, y: -4.8 }, { x: -2.4, y: -2.4 }, { x: -2.4, y: 0 }, { x: -2.4, y: 2.4 }, { x: -2.4, y: 4.8 },
      { x: 0, y: -4.8 }, { x: 0, y: -2.4 }, { x: 0, y: 0 }, { x: 0, y: 2.4 }, { x: 0, y: 4.8 },
      { x: 2.4, y: -4.8 }, { x: 2.4, y: -2.4 }, { x: 2.4, y: 0 }, { x: 2.4, y: 2.4 }, { x: 2.4, y: 4.8 },
    ]
    : count === 4 ? [{ x: 0, y: 0 }, { x: 0, y: -2.8 }, { x: 0, y: 2.8 }, { x: 0, y: -5.4 }]
      : count === 3 ? [{ x: 0, y: 0 }, { x: 0, y: -3 }, { x: 0, y: 3 }]
        : [{ x: 0, y: 0 }]
}
function makeUnits(startId: number, x: number, y: number, side: Side, lane: number, card: Card) {
  const count = unitCount(card)
  const offsets = cardUnitOffsets(card)
  const routeIndex = side === 'blue' ? x > 58 ? 2 : 0 : x < 42 ? 2 : 0
  const baseDelay = card.name === 'Nachwuchs' ? 0 : card.name === 'Flitzer' || card.name === 'Fanmarsch' ? 2 : 1
  const stagger = card.name === 'Nachwuchs' ? 0 : .16
  return offsets.map((offset, index) => {
    const memberX = Math.max(4, Math.min(96, x + offset.x))
    const memberY = Math.max(4, Math.min(96, y + offset.y))
    const memberLane = card.name === 'Nachwuchs' ? (memberY < 49 ? 0 : 1) : lane
    return {
      id: startId + index, x: memberX, y: memberY, lane: memberLane, card, side, hp: card.hp,
      cooldown: 0, routeIndex, state: 'advance', moveDirection: 'forward', moving: false, facingBack: true,
      spawnDelay: baseDelay + index * stagger, spawnDuration: baseDelay + index * stagger,
    } satisfies Unit
  })
}
function structureSpawnLane(structure: Structure) {
  const tile = toTile(structure)
  return Math.abs(tile.x - 4) <= Math.abs(tile.x - 15) ? 0 : 1
}
function structureSpawnPoint(structure: Structure) {
  const tile = toTile(structure)
  // Leave through the side of the stall facing the owning half before
  // steering horizontally toward the nearest lane.
  return fromTile({
    x: tile.x,
    y: tile.y + (structure.side === 'blue' ? 2 : -2),
  })
}
const activeUnit = (unit: Unit) => unit.hp > 0 && (unit.spawnDelay ?? 0) <= 0
const targetableUnit = (unit: Unit) => unit.hp > 0
export function deploymentPoint(g: Game, card: Card, x: number, y: number, side: Side = 'blue') {
  let point = card.kind === 'building' ? snapBuildingToTile({ x, y }) : snapToTile({ x, y })
  if (card.kind === 'spell') return point
  const tile = toTile(point)
  const enemy = side === 'blue' ? 'red' : 'blue'
  const pub = `${enemy}Pub${tile.x < 9.5 ? 'One' : 'Two'}` as BuildingKey
  const captured = g.hp[pub] <= 0
  const allowed = (xTile: number, yTile: number) => side === 'blue'
    ? yTile >= 17 || (captured && yTile >= 7 && yTile <= 14)
    : yTile <= 14 || (captured && yTile >= 17 && yTile <= 24)
  const boundary = side === 'blue' ? 17 : 14
  if (!allowed(tile.x, tile.y)) {
    const targetY = captured ? (side === 'blue' ? 7 : 24) : boundary
    point = card.kind === 'building'
      ? snapBuildingToTile(fromTile({ x: tile.x, y: targetY }))
      : snapToTile(fromTile({ x: tile.x, y: targetY }))
  }
  if (canDeploy(g, card, point.x, point.y, side)) return point
  let fallback: { x: number; y: number } | undefined
  let bestDistance = Infinity
  for (let xTile = 0; xTile < 18; xTile++) for (let yTile = 0; yTile < 32; yTile++) {
    if (!allowed(xTile, yTile)) continue
    const candidate = card.kind === 'building'
      ? snapBuildingToTile(fromTile({ x: xTile, y: yTile }))
      : snapToTile(fromTile({ x: xTile, y: yTile }))
    if (!canDeploy(g, card, candidate.x, candidate.y, side)) continue
    const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      fallback = candidate
    }
  }
  return fallback ?? point
}
export function canDeploy(g: Game, card: Card, x: number, y: number, side: Side = 'blue') {
  if (!card || !Number.isFinite(x) || !Number.isFinite(y)) return false
  const snapped = card.kind === 'building' ? snapBuildingToTile({ x, y }) : snapToTile({ x, y })
  const tile = toTile(snapped)
  if (!validTile(Math.round(tile.x), Math.round(tile.y))) return false
  x = snapped.x
  y = snapped.y
  if (card.kind === 'spell') return true
  if (!walkablePoint(snapped) || (tile.y >= 15 && tile.y <= 16)) return false
  const clearance = card.kind === 'building' ? .5 : 0
  if (solidBuildings(g).some(b => insideRect(snapped, b.rect, clearance))) return false
  if (card.kind === 'building') {
    const cells = [-.5, .5].flatMap(dx => [-.5, .5].map(dy => ({ x: tile.x + dx, y: tile.y + dy })))
    if (!cells.every(cell => validTile(Math.round(cell.x), Math.round(cell.y)) && walkablePoint(fromTile(cell)))) return false
    // The two end rows are behind the respective clubhouses and are not
    // buildable, even though they are valid deployment tiles for units.
    if (side === 'blue' ? tile.y + .5 > 30.5 : tile.y - .5 < .5) return false
  }
  const enemy = side === 'blue' ? 'red' : 'blue'
  const pub = `${enemy}Pub${tile.x < 9.5 ? 'One' : 'Two'}` as BuildingKey
  const ownHalf = side === 'blue' ? tile.y >= 17 : tile.y <= 14
   const captured = g.hp[pub] <= 0 && (side === 'blue' ? tile.y >= 7 && tile.y <= 14 : tile.y >= 17 && tile.y <= 24)
  return ownHalf || (card.kind !== 'building' && captured)
}
export function deploy(g: Game, slot: number, x: number, y: number, side: Side = 'blue'): Game {
  const queuedCard = cards[(side === 'blue' ? g.queue : g.redQueue)[slot]]
  const snapped = queuedCard?.kind === 'building' ? snapBuildingToTile({ x, y }) : snapToTile({ x, y })
  x = snapped.x
  y = snapped.y
  const queueKey = side === 'blue' ? 'queue' : 'redQueue'
  const hypeKey = side === 'blue' ? 'hype' : 'redHype'
  const queue = [...g[queueKey]]
  const card = cards[queue[slot]]
  if (g.result || !card || g[hypeKey] < card.cost || !canDeploy(g, card, x, y, side)) return g
  queue.push(queue.splice(slot, 1)[0])
  const type = spellType(card)
  const update = { ...g, [hypeKey]: g[hypeKey] - card.cost, [queueKey]: queue, id: g.id + 1, log: [`${side === 'blue' ? 'Du' : 'Gegner'}: ${card.name}`, ...g.log].slice(0, 4) }
  if (type) return { ...update, spells: [...g.spells, { id: g.id, type, side, x, y, fromX: side === 'blue' ? 5 : 95, fromY: 50, age: 0 }] }
  if (card.kind === 'building') {
    const structure: Structure = { id: g.id, x, y, side, card, hp: card.hp, max: card.hp, cooldown: 0, age: 0 }
    if (card === cards[16]) {
      const spawn = structureSpawnPoint(structure)
      const spawned = makeUnits(g.id + 1, spawn.x, spawn.y, side, structureSpawnLane(structure), cards[2])
        .map(unit => ({ ...unit, spawnDelay: 0, spawnDuration: 0 }))
      return { ...update, structures: [...g.structures, structure], units: [...g.units, ...spawned], id: g.id + 1 + spawned.length }
    }
    return { ...update, structures: [...g.structures, structure] }
  }
  const units: Unit[] = makeUnits(g.id, x, y, side, y < 49 ? 0 : 1, card)
  const deploymentTile = toTile({ x, y })
  const enemySide = side === 'blue' ? 'red' : 'blue'
  const capturedArea = side === 'blue'
    ? deploymentTile.y >= 7 && deploymentTile.y <= 14
    : deploymentTile.y >= 17 && deploymentTile.y <= 24
  const lanePub = `${enemySide}Pub${y < 49 ? 'One' : 'Two'}` as BuildingKey
  const otherPub = `${enemySide}Pub${y < 49 ? 'Two' : 'One'}` as BuildingKey
  const preferredPub = capturedArea && g.hp[lanePub] <= 0 && g.hp[otherPub] > 0 ? otherPub : undefined
  const solids = solidBuildings(g)
  for (const unit of units) {
    resolveBuildings(unit, solids)
    if (preferredPub) unit.preferredPub = preferredPub
    if (card.name === 'Nachwuchs') unit.lane = unit.y < 49 ? 0 : 1
  }
  return { ...update, id: g.id + units.length, units: [...g.units, ...units] }
}
// Legacy balance values convert at 3.125 units/tile; both axes use the same tile metric.
const distance = (a: {x: number; y: number}, b: {x: number; y: number}) => tileDistance(a, b) * 100 / 32
type Solid = { x: number; y: number; radius: number; rect: TileRect }
// Ground footprints include a small unit clearance, not the roof/sprite height.
export function solidBuildings(g: Game): Solid[] {
  return [
    ...buildings.filter(b => g.hp[b.key] > 0).map(b => ({
      x: b.x, y: b.y, radius: b.key.includes('Fortress') ? 9 : 7, rect: TILE_BUILDINGS[b.key],
    })),
    ...g.structures.filter(s => s.hp > 0).map(s => {
      return { x: s.x, y: s.y, radius: 3.5, rect: buildingRectAt(s) }
    }),
  ]
}

function resolveBuildings(u: Unit, solids: Solid[]) {
  for (let pass = 0; pass < 4; pass++) for (const b of solids) {
    if (!insideRect(u, b.rect, .18)) continue
    const p = toTile(u)
    const edges = [
      { x: b.rect.left - .681, y: p.y }, { x: b.rect.right + .681, y: p.y },
      { x: p.x, y: b.rect.top - .681 }, { x: p.x, y: b.rect.bottom + .681 },
    ].filter(t => walkablePoint(fromTile(t)))
    edges.sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y))
    if (edges[0]) Object.assign(u, fromTile(edges[0]))
  }
}

function avoidBuildings(u: Unit, goal: { x: number; y: number }, solids: Solid[]) {
  const start = toTile(u), end = toTile(goal)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length < .001) return goal
  const blocked = solids.map(b => {
    const p = toTile(b)
    const radius = Math.hypot((b.rect.right - b.rect.left + 1) / 2, (b.rect.bottom - b.rect.top + 1) / 2) + .25
    const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / (length * length)))
    return { b, p, radius, t, gap: Math.hypot(start.x + dx * t - p.x, start.y + dy * t - p.y) }
  }).filter(({ b, radius, t, gap }) => t > 0 && gap < radius && !insideRect(goal, b.rect, .2))
    .sort((a, b) => a.t - b.t)[0]
  if (!blocked) return goal
  const b = blocked.p
  const radius = blocked.radius + .4
  // Pick a side of the footprint perpendicular to the intended travel direction.
  const options = [-1, 1].map(sign => ({
    x: b.x - dy / length * radius * sign,
    y: b.y + dx / length * radius * sign,
  })).map(fromTile).filter(walkablePoint)
  options.sort((a, b) => distance(u, a) + distance(a, goal) - distance(u, b) - distance(b, goal))
  return options[0] ?? goal
}
function findPathWaypoint(u: Unit, goal: { x: number; y: number }, solids: Solid[]) {
  const directDistance = distance(u, goal)
  const samples = Math.max(1, Math.ceil(directDistance / 2))
  const directPathClear = Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples
    const point = { x: u.x + (goal.x - u.x) * t, y: u.y + (goal.y - u.y) * t }
    return walkablePoint(point) && !solids.some(s => insideRect(point, s.rect, .12))
  }).every(Boolean)
  if (directPathClear) return goal

  const start = toTile(u)
  const end = toTile(goal)
  const startCell = { x: Math.round(start.x), y: Math.round(start.y) }
  const endCell = { x: Math.round(end.x), y: Math.round(end.y) }
  const key = (x: number, y: number) => `${x},${y}`
  const blocked = (x: number, y: number) => {
    if (!validTile(x, y) || !walkablePoint(fromTile({ x, y }))) return true
    return solids.some(s =>
      x > s.rect.left - .5 && x < s.rect.right + .5 &&
      y > s.rect.top - .5 && y < s.rect.bottom + .5)
  }
  if (blocked(endCell.x, endCell.y)) return avoidBuildings(u, goal, solids)

  const open = [{ x: startCell.x, y: startCell.y, score: 0 }]
  const cameFrom = new Map<string, string>()
  const cost = new Map<string, number>([[key(startCell.x, startCell.y), 0]])
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  while (open.length) {
    open.sort((a, b) => a.score - b.score)
    const current = open.shift()!
    if (current.x === endCell.x && current.y === endCell.y) {
      const path: Array<{ x: number; y: number }> = [endCell]
      let cursor = key(endCell.x, endCell.y)
      while (cameFrom.has(cursor)) {
        const previous = cameFrom.get(cursor)!
        const [x, y] = previous.split(',').map(Number)
        path.push({ x, y })
        cursor = previous
      }
      path.reverse()
      const next = path[1]
      return next ? fromTile(next) : goal
    }
    const currentKey = key(current.x, current.y)
    const currentCost = cost.get(currentKey) ?? Infinity
    for (const [dx, dy] of neighbors) {
      const x = current.x + dx
      const y = current.y + dy
      if (blocked(x, y)) continue
      const nextKey = key(x, y)
      const nextCost = currentCost + 1
      if (nextCost >= (cost.get(nextKey) ?? Infinity)) continue
      cost.set(nextKey, nextCost)
      cameFrom.set(nextKey, currentKey)
      open.push({ x, y, score: nextCost + Math.abs(endCell.x - x) + Math.abs(endCell.y - y) })
    }
  }
  return avoidBuildings(u, goal, solids)
}
const recordDamage = (g: Game, point: { x: number; y: number }, amount: number, kind: DamageEvent['kind']) => {
  if (amount > 0) { g.totalDamage += amount; g.damageEvents.push({ id: g.id++, x: point.x, y: point.y, amount, kind, age: 0 }) }
}
const buildingDamageMultiplier = (g: Game) =>
  g.time <= 0 ? SUDDEN_DEATH_BUILDING_DAMAGE_MULTIPLIER :
    g.time <= 60 ? LATE_BUILDING_DAMAGE_MULTIPLIER : 1
const spellLifetime = (type: Spell['type']) => type === 'smoke' ? 7.5 : type === 'beer-shower' ? 3.4 : type === 'salvo' ? 2.5 : 1.9
function separateUnits(units: Unit[]) {
  // Resolve softly in a few passes so a crowd forms a loose row instead of a stack.
  // Y is the lane width, therefore the preferred escape direction is sideways.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < units.length; i++) {
      const a = units[i]
      if (!activeUnit(a)) continue
      for (let j = i + 1; j < units.length; j++) {
        const b = units[j]
        if (!activeUnit(b)) continue
        // Nachwuchs surrounds enemy units instead of pushing them away.
        // Friendly Nachwuchs still separates softly to keep the swarm readable.
        if (a.side !== b.side && (a.card.name === 'Nachwuchs' || b.card.name === 'Nachwuchs')) continue
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d = Math.hypot(dx, dy)
        const compactCrowd = a.card.name === 'Nachwuchs' && b.card.name === 'Nachwuchs'
        const collisionDistance = compactCrowd ? .9 : UNIT_COLLISION_DISTANCE
        if (d >= collisionDistance) continue
        const aKeepsRoute = ['Flitzer', 'Fanmarsch'].includes(a.card.name)
        const bKeepsRoute = ['Flitzer', 'Fanmarsch'].includes(b.card.name)
        // Route-locked units never get pushed sideways, but regular units
        // must still be able to step around them and continue past them.
        if (aKeepsRoute && bKeepsRoute) continue
        // Engaged enemies only separate while they are actually overlapping.
        // Once they have a stable combat gap, repeated sideways pushes make a
        // melee unit jitter while chasing a Flitzer.
        if (a.side !== b.side && d > 2.8 && (a.card.name === 'Flitzer' || b.card.name === 'Flitzer') && (a.targetId === b.id || b.targetId === a.id)) continue
         const side = a.id < b.id ? -1 : 1
         // Bridge traffic gets one small route correction instead of an
         // immediate Y move plus a second lateral offset. The old double
         // correction made units counter-steer on alternating ticks.
         const bridgePair = inBridgeQueueArea(a) && inBridgeQueueArea(b) &&
           a.side === b.side && a.lane === b.lane
         const nudge = (collisionDistance - d) * (compactCrowd ? .12 : .08)
         if (!bridgePair && !aKeepsRoute && walkablePoint({ x: a.x, y: a.y + side * nudge })) a.y += side * nudge
         if (!bridgePair && !bKeepsRoute && walkablePoint({ x: b.x, y: b.y - side * nudge })) b.y -= side * nudge
         const offset = Math.min(
           compactCrowd ? 1 : bridgePair ? 1.8 : 3.8,
           Math.max(compactCrowd ? .12 : bridgePair ? .18 : .45,
             (collisionDistance - d) * (compactCrowd ? .18 : bridgePair ? .16 : .28)),
         )
        if (!aKeepsRoute) {
          a.lateralOffset = Math.max(-4, Math.min(4, (a.lateralOffset ?? 0) + side * offset))
          a.moving = true
        }
        if (!bKeepsRoute) {
          b.lateralOffset = Math.max(-4, Math.min(4, (b.lateralOffset ?? 0) - side * offset))
          b.moving = true
        }
      }
    }
  }
}
function inBridgeQueueArea(unit: Unit) {
  const min = BRIDGE_START_X - BRIDGE_QUEUE_APPROACH
  const max = BRIDGE_END_X + 3
  return unit.x >= min && unit.x <= max
}
function beforeBridge(unit: Unit) {
  return unit.side === 'blue' ? unit.x < BRIDGE_END_X : unit.x > BRIDGE_START_X
}
function bridgeUnitAhead(unit: Unit, units: Unit[]) {
  if (!inBridgeQueueArea(unit)) return undefined
  return units
    .filter(other => other !== unit && activeUnit(other) && other.side === unit.side && other.lane === unit.lane && inBridgeQueueArea(other))
    // Stationary ranged units may fire from the bridge approach, but they
    // must not become a wall for the melee units moving in behind them.
    .filter(other => other.card.range <= 4)
    .filter(other => {
      const compactPair = unit.card.name === 'Nachwuchs' && other.card.name === 'Nachwuchs'
      const sideBySide = Math.abs(other.y - unit.y) >= 1.8
      return !compactPair || !sideBySide
    })
    .map(other => ({
      other,
      gap: unit.side === 'blue' ? other.x - unit.x : unit.x - other.x,
    }))
    .filter(({ gap }) => gap > 1 && gap < BRIDGE_QUEUE_APPROACH + 8)
    .sort((a, b) => a.gap - b.gap)[0]?.other
}
// Pursuit may leave a lane, but must still use a bridge to cross the canal.
function pursuitWaypoint(u: Unit, target: Unit) {
  const a = toTile(u), b = toTile(target)
  if ((a.y < 14.5 && b.y < 14.5) || (a.y > 16.5 && b.y > 16.5)) return target
  const bridge = u.lane === 0 ? 4 : 15
  if (Math.abs(a.x - bridge) < .2) return fromTile({ x: bridge, y: b.y < a.y ? 13 : 18 })
  return fromTile({ x: bridge, y: a.y < 15.5 ? 13 : 18 })
}
function surroundWaypoint(u: Unit, target: Unit) {
  const targetTile = toTile(target)
  if (targetTile.y >= 14.5 && targetTile.y <= 16.5) return pursuitWaypoint(u, target)
  // Spread stable slots around the complete circle, including the rear side.
  const slot = Math.abs((u.id * 7 + target.id * 3) % 16)
  const angle = slot * Math.PI * 2 / 16
  const point = { x: target.x + Math.cos(angle) * .9, y: target.y + Math.sin(angle) * .9 }
  return walkablePoint(point) ? point : target
}
export function tick(previous: Game, dt: number, random = Math.random): Game {
  if (previous.result) return previous
  const g: Game = { ...previous, overtime: previous.time <= 0 ? previous.overtime + dt : 0, hp: { ...previous.hp }, structures: previous.structures.map(s => ({ ...s, cooldown: Math.max(0, s.cooldown - dt), age: s.age + dt })), units: previous.units.map(u => ({ ...u, moving: false, spawnDelay: Math.max(0, (u.spawnDelay ?? 0) - dt) })), log: [...previous.log], buildingCooldown: { ...previous.buildingCooldown }, damageEvents: previous.damageEvents.map(e => ({ ...e, age: e.age + dt })).filter(e => e.age < .9), flares: [], impacts: previous.impacts.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < .45), blood: previous.blood.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < .58), bloodStains: previous.bloodStains.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < BLOOD_STAIN_LIFETIME), spells: previous.spells.map(s => ({ ...s, age: s.age + dt })).filter(s => s.age < spellLifetime(s.type)), beers: [], puddles: previous.puddles.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < PUDDLE_LIFETIME), torches: [], fires: previous.fires.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < FIRE_LIFETIME), sausages: (previous.sausages ?? []).map(s => ({ ...s, age: s.age + dt })).filter(s => s.age < SAUSAGE_LIFETIME) }
  if (g.endingCountdown !== undefined) g.endingCountdown -= dt
  for (const old of previous.torches) {
     const target = typeof old.target === 'number' ? g.units.find(u => u.id === old.target && targetableUnit(u)) : undefined
    const torch = { ...old, age: old.age + dt, x: target?.x ?? old.x, y: target?.y ?? old.y }
    if (torch.age + 1e-9 < TORCH_FLIGHT) g.torches.push(torch)
    else {
       if (typeof torch.target === 'string') {
         const stall = torch.target.startsWith('stall:') ? g.structures.find(s => `stall:${s.id}` === torch.target) : undefined
          const damage = torch.damage * buildingDamageMultiplier(g)
          if (stall) { stall.hp = Math.max(0, stall.hp - damage); recordDamage(g, stall, damage, 'building') }
          else { g.hp[torch.target as BuildingKey] = Math.max(0, g.hp[torch.target as BuildingKey] - damage); const b = buildings.find(b => b.key === torch.target); if (b) recordDamage(g, b, damage, 'building') }
       }
      for (const u of g.units) {
         if (u.side !== torch.side && targetableUnit(u) && distance(u, torch) < 9) { const amount = u.id === torch.target ? torch.damage : torch.damage * .6; u.hp -= amount; recordDamage(g, u, amount, 'area') }
      }
      g.fires.push({ id: torch.id, x: torch.x, y: torch.y, age: 0 })
      g.impacts.push({ id: torch.id, x: torch.x, y: torch.y, age: 0 })
      g.shots++
    }
  }
  for (const old of previous.beers) {
     const target = typeof old.target === 'number' ? g.units.find(u => u.id === old.target && targetableUnit(u)) : undefined
    const beer = { ...old, age: old.age + dt, x: target?.x ?? old.x, y: target?.y ?? old.y }
    if (beer.age + 1e-9 < BEER_FLIGHT) g.beers.push(beer)
    else {
      if (target) { target.hp -= beer.damage; recordDamage(g, target, beer.damage, 'hit') }
       else if (typeof beer.target === 'string') {
         const stall = beer.target.startsWith('stall:') ? g.structures.find(s => `stall:${s.id}` === beer.target) : undefined
          const damage = beer.damage * buildingDamageMultiplier(g)
          if (stall) { stall.hp = Math.max(0, stall.hp - damage); recordDamage(g, stall, damage, 'building') }
          else { g.hp[beer.target as BuildingKey] = Math.max(0, g.hp[beer.target as BuildingKey] - damage); const b = buildings.find(b => b.key === beer.target); if (b) recordDamage(g, b, damage, 'building') }
       }
      g.puddles.push({ id: beer.id, x: beer.x, y: beer.y, age: 0 })
      g.shots++
    }
  }
  for (const old of previous.flares) {
       const target = g.units.find(u => u.id === old.target && targetableUnit(u))
    const flare = { ...old, age: old.age + dt, x: target?.x ?? old.x, y: target?.y ?? old.y }
    if (flare.age + 1e-9 < FLARE_FLIGHT) g.flares.push(flare)
    else {
      for (const u of g.units) {
        if (u.side !== flare.side && distance(u, flare) <= 4) u.hp -= u.id === flare.target ? FLARE_DAMAGE : 15
      }
      g.impacts.push({ id: flare.id, x: flare.x, y: flare.y, age: 0 })
      g.shots++
    }
  }
  for (const spell of g.spells) {
    if (spell.type === 'signal' && spell.age >= SPELL_FLIGHT && !spell.applied) {
       for (const u of g.units) if (u.side !== spell.side && targetableUnit(u) && distance(u, spell) <= SIGNAL_RADIUS) { u.hp -= cards[9].damage; recordDamage(g, u, cards[9].damage, 'area') }
        const damage = SIGNAL_BUILDING_DAMAGE * buildingDamageMultiplier(g)
        for (const b of buildings) if (b.side !== spell.side && g.hp[b.key] > 0 && distance(b, spell) <= SIGNAL_RADIUS) { g.hp[b.key] = Math.max(0, g.hp[b.key] - damage); recordDamage(g, b, damage, 'building') }
        for (const b of g.structures) if (b.side !== spell.side && b.hp > 0 && distance(b, spell) <= SIGNAL_RADIUS) { b.hp = Math.max(0, b.hp - damage); recordDamage(g, b, damage, 'building') }
      g.impacts.push({ id: spell.id, x: spell.x, y: spell.y, age: 0 })
      spell.applied = true
    } else if (spell.type === 'salvo' && spell.age >= SPELL_FLIGHT && !spell.applied) {
         for (const u of g.units) if (u.side !== spell.side && targetableUnit(u) && distance(u, spell) <= SALVO_RADIUS) { u.hp -= cards[10].damage; recordDamage(g, u, cards[10].damage, 'area') }
          const damage = cards[10].damage * buildingDamageMultiplier(g)
          for (const b of g.structures) if (b.side !== spell.side && b.hp > 0 && distance(b, spell) <= SALVO_RADIUS) { b.hp = Math.max(0, b.hp - damage); recordDamage(g, b, damage, 'building') }
      g.fires.push({ id: spell.id, x: spell.x - 2, y: spell.y, age: 0 })
      g.fires.push({ id: spell.id + 1, x: spell.x + 2, y: spell.y + 2, age: 0 })
      g.impacts.push({ id: spell.id, x: spell.x, y: spell.y, age: 0 })
      spell.applied = true
    } else if (spell.type === 'smoke' && spell.age >= SPELL_FLIGHT && spell.age < spellLifetime('smoke')) {
      for (const u of g.units) {
          if (u.side !== spell.side && targetableUnit(u) && distance(u, spell) <= SMOKE_RADIUS) { const amount = SMOKE_DAMAGE_PER_SECOND * dt; u.hp -= amount; if (Math.floor(spell.age * 2) !== Math.floor((spell.age - dt) * 2)) recordDamage(g, u, amount * 2, 'area') }
      }
    } else if (spell.type === 'beer-shower' && spell.age >= SPELL_FLIGHT && spell.age < 2.8) {
      for (const u of g.units) {
         if (u.side === spell.side && activeUnit(u) && distance(u, spell) <= 18) { const amount = Math.min(u.card.hp - u.hp, 35 * dt); u.hp += amount; if (amount > 0 && Math.floor(spell.age * 2) !== Math.floor((spell.age - dt) * 2)) recordDamage(g, u, amount * 2, 'heal') }
      }
    }
  }
  g.time = Math.max(0, g.time - dt)
  const sausageDropTick = Math.floor(previous.time * 3) !== Math.floor(g.time * 3)
  const regen = g.time <= 60 ? .95 : .48
  g.hype = Math.min(10, g.hype + dt * regen)
  if (g.multiplayer) g.redHype = Math.min(10, g.redHype + dt * regen)
  g.aiHype = Math.min(10, g.aiHype + dt * regen)
  g.aiClock -= dt
  if (!g.multiplayer && g.aiClock <= 0) {
    g.aiClock = 2 + random() * 2
      const affordable = g.aiDeck
        .map((index, slot) => ({ index, slot, card: cards[index] }))
        .filter(entry => entry.card.cost <= g.aiHype && (g.aiDeck.length < 2 || entry.index !== g.aiLastCard))
      if (affordable.length) {
        const choice = affordable[0]
        const card = choice.card
        const nextDeck = [...g.aiDeck]
        nextDeck.splice(choice.slot, 1)
        nextDeck.push(choice.index)
        g.aiDeck = nextDeck
        g.aiLastCard = choice.index
        const lane = random() < .5 ? 0 : 1
        const type = spellType(card)
        if (type) {
           const enemy = g.units.filter(u => u.side === 'blue' && targetableUnit(u)).sort((a, b) => b.x - a.x)[0]
          const preferredPub = buildings.find(b => b.key === `bluePub${lane === 0 ? 'One' : 'Two'}` && g.hp[b.key] > 0)
           const fallback = preferredPub
             ?? buildings.find(b => (b.key === 'bluePubOne' || b.key === 'bluePubTwo') && g.hp[b.key] > 0)
             ?? buildings.find(b => b.key === 'blueFortress' && g.hp[b.key] > 0)
           const target = enemy ?? fallback
           if (target) g.spells.push({ id: g.id++, type, side: 'red', x: target.x, y: target.y, fromX: 95, fromY: 50, age: 0 })
        } else if (card.kind === 'building') {
          const p = fromTile({ x: lane === 0 ? 7 : 12, y: 10 })
          if (canDeploy(g, card, p.x, p.y, 'red')) g.structures.push({ id: g.id++, ...p, side: 'red', card, hp: card.hp, max: card.hp, cooldown: 0, age: 0 })
        } else {
          const p = fromTile({ x: lane === 0 ? 4 : 15, y: 10 })
          const units = makeUnits(g.id, p.x, p.y, 'red', lane, card)
         g.units.push(...units)
         g.id += units.length
       }
       g.aiHype -= card.cost
       g.log = [`KiezKalle: ${card.name}`, ...g.log].slice(0, 4)
    }
  }
  for (const structure of g.structures) {
    if (structure.hp <= 0 || (structure.card !== cards[16] && structure.card !== cards[18])) continue
    structure.hp -= BEER_STALL_DECAY * dt
    if (structure.card !== cards[16]) continue
    while (structure.age + 1e-9 >= BEER_STALL_SPAWN_INTERVAL && structure.hp > 0) {
      structure.age -= BEER_STALL_SPAWN_INTERVAL
       const lane = structureSpawnLane(structure)
       const spawn = structureSpawnPoint(structure)
       const spawned = makeUnits(g.id, spawn.x, spawn.y, structure.side, lane, cards[2])
        .map(unit => ({ ...unit, spawnDelay: 0, spawnDuration: 0 }))
      g.units.push(...spawned)
      g.id += spawned.length
      g.log = [`${structure.side === 'blue' ? 'Deine' : 'KiezKalle'}: Bierbecher-Werfer aus Bierbude`, ...g.log].slice(0, 4)
    }
  }
  for (const structure of g.structures) {
    if (structure.hp > 0 || structure.card !== cards[18]) continue
    const lane = structureSpawnLane(structure)
    const spawn = structureSpawnPoint(structure)
    const spawned = makeUnits(g.id, spawn.x, spawn.y, structure.side, lane, cards[17])
      .map(unit => ({ ...unit, spawnDelay: 0, spawnDuration: 0 }))
    g.units.push(...spawned)
    g.id += spawned.length
    g.log = [`Würstchenbude zerstört: Verkäufer greift an`, ...g.log].slice(0, 4)
  }
  g.structures = g.structures.filter(s => s.hp > 0)
  for (const u of g.units) {
    if (!activeUnit(u)) continue
    if (u.card.name === 'Nachwuchs') u.lane = u.y < 49 ? 0 : 1
    // Steering offsets are temporary course corrections, not permanent lane
    // changes. Let them ease back toward the preferred route every tick.
     const bridgeTraffic = inBridgeQueueArea(u)
     u.lateralOffset = (u.lateralOffset ?? 0) * Math.max(0, 1 - dt * (bridgeTraffic ? 2.2 : 5))
    u.cooldown -= dt
    const allies = g.units.filter(v => v.side === u.side && activeUnit(v) && distance(u, v) < 13)
    const matchEnding = g.endingCountdown !== undefined
    const marchTank = u.card.name === 'Fanmarsch'
    const enemySide = u.side === 'blue' ? 'red' : 'blue'
    const lanePub = buildings.find(b => b.key === `${enemySide}Pub${u.lane === 0 ? 'One' : 'Two'}`)!
    const preferredPub = u.preferredPub ? buildings.find(b => b.key === u.preferredPub && g.hp[b.key] > 0) : undefined
    const pub = preferredPub ?? lanePub
    const routeGoal = g.hp[pub.key] > 0 ? pub : buildings.find(b => b.key === `${enemySide}Fortress`)!
    if (u.goalBuilding && g.hp[u.goalBuilding] <= 0) u.goalBuilding = undefined
    const lockedGoal = u.goalBuilding ? buildings.find(b => b.key === u.goalBuilding && g.hp[b.key] > 0) : undefined
    const goal = lockedGoal ?? routeGoal
    if (u.siegeBuilding && g.hp[u.siegeBuilding] <= 0) u.siegeBuilding = undefined
    if (u.siegeStructureId && !g.structures.some(s => s.id === u.siegeStructureId && s.hp > 0)) u.siegeStructureId = undefined
    if (u.attackTargetId && !g.units.some(v => v.id === u.attackTargetId && v.side !== u.side && targetableUnit(v))) {
      u.attackTargetId = undefined
    }
    const siegeBuilding = u.siegeBuilding ? buildings.find(b => b.key === u.siegeBuilding && g.hp[b.key] > 0) : undefined
    const siegeStructure = u.siegeStructureId ? g.structures.find(s => s.id === u.siegeStructureId && s.hp > 0) : undefined
    const siegeLocked = !!siegeBuilding || !!siegeStructure || !!lockedGoal
     const enemies = marchTank || siegeLocked ? [] : g.units.filter(v => v.side !== u.side && targetableUnit(v))
    const designatedTarget = u.targetId
      ? enemies.find(v => v.id === u.targetId)
      : undefined
    const attackLocked = u.attackTargetId
      ? enemies.find(v => v.id === u.attackTargetId)
      : undefined
    if (u.card === cards[4]) for (const a of allies) a.hp = Math.min(a.card.hp, a.hp + 12 * dt)
    let target = attackLocked ?? designatedTarget
    let structureTarget = siegeStructure
    // Select exactly the nearest valid target once. The decision is locked
    // until that target is destroyed; new spawns cannot distract the unit.
    if (!target && !structureTarget && !marchTank && !siegeLocked) {
      const nearestEnemy = enemies
        .filter(v => distance(u, v) <= UNIT_PURSUIT_RADIUS)
        .sort((a, b) => distance(u, a) - distance(u, b))[0]
      const nearestStructure = g.structures
        .filter(s => s.side !== u.side && s.hp > 0 && distance(u, s) <= UNIT_PURSUIT_RADIUS)
        .sort((a, b) => distance(u, a) - distance(u, b))[0]
      const candidates = [
        nearestEnemy ? { kind: 'unit' as const, value: nearestEnemy, distance: distance(u, nearestEnemy) } : undefined,
        nearestStructure ? { kind: 'structure' as const, value: nearestStructure, distance: distance(u, nearestStructure) } : undefined,
        { kind: 'building' as const, value: goal, distance: distance(u, goal) },
      ].filter(Boolean).sort((a, b) => a!.distance - b!.distance)
      const nearest = candidates[0]
      if (nearest?.kind === 'unit') target = nearest.value
      else if (nearest?.kind === 'structure') {
        structureTarget = nearest.value
        u.siegeStructureId = nearest.value.id
      } else if (nearest?.kind === 'building') {
        u.goalBuilding = nearest.value.key
      }
    }
    // A locked building objective controls route selection, but units must
    // still use their lane waypoints and bridges instead of cutting directly
    // across the arena.
    const pointTarget = target ?? structureTarget
    const escortTank = !target && !structureTarget && u.card.name !== 'Flitzer' && beforeBridge(u)
      ? g.units
        .filter(v => v !== u && v.side === u.side && v.card.name === 'Fanmarsch' && activeUnit(v) && v.lane === u.lane)
        .filter(v => u.side === 'blue' ? v.x > u.x + 1 : v.x < u.x - 1)
        .filter(v => beforeBridge(v))
        .filter(v => {
          const tankEnemySide = v.side === 'blue' ? 'red' : 'blue'
          const tankPub = buildings.find(b => b.key === `${tankEnemySide}Pub${v.lane === 0 ? 'One' : 'Two'}`)!
          const tankGoal = g.hp[tankPub.key] > 0 ? tankPub : buildings.find(b => b.key === `${tankEnemySide}Fortress`)!
          const atMainBuilding = v.routeIndex >= (tankGoal === tankPub ? 2 : 4) &&
            distance(v, tankGoal) <= v.card.range + 8
          const atStructure = g.structures.some(s => s.side !== v.side && s.hp > 0 &&
            distance(v, s) <= v.card.range + 1)
          return !atMainBuilding && !atStructure
        })
        .sort((a, b) => distance(u, a) - distance(u, b))[0]
      : undefined
    if (target) u.targetId = target.id
    const bridgeTarget = !!target && (() => {
      const tile = toTile(target)
      return tile.y >= 14.5 && tile.y <= 16.5
    })()
    const beerFenceShot = false
    const inRange = !!pointTarget && distance(u, pointTarget) <= u.card.range +
      (u.card.name === 'Nachwuchs' ? 0 : bridgeTarget ? 2 : beerFenceShot ? 4 : 1)
    const focus = pointTarget ?? siegeBuilding ?? (u.routeIndex >= 2 ? goal : undefined)
     // Keep the bridge orientation stable while units make small lateral
     // corrections. Outside the bridge, target direction can still turn them.
     if (focus && !bridgeTraffic) u.facingBack = u.side === 'blue' ? focus.x > u.x : focus.x < u.x
    const atBuilding = u.routeIndex >= (goal === pub ? 2 : 4) && distance(u, goal) <= u.card.range + 8
    if (!target && !structureTarget && atBuilding && !u.siegeBuilding) u.siegeBuilding = goal.key
    const onBridge = (() => {
      const tile = toTile(u)
      return tile.y >= 14.5 && tile.y <= 16.5
    })()
    if (target) u.state = inRange ? 'attack' : u.card.name === 'Nachwuchs' ? 'surround' : 'pursue'
    else if (structureTarget || siegeBuilding || atBuilding) u.state = 'siege'
    else if (onBridge || (beforeBridge(u) && !!bridgeUnitAhead(u, g.units))) u.state = 'bridge'
    else u.state = 'advance'
    if (!matchEnding && (inRange || (!pointTarget && atBuilding))) {
      if (u.cooldown <= 0) {
        const damage = u.card.damage * (allies.some(a => a.card === cards[1]) ? 1.25 : 1)
        if (u.card === cards[2]) {
          g.beers.push({ id: g.id++, fromX: u.x, fromY: u.y, x: (pointTarget ?? goal).x, y: (pointTarget ?? goal).y, target: target ? target.id : structureTarget ? `stall:${structureTarget.id}` : goal.key, damage, age: 0 })
        } else if (u.card === cards[7] || u.card === cards[15]) {
          g.torches.push({ id: g.id++, fromX: u.x, fromY: u.y, x: (pointTarget ?? goal).x, y: (pointTarget ?? goal).y, target: target ? target.id : structureTarget ? `stall:${structureTarget.id}` : goal.key, side: u.side, damage, age: 0 })
        } else if (target) {
          target.hp -= damage
          if (target.hp > 0) u.attackTargetId = target.id
          recordDamage(g, target, damage, u.card.range <= 4 ? 'hit' : 'area')
          if (u.card.range <= 4) g.blood.push({ id: g.id++, x: target.x, y: target.y, age: 0 })
          } else if (structureTarget) {
            if (!u.siegeStructureId) u.siegeStructureId = structureTarget.id
            const buildingDamage = damage * buildingDamageMultiplier(g)
            structureTarget.hp -= buildingDamage
            recordDamage(g, structureTarget, buildingDamage, 'building')
          } else {
            if (!u.siegeBuilding) u.siegeBuilding = goal.key
            const buildingDamage = damage * buildingDamageMultiplier(g)
           g.hp[goal.key] = Math.max(0, g.hp[goal.key] - buildingDamage)
           recordDamage(g, goal, buildingDamage, 'building')
         }
        u.cooldown = u.card.rate
        g.shots++
      }
    } else {
      const route = laneRoute(u.side, u.lane)
      let routeIndex = u.routeIndex
      if (!pointTarget) {
        while (routeIndex < route.length - 1 &&
          (u.side === 'blue' ? u.x > route[routeIndex].x + 1 : u.x < route[routeIndex].x - 1)) routeIndex++
      }
      const bridgeLane = route[0]
      const bridgeEntryX = u.side === 'blue' ? BRIDGE_START_X : BRIDGE_END_X
      const nearBridge = u.side === 'blue'
        ? u.x > bridgeEntryX - BRIDGE_QUEUE_APPROACH
        : u.x < bridgeEntryX + BRIDGE_QUEUE_APPROACH
      // If a unit reaches the fence beside its lane, do not pull it back
      // diagonally to the old lane waypoint. Move along the fence first,
      // then cross through the matching bridge opening.
      const fenceApproach = !pointTarget && routeIndex >= 1 && beforeBridge(u) && nearBridge &&
        Math.abs(u.y - bridgeLane.y) > 1.5
        ? { x: u.x, y: bridgeLane.y }
        : undefined
      const rawWaypoint = target
        ? u.card.name === 'Nachwuchs' ? surroundWaypoint(u, target) : pursuitWaypoint(u, target)
        : structureTarget
          ? structureTarget
          : fenceApproach ?? route[routeIndex]
      const routeWaypoint = target || fenceApproach
        ? rawWaypoint
        : { x: rawWaypoint.x, y: rawWaypoint.y + (u.lateralOffset ?? 0) }
      const solids = solidBuildings(g)
      resolveBuildings(u, solids)
       const waypoint = findPathWaypoint(u, routeWaypoint, solids)
      const d = distance(u, waypoint)
      const smokeSlowed = g.spells.some(s => s.type === 'smoke' && s.age >= SPELL_FLIGHT && s.side !== u.side && distance(u, s) < SMOKE_RADIUS)
      const beerSlowed = g.spells.some(s => s.type === 'beer-shower' && s.age >= SPELL_FLIGHT && s.side !== u.side && distance(u, s) < 18)
     const slowed = enemies.some(e => e.card === cards[6] && distance(u, e) < 12) || smokeSlowed || beerSlowed
         let movement = Math.min(d, u.card.speed * MOVEMENT_SPEED_FACTOR * dt * (smokeSlowed ? .24 : slowed ? .5 : 1))
         if (escortTank) {
           const forwardGap = u.side === 'blue' ? escortTank.x - u.x : u.x - escortTank.x
           const escortGap = Math.max(0, forwardGap - 4)
           // The Fanmarsch leads the formation; support units may spread
           // sideways on a bridge, but never run ahead of the banner.
           movement = Math.min(movement, escortTank.card.speed * MOVEMENT_SPEED_FACTOR * dt, escortGap)
         }
         const bridgeLeader = bridgeUnitAhead(u, g.units)
         if (bridgeLeader) {
           const forwardGap = u.side === 'blue' ? bridgeLeader.x - u.x : u.x - bridgeLeader.x
           const queueGap = Math.max(0, forwardGap - 3.5)
           movement = Math.min(movement, bridgeLeader.card.speed * MOVEMENT_SPEED_FACTOR * dt, queueGap)
         }
       if (d) {
         const dx = (waypoint.x - u.x) / d
         const dy = (waypoint.y - u.y) / d
          // Substeps prevent fast units or a long tick tunnelling through a footprint.
          const steps = Math.max(1, Math.ceil(movement / .75))
          for (let step = 0; step < steps; step++) {
            const next = { x: u.x + dx * movement / steps, y: u.y + dy * movement / steps }
            if (walkablePoint(next)) Object.assign(u, next)
            else if (walkablePoint({ x: u.x, y: next.y })) u.y = next.y
            else if (walkablePoint({ x: next.x, y: u.y })) u.x = next.x
            resolveBuildings(u, solids)
           }
           u.moving = movement > .001
            if (u.moving && u.card.name === 'Würstchenverkäufer' && sausageDropTick) {
             g.sausages.push({ id: g.id++, x: u.x, y: u.y, age: 0 })
           }
           if (u.moving) {
             const forward = u.side === 'blue' ? dx > .08 : dx < -.08
             const lateral = Math.abs(dy) > .08 ? (dy < 0 ? 'left' : 'right') : undefined
             u.moveDirection = lateral
               ? `${forward ? 'forward' : 'backward'}-${lateral}` as Unit['moveDirection']
               : forward ? 'forward' : 'backward'
              if (Math.abs(dx) > (bridgeTraffic ? .35 : .08)) {
                u.facingBack = u.side === 'blue' ? dx > .08 : dx < -.08
              }
           }
       }
        if (!pointTarget && distance(u, routeWaypoint) < .0001) {
          if (routeIndex > u.routeIndex) u.routeIndex = routeIndex
          else if (u.routeIndex < route.length - 1) u.routeIndex++
        }
    }
  }
  separateUnits(g.units)
  const solids = solidBuildings(g)
  for (const u of g.units) if (activeUnit(u)) resolveBuildings(u, solids)
  for (const b of buildings) {
    g.buildingCooldown[b.key] = Math.max(0, g.buildingCooldown[b.key] - dt)
    if (g.hp[b.key] <= 0) continue
    if (g.endingCountdown !== undefined) continue
    const fortress = b.key.includes('Fortress')
    // Clubhouse gatling is active as soon as the clubhouse itself is hurt.
    // Pub guards keep their existing independent pub-defense behavior.
    if (fortress && g.hp[b.key] >= b.max &&
      g.hp[`${b.side}PubOne`] > 0 && g.hp[`${b.side}PubTwo`] > 0) continue
     const target = g.units.filter(u => u.side !== b.side && targetableUnit(u) && distance(u, b) <= (fortress ? GATLING_ATTACK_RANGE : PUB_ATTACK_RANGE)).sort((a, c) => distance(a, b) - distance(c, b))[0]
    if (!target) continue
    if (g.buildingCooldown[b.key] <= 0) {
      g.flares.push({ id: g.id++, source: b.key, side: b.side, target: target.id, x: target.x, y: target.y, age: 0 })
       g.buildingCooldown[b.key] = fortress ? GATLING_INTERVAL : FLARE_INTERVAL
    }
  }
  for (const u of g.units) if (u.hp <= 0) g.bloodStains.push({ id: g.id++, x: u.x, y: u.y, age: 0 })
  g.units = g.units.filter(u => u.hp > 0)
  const fortressResult = g.hp.redFortress <= 0 ? 'DERBYSIEG!' : g.hp.blueFortress <= 0 ? 'NIEDERLAGE' : undefined
  if (fortressResult) {
    if (g.endingCountdown === undefined) {
      g.endingCountdown = 3
      g.endingResult = fortressResult
    } else if (g.endingCountdown <= 1e-9) {
      g.result = g.endingResult ?? fortressResult
    }
  }
  else if (g.time <= 0) {
    const blue = Number(g.hp.redPubOne <= 0) + Number(g.hp.redPubTwo <= 0)
    const red = Number(g.hp.bluePubOne <= 0) + Number(g.hp.bluePubTwo <= 0)
    const matchJustEnded = previous.time > 0
    if (blue !== red) {
      g.result = blue > red ? 'DERBYSIEG!' : 'NIEDERLAGE'
    } else if (matchJustEnded) {
      // Only a tied score after regulation starts sudden death.
      g.overtime = Math.max(g.overtime, dt)
    } else if (g.overtime >= SUDDEN_DEATH_DURATION) {
      g.result = 'UNENTSCHIEDEN'
    }
  }
  return g
}
