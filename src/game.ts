export type Card = { name: string; role: string; cost: number; icon: string; color: string; damage: number; hp: number; speed: number; range: number; rate: number; rarity: string; kind?: 'unit' | 'spell' | 'building'; hidden?: boolean }
import { fromTile, toTile, snapToTile, snapBuildingToTile, validTile, walkablePoint, tileDistance, TILE_BUILDINGS, rectCenter, insideRect, buildingRectAt } from './grid.ts'
import type { TileRect } from './grid.ts'
export type Side = 'blue' | 'red'
export type Unit = { id: number; lane: number; x: number; y: number; side: Side; card: Card; hp: number; cooldown: number; routeIndex: number; targetId?: number; moving: boolean; facingBack: boolean; lateralOffset?: number; spawnDelay?: number; spawnDuration?: number }
export type Structure = { id: number; x: number; y: number; side: Side; card: Card; hp: number; max: number; cooldown: number; age: number }
export function laneRoute(side: Side, lane: number) {
  const x = lane === 0 ? 4 : 15
  return [{ x, y: 18 }, { x, y: 13 }, { x, y: 9.5 }, { x, y: 6 }, { x, y: 4 }, { x: 9.5, y: 2.5 }]
    .map(p => fromTile({ x: p.x, y: side === 'blue' ? p.y : 31 - p.y }))
}
export type Flare = { id: number; source: BuildingKey; side: Side; target: number; x: number; y: number; age: number }
export const FLARE_FLIGHT = .65
export const FLARE_INTERVAL = 1.5
export const GATLING_INTERVAL = .6
export const GATLING_ATTACK_RANGE = 40
export const FLARE_DAMAGE = 45
// Pub guards should open fire as soon as an enemy clears the bridge.
// The bridge-to-pub distance is about 25 renderer units, with a small
// margin so units cannot slip past the lane entrance before the first shot.
export const PUB_ATTACK_RANGE = 28
export const MOVEMENT_SPEED_FACTOR = .92
export const UNIT_ALERT_RADIUS = 24
export const UNIT_PURSUIT_RADIUS = 32
export const FLITZER_DECOY_RADIUS = 48
export const UNIT_COLLISION_DISTANCE = 3.5
export const BLOOD_STAIN_LIFETIME = 3.2
export const SPELL_FLIGHT = 1.8
export const SMOKE_RADIUS = 18
export const SMOKE_DAMAGE_PER_SECOND = 12
export const SIGNAL_RADIUS = 15
export const SIGNAL_BUILDING_DAMAGE = 180
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
  { name: 'Bierbecher-Werfer', role: 'Mittlere Reichweite', cost: 2, icon: '◈', color: '#e4bd43', damage: 35, hp: 220, speed: 5, range: 14, rate: .9, rarity: 'Common' },
  { name: 'Kutten-Garde', role: 'Tank', cost: 4, icon: '⬟', color: '#536c99', damage: 45, hp: 1100, speed: 3.5, range: 3, rate: 1.1, rarity: 'Rare' },
  { name: 'Der Trommler', role: 'Heilt nahe Verbündete', cost: 3, icon: '◉', color: '#ba4a8b', damage: 22, hp: 340, speed: 5, range: 9, rate: 1, rarity: 'Epic' },
  { name: 'Auswärtsfahrer', role: 'Schneller Angreifer', cost: 4, icon: '➤', color: '#398a78', damage: 70, hp: 420, speed: 10, range: 3, rate: .7, rarity: 'Rare' },
  { name: 'Der Ordner', role: 'Verlangsamt nahe Gegner', cost: 3, icon: '✚', color: '#6e7d52', damage: 40, hp: 600, speed: 4, range: 4, rate: 1, rarity: 'Rare' },
  { name: 'Pyro-Fan', role: 'Flächenschaden', cost: 5, icon: '♨', color: '#db5938', damage: 85, hp: 360, speed: 4.5, range: 11, rate: 1.3, rarity: 'Epic' },
  { name: 'Rauchbombe', role: 'Verlangsamt und verhüllt', cost: 3, icon: '◌', color: '#85877c', damage: 0, hp: 1, speed: 0, range: 0, rate: 0, rarity: 'Rare', kind: 'spell' },
  { name: 'Leuchtrakete', role: 'Markiert und schädigt Gegner', cost: 2, icon: '✹', color: '#f1a642', damage: 45, hp: 1, speed: 0, range: 0, rate: 0, rarity: 'Common', kind: 'spell' },
  { name: 'Bengalo-Salve', role: 'Mehrfacher Flächenschaden', cost: 5, icon: '♨', color: '#e85b36', damage: 75, hp: 1, speed: 0, range: 0, rate: 0, rarity: 'Epic', kind: 'spell' },
  { name: 'Bierdusche', role: 'Heilt Freunde und bremst Feinde', cost: 3, icon: '☂', color: '#d5a53b', damage: 0, hp: 1, speed: 0, range: 0, rate: 0, rarity: 'Rare', kind: 'spell' },
  { name: 'Zaunbrecher', role: 'Schwerer Gebäudestürmer', cost: 5, icon: '⚒', color: '#8d604b', damage: 110, hp: 950, speed: 2.8, range: 3, rate: 1.2, rarity: 'Rare' },
  { name: 'Megafon-Capo', role: 'Verstärkt nahe Verbündete', cost: 4, icon: '📣', color: '#b94f48', damage: 28, hp: 500, speed: 4, range: 3, rate: 1, rarity: 'Epic' },
  { name: 'Auswärtsblock', role: 'Vier schnelle Fans', cost: 5, icon: '➤', color: '#3f8d7b', damage: 25, hp: 190, speed: 8, range: 3, rate: .8, rarity: 'Rare' },
  { name: 'Pyro-Trupp', role: 'Drei mobile Bengalo-Werfer', cost: 6, icon: '♨', color: '#d95b3b', damage: 55, hp: 260, speed: 4.5, range: 11, rate: 1.3, rarity: 'Epic' },
  { name: 'Bierbude', role: 'Verliert Leben und spawnt alle 5s Bierbecher-Werfer', cost: 4, icon: '▣', color: '#c99b42', damage: 0, hp: 600, speed: 0, range: 0, rate: 5, rarity: 'Rare', kind: 'building' },
  { name: 'Würstchenverkäufer', role: 'Aggressiver Nahkämpfer aus der Würstchenbude', cost: 0, icon: '♨', color: '#d47b3c', damage: 92, hp: 560, speed: 6.5, range: 3, rate: .7, rarity: 'Rare', hidden: true },
  { name: 'Würstchenbude', role: 'Lockt Gegner an; spawnt beim Einsturz einen Verkäufer', cost: 4, icon: '▤', color: '#b87843', damage: 0, hp: 760, speed: 0, range: 0, rate: 0, rarity: 'Rare', kind: 'building' },
  { name: 'Flitzer', role: 'Langsamer Gebäudetank und Ablenkung', cost: 5, icon: '●', color: '#c58f72', damage: 30, hp: 1500, speed: 2.2, range: 3, rate: 1.2, rarity: 'Epic' },
  { name: 'Fanmarsch', role: 'Geschlossener Gebäudetank mit Banner', cost: 6, icon: '⚑', color: '#7d8f9b', damage: 12, hp: 2600, speed: 1.55, range: 3, rate: 1.4, rarity: 'Legendary' },
]
export const AI_DECK = [0, 2, 3, 5, 7, 9, 16, 20]
export type BuildingKey = 'blueFortress' | 'redFortress' | 'bluePubOne' | 'bluePubTwo' | 'redPubOne' | 'redPubTwo'
export const buildings: { key: BuildingKey; side: Side; x: number; y: number; max: number }[] = [
  { key: 'blueFortress', side: 'blue', ...rectCenter(TILE_BUILDINGS.blueFortress), max: 3000 },
  { key: 'redFortress', side: 'red', ...rectCenter(TILE_BUILDINGS.redFortress), max: 3000 },
  { key: 'bluePubOne', side: 'blue', ...rectCenter(TILE_BUILDINGS.bluePubOne), max: 1200 },
  { key: 'bluePubTwo', side: 'blue', ...rectCenter(TILE_BUILDINGS.bluePubTwo), max: 1200 },
  { key: 'redPubOne', side: 'red', ...rectCenter(TILE_BUILDINGS.redPubOne), max: 1200 },
  { key: 'redPubTwo', side: 'red', ...rectCenter(TILE_BUILDINGS.redPubTwo), max: 1200 },
]
export type Game = { time: number; hype: number; redHype: number; aiHype: number; aiClock: number; aiDeck: number[]; multiplayer: boolean; units: Unit[]; structures: Structure[]; hp: Record<BuildingKey, number>; queue: number[]; redQueue: number[]; id: number; result: string | null; log: string[]; shots: number; totalDamage: number; damageEvents: DamageEvent[]; flares: Flare[]; impacts: { id: number; x: number; y: number; age: number }[]; blood: { id: number; x: number; y: number; age: number }[]; bloodStains: { id: number; x: number; y: number; age: number }[]; spells: Spell[]; buildingCooldown: Record<BuildingKey, number>; beers: Beer[]; puddles: { id: number; x: number; y: number; age: number }[]; torches: Torch[]; fires: { id: number; x: number; y: number; age: number }[] }
export function newGame(deck: number[], aiDeck = AI_DECK, multiplayer = false, redDeck = aiDeck): Game {
  return { time: 180, hype: 7, redHype: 7, aiHype: 7, aiClock: 2, aiDeck: [...aiDeck], multiplayer, units: [], structures: [], hp: Object.fromEntries(buildings.map(b => [b.key, b.max])) as Game['hp'], queue: [...deck], redQueue: [...redDeck], id: 1, result: null, log: ['Anpfiff! Jede Lane führt über die gegnerische Kneipe.'], shots: 0, totalDamage: 0, damageEvents: [], flares: [], impacts: [], blood: [], bloodStains: [], spells: [], buildingCooldown: Object.fromEntries(buildings.map(b => [b.key, 0])) as Game['buildingCooldown'], beers: [], puddles: [], torches: [], fires: [] }
}
const spellType = (card: Card): Spell['type'] | undefined => ({ 8: 'smoke', 9: 'signal', 10: 'salvo', 11: 'beer-shower' } as Record<number, Spell['type']>)[cards.indexOf(card)]
const unitCount = (card: Card) => cards.indexOf(card) === 14 ? 4 : cards.indexOf(card) === 15 ? 3 : 1
function makeUnits(startId: number, x: number, y: number, side: Side, lane: number, card: Card) {
  const offsets = unitCount(card) === 4 ? [0, -2.8, 2.8, -5.4] : unitCount(card) === 3 ? [0, -3, 3] : [0]
  const routeIndex = side === 'blue' ? x > 58 ? 2 : 0 : x < 42 ? 2 : 0
  const baseDelay = card.name === 'Flitzer' || card.name === 'Fanmarsch' ? 2 : 1
  return offsets.map((offset, index) => ({
    id: startId + index, x, y: Math.max(4, Math.min(96, y + offset)), lane, card, side, hp: card.hp,
    cooldown: 0, routeIndex, moving: false, facingBack: false,
    spawnDelay: baseDelay + index * .16, spawnDuration: baseDelay + index * .16,
  } satisfies Unit))
}
const activeUnit = (unit: Unit) => unit.hp > 0 && (unit.spawnDelay ?? 0) <= 0
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
  const captured = g.hp[pub] <= 0 && (side === 'blue' ? tile.y >= 1 && tile.y <= 14 : tile.y >= 17 && tile.y <= 30)
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
      const spawned = makeUnits(g.id + 1, x, y, side, y < 49 ? 0 : 1, cards[2])
        .map(unit => ({ ...unit, spawnDelay: 0, spawnDuration: 0 }))
      return { ...update, structures: [...g.structures, structure], units: [...g.units, ...spawned], id: g.id + 1 + spawned.length }
    }
    return { ...update, structures: [...g.structures, structure] }
  }
  const units = makeUnits(g.id, x, y, side, y < 49 ? 0 : 1, card)
  const solids = solidBuildings(g)
  for (const unit of units) resolveBuildings(unit, solids)
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
const recordDamage = (g: Game, point: { x: number; y: number }, amount: number, kind: DamageEvent['kind']) => {
  if (amount > 0) { g.totalDamage += amount; g.damageEvents.push({ id: g.id++, x: point.x, y: point.y, amount, kind, age: 0 }) }
}
const spellLifetime = (type: Spell['type']) => type === 'smoke' ? 7.5 : type === 'beer-shower' ? 3.4 : type === 'salvo' ? 2.5 : 1.9
function separateUnits(units: Unit[]) {
  // Resolve softly in a few passes so a crowd forms a loose row instead of a stack.
  // Y is the lane width, therefore the preferred escape direction is sideways.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < units.length; i++) {
      const a = units[i]
      if (!activeUnit(a)) continue
      for (let j = i + 1; j < units.length; j++) {
        const b = units[j]
        if (!activeUnit(b)) continue
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d = Math.hypot(dx, dy)
        if (d >= UNIT_COLLISION_DISTANCE) continue
        // Engaged enemies only separate while they are actually overlapping.
        // Once they have a stable combat gap, repeated sideways pushes make a
        // melee unit jitter while chasing a Flitzer.
        if (a.side !== b.side && d > 2.8 && (a.card.name === 'Flitzer' || b.card.name === 'Flitzer') && (a.targetId === b.id || b.targetId === a.id)) continue
        const side = a.id < b.id ? -1 : 1
        const amount = (UNIT_COLLISION_DISTANCE - d) * .28
        const ay = a.y + side * amount
        const by = b.y - side * amount
        if (walkablePoint({ x: a.x, y: ay })) a.y = ay
        if (walkablePoint({ x: b.x, y: by })) b.y = by
        const offset = Math.min(3.8, Math.max(.45, (UNIT_COLLISION_DISTANCE - d) * .55))
        a.lateralOffset = Math.max(-4, Math.min(4, (a.lateralOffset ?? 0) + side * offset))
        b.lateralOffset = Math.max(-4, Math.min(4, (b.lateralOffset ?? 0) - side * offset))
        a.moving = true
        b.moving = true
      }
    }
  }
}
// Pursuit may leave a lane, but must still use a bridge to cross the canal.
function pursuitWaypoint(u: Unit, target: Unit) {
  const a = toTile(u), b = toTile(target)
  if ((a.y < 14.5 && b.y < 14.5) || (a.y > 16.5 && b.y > 16.5)) return target
  const bridge = u.lane === 0 ? 4 : 15
  if (Math.abs(a.x - bridge) < .2) return fromTile({ x: bridge, y: b.y < a.y ? 13 : 18 })
  return fromTile({ x: bridge, y: a.y < 15.5 ? 13 : 18 })
}
export function tick(previous: Game, dt: number, random = Math.random): Game {
  if (previous.result) return previous
  const g: Game = { ...previous, hp: { ...previous.hp }, structures: previous.structures.map(s => ({ ...s, cooldown: Math.max(0, s.cooldown - dt), age: s.age + dt })), units: previous.units.map(u => ({ ...u, moving: false, spawnDelay: Math.max(0, (u.spawnDelay ?? 0) - dt) })), log: [...previous.log], buildingCooldown: { ...previous.buildingCooldown }, damageEvents: previous.damageEvents.map(e => ({ ...e, age: e.age + dt })).filter(e => e.age < .9), flares: [], impacts: previous.impacts.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < .45), blood: previous.blood.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < .58), bloodStains: previous.bloodStains.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < BLOOD_STAIN_LIFETIME), spells: previous.spells.map(s => ({ ...s, age: s.age + dt })).filter(s => s.age < spellLifetime(s.type)), beers: [], puddles: previous.puddles.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < PUDDLE_LIFETIME), torches: [], fires: previous.fires.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < FIRE_LIFETIME) }
  for (const old of previous.torches) {
    const target = typeof old.target === 'number' ? g.units.find(u => u.id === old.target && activeUnit(u)) : undefined
    const torch = { ...old, age: old.age + dt, x: target?.x ?? old.x, y: target?.y ?? old.y }
    if (torch.age + 1e-9 < TORCH_FLIGHT) g.torches.push(torch)
    else {
       if (typeof torch.target === 'string') {
         const stall = torch.target.startsWith('stall:') ? g.structures.find(s => `stall:${s.id}` === torch.target) : undefined
         if (stall) { stall.hp = Math.max(0, stall.hp - torch.damage); recordDamage(g, stall, torch.damage, 'building') }
         else { g.hp[torch.target as BuildingKey] = Math.max(0, g.hp[torch.target as BuildingKey] - torch.damage); const b = buildings.find(b => b.key === torch.target); if (b) recordDamage(g, b, torch.damage, 'building') }
       }
      for (const u of g.units) {
        if (u.side !== torch.side && activeUnit(u) && distance(u, torch) < 9) { const amount = u.id === torch.target ? torch.damage : torch.damage * .6; u.hp -= amount; recordDamage(g, u, amount, 'area') }
      }
      g.fires.push({ id: torch.id, x: torch.x, y: torch.y, age: 0 })
      g.impacts.push({ id: torch.id, x: torch.x, y: torch.y, age: 0 })
      g.shots++
    }
  }
  for (const old of previous.beers) {
    const target = typeof old.target === 'number' ? g.units.find(u => u.id === old.target && activeUnit(u)) : undefined
    const beer = { ...old, age: old.age + dt, x: target?.x ?? old.x, y: target?.y ?? old.y }
    if (beer.age + 1e-9 < BEER_FLIGHT) g.beers.push(beer)
    else {
      if (target) { target.hp -= beer.damage; recordDamage(g, target, beer.damage, 'hit') }
       else if (typeof beer.target === 'string') {
         const stall = beer.target.startsWith('stall:') ? g.structures.find(s => `stall:${s.id}` === beer.target) : undefined
         if (stall) { stall.hp = Math.max(0, stall.hp - beer.damage); recordDamage(g, stall, beer.damage, 'building') }
         else { g.hp[beer.target as BuildingKey] = Math.max(0, g.hp[beer.target as BuildingKey] - beer.damage); const b = buildings.find(b => b.key === beer.target); if (b) recordDamage(g, b, beer.damage, 'building') }
       }
      g.puddles.push({ id: beer.id, x: beer.x, y: beer.y, age: 0 })
      g.shots++
    }
  }
  for (const old of previous.flares) {
      const target = g.units.find(u => u.id === old.target && activeUnit(u))
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
      for (const u of g.units) if (u.side !== spell.side && activeUnit(u) && distance(u, spell) <= SIGNAL_RADIUS) { u.hp -= cards[9].damage; recordDamage(g, u, cards[9].damage, 'area') }
       for (const b of buildings) if (b.side !== spell.side && g.hp[b.key] > 0 && distance(b, spell) <= SIGNAL_RADIUS) { g.hp[b.key] = Math.max(0, g.hp[b.key] - SIGNAL_BUILDING_DAMAGE); recordDamage(g, b, SIGNAL_BUILDING_DAMAGE, 'building') }
       for (const b of g.structures) if (b.side !== spell.side && b.hp > 0 && distance(b, spell) <= SIGNAL_RADIUS) { b.hp = Math.max(0, b.hp - SIGNAL_BUILDING_DAMAGE); recordDamage(g, b, SIGNAL_BUILDING_DAMAGE, 'building') }
      g.impacts.push({ id: spell.id, x: spell.x, y: spell.y, age: 0 })
      spell.applied = true
    } else if (spell.type === 'salvo' && spell.age >= SPELL_FLIGHT && !spell.applied) {
        for (const u of g.units) if (u.side !== spell.side && activeUnit(u) && distance(u, spell) <= 15) { u.hp -= 75; recordDamage(g, u, 75, 'area') }
       for (const b of g.structures) if (b.side !== spell.side && b.hp > 0 && distance(b, spell) <= 15) { b.hp = Math.max(0, b.hp - 75); recordDamage(g, b, 75, 'building') }
      g.fires.push({ id: spell.id, x: spell.x - 2, y: spell.y, age: 0 })
      g.fires.push({ id: spell.id + 1, x: spell.x + 2, y: spell.y + 2, age: 0 })
      g.impacts.push({ id: spell.id, x: spell.x, y: spell.y, age: 0 })
      spell.applied = true
    } else if (spell.type === 'smoke' && spell.age < spellLifetime('smoke')) {
      for (const u of g.units) {
         if (u.side !== spell.side && activeUnit(u) && distance(u, spell) <= SMOKE_RADIUS) { const amount = SMOKE_DAMAGE_PER_SECOND * dt; u.hp -= amount; if (Math.floor(spell.age * 2) !== Math.floor((spell.age - dt) * 2)) recordDamage(g, u, amount * 2, 'area') }
      }
    } else if (spell.type === 'beer-shower' && spell.age < 2.8) {
      for (const u of g.units) {
         if (u.side === spell.side && activeUnit(u) && distance(u, spell) <= 18) { const amount = Math.min(u.card.hp - u.hp, 35 * dt); u.hp += amount; if (amount > 0 && Math.floor(spell.age * 2) !== Math.floor((spell.age - dt) * 2)) recordDamage(g, u, amount * 2, 'heal') }
      }
    }
  }
  g.time = Math.max(0, g.time - dt)
  const regen = g.time <= 60 ? .95 : .48
  g.hype = Math.min(10, g.hype + dt * regen)
  if (g.multiplayer) g.redHype = Math.min(10, g.redHype + dt * regen)
  g.aiHype = Math.min(10, g.aiHype + dt * regen)
  g.aiClock -= dt
  if (!g.multiplayer && g.aiClock <= 0) {
    g.aiClock = 2 + random() * 2
      const affordable = g.aiDeck.map(index => cards[index]).filter(c => c.cost <= g.aiHype)
      if (affordable.length) {
        const card = affordable[Math.floor(random() * affordable.length)]
        const lane = random() < .5 ? 0 : 1
        const type = spellType(card)
        if (type) {
          const enemy = g.units.filter(u => u.side === 'blue' && activeUnit(u)).sort((a, b) => b.x - a.x)[0]
          const fallback = buildings.find(b => b.key === `bluePub${lane === 0 ? 'One' : 'Two'}`)!
          const target = enemy ?? fallback
          g.spells.push({ id: g.id++, type, side: 'red', x: target.x, y: target.y, fromX: 95, fromY: 50, age: 0 })
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
    if (structure.hp <= 0 || structure.card !== cards[16]) continue
    structure.hp -= BEER_STALL_DECAY * dt
    while (structure.age + 1e-9 >= BEER_STALL_SPAWN_INTERVAL && structure.hp > 0) {
      structure.age -= BEER_STALL_SPAWN_INTERVAL
      const lane = structure.y < 49 ? 0 : 1
      const spawned = makeUnits(g.id, structure.x, structure.y, structure.side, lane, cards[2])
      g.units.push(...spawned)
      g.id += spawned.length
      g.log = [`${structure.side === 'blue' ? 'Deine' : 'KiezKalle'}: Bierbecher-Werfer aus Bierbude`, ...g.log].slice(0, 4)
    }
  }
  for (const structure of g.structures) {
    if (structure.hp > 0 || structure.card !== cards[18]) continue
    const lane = structure.y < 49 ? 0 : 1
    const spawned = makeUnits(g.id, structure.x, structure.y, structure.side, lane, cards[17])
    g.units.push(...spawned)
    g.id += spawned.length
    g.log = [`Würstchenbude zerstört: Verkäufer greift an`, ...g.log].slice(0, 4)
  }
  g.structures = g.structures.filter(s => s.hp > 0)
  for (const u of g.units) {
    if (!activeUnit(u)) continue
    u.cooldown -= dt
    const allies = g.units.filter(v => v.side === u.side && activeUnit(v) && distance(u, v) < 13)
    const marchTank = u.card.name === 'Fanmarsch'
    const enemies = marchTank ? [] : g.units.filter(v => v.side !== u.side && activeUnit(v))
    if (u.card === cards[4]) for (const a of allies) a.hp = Math.min(a.card.hp, a.hp + 12 * dt)
    const nearby = enemies.filter(v => distance(u, v) <= UNIT_ALERT_RADIUS).sort((a, b) => distance(u, a) - distance(u, b))
    const decoy = enemies.filter(v => v.card.name === 'Flitzer' && distance(u, v) <= FLITZER_DECOY_RADIUS).sort((a, b) => distance(u, a) - distance(u, b))[0]
    const locked = enemies.find(v => v.id === u.targetId && distance(u, v) <= UNIT_PURSUIT_RADIUS)
    // Defend against a unit in weapon range rather than chase a distant lock.
    const immediate = nearby.find(v => distance(u, v) <= u.card.range + 1)
    // The Flitzer is deliberately distracting: nearby troops abandon their lane target and pursue it.
    const target = marchTank || u.card.name === 'Flitzer' ? undefined : decoy ?? immediate ?? locked ?? nearby[0]
    const structureTarget = !target ? g.structures.filter(s => s.side !== u.side && s.hp > 0 && distance(u, s) <= UNIT_PURSUIT_RADIUS).sort((a, b) => distance(u, a) - distance(u, b))[0] : undefined
    const pointTarget = target ?? structureTarget
    const escortTank = !target && !structureTarget && u.card.name !== 'Flitzer'
      ? g.units
        .filter(v => v !== u && v.side === u.side && v.card.name === 'Fanmarsch' && activeUnit(v) && v.lane === u.lane)
        .filter(v => u.side === 'blue' ? v.x > u.x + 1 : v.x < u.x - 1)
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
    u.targetId = target?.id
    const inRange = !!pointTarget && distance(u, pointTarget) <= u.card.range + 1
    const enemySide = u.side === 'blue' ? 'red' : 'blue'
    const pub = buildings.find(b => b.key === `${enemySide}Pub${u.lane === 0 ? 'One' : 'Two'}`)!
    const goal = g.hp[pub.key] > 0 ? pub : buildings.find(b => b.key === `${enemySide}Fortress`)!
    const focus = pointTarget ?? (u.routeIndex >= 2 ? goal : undefined)
    if (focus) u.facingBack = u.side === 'blue' ? focus.x > u.x : focus.x < u.x
    const atBuilding = u.routeIndex >= (goal === pub ? 2 : 4) && distance(u, goal) <= u.card.range + 8
    if (inRange || (!pointTarget && atBuilding)) {
      if (u.cooldown <= 0) {
        const damage = u.card.damage * (allies.some(a => a.card === cards[1]) ? 1.25 : allies.some(a => a.card === cards[13]) ? 1.15 : 1)
        if (u.card === cards[2]) {
          g.beers.push({ id: g.id++, fromX: u.x, fromY: u.y, x: (pointTarget ?? goal).x, y: (pointTarget ?? goal).y, target: target ? target.id : structureTarget ? `stall:${structureTarget.id}` : goal.key, damage, age: 0 })
        } else if (u.card === cards[7] || u.card === cards[15]) {
          g.torches.push({ id: g.id++, fromX: u.x, fromY: u.y, x: (pointTarget ?? goal).x, y: (pointTarget ?? goal).y, target: target ? target.id : structureTarget ? `stall:${structureTarget.id}` : goal.key, side: u.side, damage, age: 0 })
        } else if (target) {
          target.hp -= damage
          recordDamage(g, target, damage, u.card.range <= 4 ? 'hit' : 'area')
          if (u.card.range <= 4) g.blood.push({ id: g.id++, x: target.x, y: target.y, age: 0 })
        } else if (structureTarget) {
          structureTarget.hp -= damage
          recordDamage(g, structureTarget, damage, 'building')
        } else { g.hp[goal.key] = Math.max(0, g.hp[goal.key] - damage); recordDamage(g, goal, damage, 'building') }
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
      const rawWaypoint = target ? pursuitWaypoint(u, target) : structureTarget ? structureTarget : route[routeIndex]
      const routeWaypoint = target ? rawWaypoint : { x: rawWaypoint.x, y: rawWaypoint.y + (u.lateralOffset ?? 0) }
      const solids = solidBuildings(g)
      resolveBuildings(u, solids)
      const waypoint = avoidBuildings(u, routeWaypoint, solids)
      const d = distance(u, waypoint)
     const smokeSlowed = g.spells.some(s => s.type === 'smoke' && s.side !== u.side && distance(u, s) < SMOKE_RADIUS)
     const beerSlowed = g.spells.some(s => s.type === 'beer-shower' && s.side !== u.side && distance(u, s) < 18)
     const slowed = enemies.some(e => e.card === cards[6] && distance(u, e) < 12) || smokeSlowed || beerSlowed
        let movement = Math.min(d, u.card.speed * MOVEMENT_SPEED_FACTOR * dt * (smokeSlowed ? .24 : slowed ? .5 : 1))
        if (escortTank) {
          const forwardGap = u.side === 'blue' ? escortTank.x - u.x : u.x - escortTank.x
          const escortGap = Math.max(0, forwardGap - 4)
          // The march sets the pace. Once close, keep a visible gap and never
          // let a faster unit overtake the banner.
          movement = Math.min(movement, escortTank.card.speed * MOVEMENT_SPEED_FACTOR * dt, escortGap)
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
          if (u.moving) u.facingBack = u.side === 'blue' ? dx > .08 : dx < -.08
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
    const fortress = b.key.includes('Fortress')
    if (fortress && g.hp[`${b.side}PubOne`] > 0 && g.hp[`${b.side}PubTwo`] > 0) continue
    const target = g.units.filter(u => u.side !== b.side && activeUnit(u) && distance(u, b) <= (fortress ? GATLING_ATTACK_RANGE : PUB_ATTACK_RANGE)).sort((a, c) => distance(a, b) - distance(c, b))[0]
    if (!target) continue
    if (g.buildingCooldown[b.key] <= 0) {
      g.flares.push({ id: g.id++, source: b.key, side: b.side, target: target.id, x: target.x, y: target.y, age: 0 })
       g.buildingCooldown[b.key] = fortress ? GATLING_INTERVAL : FLARE_INTERVAL
    }
  }
  for (const u of g.units) if (u.hp <= 0) g.bloodStains.push({ id: g.id++, x: u.x, y: u.y, age: 0 })
  g.units = g.units.filter(u => u.hp > 0)
  if (g.hp.redFortress <= 0) g.result = 'DERBYSIEG!'
  else if (g.hp.blueFortress <= 0) g.result = 'NIEDERLAGE'
  else if (g.time <= 0) {
    const blue = Number(g.hp.redPubOne <= 0) + Number(g.hp.redPubTwo <= 0)
    const red = Number(g.hp.bluePubOne <= 0) + Number(g.hp.bluePubTwo <= 0)
    g.result = blue === red ? 'UNENTSCHIEDEN' : blue > red ? 'DERBYSIEG!' : 'NIEDERLAGE'
  }
  return g
}
