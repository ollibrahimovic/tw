import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromTile, toTile, insideRect, TILE_BUILDINGS, rectCenter, walkablePoint } from '../src/grid.ts'
import { cards, deploy, newGame, tick, laneRoute, solidBuildings, canDeploy, FLARE_DAMAGE, BEER_FLIGHT, PUDDLE_LIFETIME, TORCH_FLIGHT, FIRE_LIFETIME } from '../src/game.ts'

const fresh = () => newGame(cards.slice(0, 8).map((_, i) => i))
test('building footprints reject deployment, but allow spells and destroyed buildings', () => {
  const g = fresh()
  assert.equal(canDeploy(g, cards[0], 24, 13), false)
  const pub = rectCenter(TILE_BUILDINGS.bluePubOne)
  assert.equal(canDeploy(g, cards[16], pub.x, pub.y), false)
  assert.equal(canDeploy(g, cards[8], 24, 13), true)
  g.hp.bluePubOne = 0
  assert.equal(canDeploy(g, cards[0], 24, 13), true)
})

test('units detour around friendly pubs on both sides without getting stuck', () => {
  for (const side of ['blue', 'red']) {
    let g = deploy(fresh(), 0, side === 'blue' ? 12 : 88, 13, side)
    g.aiClock = 10000
    g.units[0].hp = 100000
    for (let i = 0; i < 400; i++) {
      g = tick(g, .05)
      for (const b of solidBuildings(g)) {
        assert.equal(insideRect(g.units[0], b.rect), false)
      }
    }
    assert.ok(side === 'blue' ? g.units[0].x > 40 : g.units[0].x < 60, 'must make forward progress')
  }
})

test('crowd separation and long movement ticks cannot leave units inside buildings', () => {
  let g = deploy(fresh(), 0, 12, 13)
  g.aiClock = 10000
  g.units[0].hp = 100000
  g.units.push({ ...g.units[0], id: 1000, x: 24, y: 13 })
  g.structures.push({ id: 2000, side: 'blue', x: 37, y: 22, card: cards[16], hp: 600, max: 600, cooldown: 100, age: 0 })
  for (let i = 0; i < 10; i++) {
    g = tick(g, 1)
    for (const u of g.units) for (const b of solidBuildings(g)) {
      assert.equal(insideRect(u, b.rect), false)
    }
  }
})
test('deployment spends hype, rotates hand and rejects enemy territory', () => {
  const g = fresh()
  assert.equal(deploy(g, 0, 70, 40), g)
  const next = deploy(g, 0, 30, 31)
  assert.equal(next.hype, 4)
  assert.deepEqual(next.queue, [1, 2, 3, 4, 5, 6, 7, 0])
  assert.equal(next.units.length, 1)
  assert.equal(g.units.length, 0)
  assert.equal(deploy(next, 0, 30, 31), next)
  const unlocked = deploy({ ...fresh(), hp: { ...fresh().hp, redPubOne: 0 } }, 0, 70, 20)
  assert.equal(unlocked.units.length, 1)
  assert.equal(unlocked.units[0].routeIndex, 2)
})
test('beer stalls decay, spawn cup throwers and can be attacked as buildings', () => {
  let g = newGame([16])
  g.aiClock = 10000
  g = deploy(g, 0, 30, 31)
  assert.equal(g.structures.length, 1)
  assert.equal(g.structures[0].hp, 600)
  for (let i = 0; i < 99; i++) g = tick(g, .05)
  assert.ok(g.structures[0].hp < 600)
  assert.equal(g.units.length, 0)
  g = tick(g, .05)
  assert.equal(g.units.length, 1)
  g.units = []
  const enemy = { ...deploy(newGame([0]), 0, 30, 31).units[0], id: 900, side: 'red', x: 33, y: 31, cooldown: 0 }
  g.units.push(enemy)
  const hp = g.structures[0].hp
  g = tick(g, .05)
  assert.ok(g.structures[0].hp < hp)
})
test('sausage stalls spawn an aggressive vendor when destroyed', () => {
  let g = newGame([18])
  g.aiClock = 10000
  g = deploy(g, 0, 30, 31)
  g.structures[0].hp = 0
  g = tick(g, .05)
  assert.equal(g.structures.length, 0)
  assert.equal(g.units.length, 1)
  assert.equal(g.units[0].card.name, 'Würstchenverkäufer')
  assert.equal(g.units[0].card.damage, 92)
})
test('flitzer ignores enemy units and keeps charging buildings', () => {
  let g = newGame([19])
  g.aiClock = 10000
  g = deploy(g, 0, 30, 31)
  g.units.push({ ...deploy(newGame([0]), 0, 30, 31).units[0], id: 900, side: 'red', x: 31, y: 31, cooldown: 100 })
  const x = g.units[0].x
  g = tick(g, .05)
  assert.equal(g.units[0].targetId, undefined)
  assert.ok(g.units[0].x > x)
})
test('nearby enemy units are distracted by the flitzer', () => {
  let g = newGame([19])
  g.aiClock = 10000
  g = deploy(g, 0, 30, 31)
  const enemy = deploy(newGame([0]), 0, 30, 31).units[0]
  g.units.push({ ...enemy, id: 900, side: 'red', x: 35, y: 31, cooldown: 100 })
  g = tick(g, .05)
  assert.equal(g.units.find(u => u.id === 900)?.targetId, g.units[0].id)
})
test('units cross bridges and attack the correct enemy fortress after an outpost falls', () => {
  let g = fresh()
  g.hp.redPubOne = 0
  g.aiClock = 10000
  g = deploy(g, 3, 30, 20)
  g.units[0].hp = 100000
    for (let i = 0; i < 1400; i++) {
    g = tick(g, .05)
    for (const u of g.units) if (u.x > 45 && u.x < 56) assert.ok(Math.abs(u.y - laneRoute('blue', 0)[0].y) < 1)
  }
  assert.ok(g.hp.redFortress < 3000)
  assert.equal(g.hp.blueFortress, 3000)
})
test('fortress destruction ends immediately and completed games are frozen', () => {
  let g = fresh()
  g.hp.redFortress = 0
  g = tick(g, .05)
  assert.equal(g.result, 'DERBYSIEG!')
  assert.equal(tick(g, 1), g)
})
test('timeout uses outposts and supports draws', () => {
  const g = fresh()
  g.time = .01
  assert.equal(tick(g, .05).result, 'UNENTSCHIEDEN')
  g.hp.redPubOne = 0
  assert.equal(tick(g, .05).result, 'DERBYSIEG!')
  g.hp.bluePubOne = 0
  g.hp.bluePubTwo = 0
  assert.equal(tick(g, .05).result, 'NIEDERLAGE')
})
test('full match stays bounded, AI uses both lanes, finale regenerates faster', () => {
  let seed = 12
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  let g = fresh()
  const lanes = new Set()
  for (let i = 0; i < 3601; i++) {
    g = tick(g, .05, random)
    g.units.forEach(u => lanes.add(u.lane))
    assert.ok(g.hype >= 0 && g.hype <= 10 && g.aiHype >= 0 && g.aiHype <= 10)
    assert.ok(g.units.every(u => Number.isFinite(u.x) && u.hp > 0))
  }
  assert.ok(g.result)
  assert.equal(lanes.size, 2)
  const end = fresh()
  end.time = 50
  assert.ok(tick(end, 1).hype > tick(fresh(), 1).hype)
})

test('both sides and both lanes must clear their pub and traverse its checkpoint', () => {
  for (const side of ['blue', 'red']) for (const lane of [0, 1]) {
    let g = fresh()
    g.aiClock = 10000
    g = deploy(g, 2, 30, lane === 0 ? 31 : 66)
    const u = g.units[0]
    u.side = side
    u.x = side === 'blue' ? 30 : 70
    u.hp = 100000
    u.cooldown = 10000
    const enemy = side === 'blue' ? 'red' : 'blue'
    const pubKey = `${enemy}Pub${lane === 0 ? 'One' : 'Two'}`
    for (let i = 0; i < 900; i++) g = tick(g, .05)
    assert.ok(g.units[0].routeIndex <= 3, 'living pub blocks forward travel')
    assert.equal(g.hp[`${enemy}Fortress`], 3000)
    g.hp[pubKey] = 0
    g.units[0].cooldown = 0
    const checkpoints = new Set()
    for (let i = 0; i < 700; i++) {
      const previous = g.units[0]
      g = tick(g, .05)
      const next = g.units[0]
      if (next.routeIndex > previous.routeIndex) {
        const p = laneRoute(side, lane)[previous.routeIndex]
        assert.ok(Math.hypot(next.x - p.x, next.y - p.y) < .001)
        checkpoints.add(previous.routeIndex)
      }
    }
    assert.ok(checkpoints.has(3), 'must pass destroyed pub before fortress attack')
    assert.ok(g.hp[`${enemy}Fortress`] < 3000)
  }
})

test('rooftop bengalos deal damage on impact, splash enemies and respect cooldown', () => {
  let g = deploy(fresh(), 0, 30, 31)
  g.aiClock = 10000
  // Stationary targets outside the solid pub, spaced beyond crowd separation.
  Object.assign(g.units[0], { x: 74, y: 21, routeIndex: 2, cooldown: 100, card: { ...cards[0], speed: 0 } })
  g.units.push({ ...g.units[0], id: 900, x: 74, y: 24.5 })
  g.units.push({ ...g.units[0], id: 901, x: 80, y: 13, side: 'red' })
  const original = g
  g = tick(g, .05)
  assert.equal(g.flares.length, 1)
  assert.equal(g.flares[0].source, 'redPubOne')
  assert.equal(g.units[1].hp, cards[0].hp, 'no instant tower damage')
  g = tick(g, .3)
  assert.equal(g.flares.length, 1, 'no second throw during cooldown')
  assert.equal(g.units[1].hp, cards[0].hp)
  g = tick(g, .35)
  assert.equal(g.flares.length, 0)
  assert.equal(g.impacts.length, 1)
  assert.deepEqual(g.units.slice(0, 2).map(u => u.hp).sort((a, b) => a - b), [cards[0].hp - FLARE_DAMAGE, cards[0].hp - 15])
  assert.equal(g.units[2].hp, cards[0].hp, 'friendly units are unaffected')
  assert.equal(original.units[1].hp, cards[0].hp, 'prior simulation state is immutable')
  g.hp.redPubOne = 0
  g = tick(g, 2)
  assert.ok(g.flares.every(flare => flare.source !== 'redPubOne'), 'destroyed pub cannot throw')
  assert.ok(g.flares.some(flare => flare.source === 'redFortress'), 'activated gatling reaches attackers near the fallen pub')
})

test('clubhouse gatling activates only after an own pub falls and rockets damage on impact', () => {
  for (const side of ['blue', 'red']) {
    let g = deploy(newGame([0]), 0, 30, 22)
    g.aiClock = 10000
    for (const key of ['bluePubOne', 'bluePubTwo', 'redPubOne', 'redPubTwo']) g.buildingCooldown[key] = 100
    Object.assign(g.units[0], { side: side === 'blue' ? 'red' : 'blue', x: side === 'blue' ? 12 : 88, y: 50, hp: 1000, card: { ...cards[0], speed: 0, damage: 0 } })
    g = tick(g, .05)
    assert.equal(g.flares.length, 0)
    assert.equal(g.units[0].hp, 1000)
    g.hp[`${side === 'blue' ? 'red' : 'blue'}PubOne`] = 0
    g = tick(g, .05)
    assert.equal(g.flares.length, 0, 'enemy pub falling does not activate this clubhouse')
    g.hp[`${side}PubTwo`] = 0
    g = tick(g, .05)
    assert.equal(g.flares[0].source, `${side}Fortress`)
    assert.equal(g.units[0].hp, 1000, 'rocket must travel before damage')
    for (let i = 0; i < 14; i++) g = tick(g, .05)
    assert.equal(g.units[0].hp, 955)
    assert.ok(g.flares.length > 0, 'gatling continues firing')
    g.hp[`${side}Fortress`] = 0
    g.flares = []
    g = tick(g, .05)
    assert.equal(g.flares.length, 0, 'destroyed clubhouse cannot fire')
  }
})

test('pub guards fire when an enemy has crossed the bridge', () => {
  for (const side of ['blue', 'red']) {
    const bridgeSide = side === 'blue' ? { x: 4, y: 17 } : { x: 4, y: 14 }
    const p = fromTile(bridgeSide)
    let g = deploy(fresh(), 0, p.x, p.y, side)
    g.aiClock = 10000
    Object.assign(g.units[0], {
      side: side === 'blue' ? 'red' : 'blue',
      x: p.x,
      y: p.y,
      hp: 1000,
      card: { ...cards[0], speed: 0, damage: 0 },
    })
    g = tick(g, .05)
    assert.ok(g.flares.some(flare => flare.source === `${side}PubOne`), `${side} pub should fire across the bridge`)
  }
})

test('troops pursue enemies outside weapon range before attacking buildings, then resume their lane', () => {
  let g = deploy(fresh(), 0, 30, 31)
  g.aiClock = 10000
  Object.assign(g.units[0], { x: 78, y: 26, routeIndex: 2, hp: 10000 })
  g.units.push({ ...g.units[0], id: 900, side: 'red', x: 73, y: 38, hp: 80, cooldown: 100, card: { ...cards[0], speed: 0, damage: 0 } })
  const before = Math.hypot(78 - 73, 26 - 38)
  g = tick(g, .05)
  assert.equal(g.units[0].targetId, 900)
  assert.ok(Math.hypot(g.units[0].x - 73, g.units[0].y - 38) < before)
  assert.equal(g.hp.redPubOne, 1200, 'enemy takes priority over pub in weapon range')
  for (let i = 0; i < 80 && g.units.some(u => u.id === 900); i++) g = tick(g, .05)
  assert.ok(!g.units.some(u => u.id === 900), 'pursued enemy is attacked and killed')
  assert.equal(g.units[0].routeIndex, 2, 'pursuit does not skip lane checkpoints')
  for (let i = 0; i < 80; i++) g = tick(g, .05)
  assert.equal(g.units[0].targetId, undefined)
  assert.ok(g.hp.redPubOne < 1200, 'unit returns to its pub objective')
})

test('pursuit crosses the canal through a bridge instead of cutting through water', () => {
  let g = deploy(fresh(), 0, 30, 22)
  g.aiClock = 10000
  Object.assign(g.units[0], { x: 42, y: 40, routeIndex: 0, hp: 10000 })
  g.units.push({ ...g.units[0], id: 900, side: 'red', x: 58, y: 40, hp: 10000, cooldown: 100, card: { ...cards[0], speed: 0, damage: 0 } })
  let crossed = false
  for (let i = 0; i < 200; i++) {
    g = tick(g, .05)
    const u = g.units[0]
    const tile = toTile(u)
    if (tile.y > 14.5 && tile.y < 16.5) {
      crossed = true
      assert.ok(walkablePoint(u), 'pursuit stays on the bridge')
    }
  }
  assert.ok(crossed)
  assert.ok(g.units.find(u => u.id === 900).hp < 10000, 'enemy across river is engaged')
})

test('units expose their upward-facing back and Ultra hits create a blood splash', () => {
  let g = deploy(fresh(), 0, 30, 22)
  g.aiClock = 10000
  g = tick(g, .1)
  assert.equal(g.units[0].facingBack, true)
  g.units.push({ ...g.units[0], id: 900, side: 'red', x: g.units[0].x + 1, y: g.units[0].y, hp: 1000 })
  g = tick(g, .05)
  assert.ok(g.blood.length >= 1)
  assert.ok(g.blood.some(splash => splash.x === g.units[1].x))
})

test('nearby units spread sideways instead of occupying the same spot', () => {
  let g = deploy(fresh(), 0, 30, 22)
  g.aiClock = 10000
  g.units.push({ ...g.units[0], id: 900, x: 30, y: 22, side: 'red', hp: 1000 })
  g = tick(g, .05)
  const a = g.units.find(u => u.id !== 900)
  const b = g.units.find(u => u.id === 900)
  assert.ok(a && b)
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 3.1)
  assert.ok(Math.abs(a.y - b.y) > 1, 'units choose visible side-by-side positions')
})

test('side-by-side units continue past each other instead of deadlocking', () => {
  let g = deploy(fresh(), 0, 30, 22)
  g = deploy(g, 1, 30, 22)
  g.aiClock = 10000
  for (let i = 0; i < 80; i++) g = tick(g, .05)
  assert.ok(g.units.every(u => u.x > 35), 'both units continue along the lane')
  assert.ok(Math.abs(g.units[0].y - g.units[1].y) > 1, 'the formation keeps a visible side offset')
})

test('new spell cards fly to their target and new unit cards deploy groups', () => {
  let smoke = deploy(newGame([8]), 0, 70, 22)
  assert.equal(smoke.spells[0].type, 'smoke')
  assert.equal(smoke.spells[0].fromX, 5)
  assert.equal(smoke.spells[0].fromY, 50)
  assert.equal(smoke.units.length, 0)
  let signal = deploy(newGame([9]), 0, 84, 13)
  signal.units.push({ ...deploy(newGame([0]), 0, 30, 22).units[0], id: 900, side: 'red', x: 84, y: 13, hp: 1000 })
  signal = tick(signal, 1.85)
  assert.ok(signal.units[0].hp < 1000, 'leuchtrakete damages after flight')
  assert.ok(signal.hp.redPubOne < 1200 || signal.hp.redPubTwo < 1200 || signal.hp.redFortress < 3000, 'leuchtrakete can damage buildings')
  assert.ok(deploy(newGame([14]), 0, 30, 22).units.length === 4, 'Auswärtsblock deploys as a group')
  assert.ok(deploy(newGame([15]), 0, 30, 22).units.length === 3, 'Pyro-Trupp deploys as a group')
})

test('group spawns are staggered instead of appearing all at once', () => {
  let g = deploy(newGame([14]), 0, 30, 22)
  assert.deepEqual(g.units.map(unit => unit.spawnDelay), [0, .16, .32, .48])
  g = tick(g, .1)
  assert.equal(g.units.filter(unit => (unit.spawnDelay ?? 0) <= 0).length, 1)
  g = tick(g, .4)
  assert.equal(g.units.filter(unit => (unit.spawnDelay ?? 0) <= 0).length, 4)
})

test('Fanmarsch ignores enemy units and only deals light damage to buildings', () => {
  let g = deploy(newGame([20]), 0, 30, 31)
  g.aiClock = 10000
  for (const key of ['bluePubOne', 'bluePubTwo', 'redPubOne', 'redPubTwo']) g.buildingCooldown[key] = 100
  const tank = g.units[0]
  Object.assign(tank, { x: 78, y: 13, routeIndex: 2, hp: cards[20].hp })
  g.units.push({ ...tank, id: 900, side: 'red', x: 79, y: 13, hp: 1000, cooldown: 100, card: { ...cards[0], speed: 0, damage: 999 } })
  const enemyHp = g.units[1].hp
  const pubHp = g.hp.redPubOne
  g = tick(g, .05)
  assert.equal(g.units.find(unit => unit.id === 900)?.hp, enemyHp)
  assert.equal(g.units[0].targetId, undefined)
  assert.equal(g.hp.redPubOne, pubHp - cards[20].damage)
})

test('faster friendly units stay behind the Fanmarsch unless distracted', () => {
  let g = deploy(newGame([0]), 0, 30, 22)
  g.aiClock = 10000
  for (const key of ['bluePubOne', 'bluePubTwo', 'redPubOne', 'redPubTwo']) g.buildingCooldown[key] = 100
  const follower = g.units[0]
  Object.assign(follower, { x: 64, y: 22, routeIndex: 2, hp: 10000 })
  g.units.push({
    ...follower,
    id: 900,
    x: 72,
    y: 22,
    card: cards[20],
    hp: cards[20].hp,
    cooldown: 100,
    targetId: undefined,
  })
  for (let i = 0; i < 120; i++) {
    g = tick(g, .05)
    const fast = g.units.find(unit => unit.id === follower.id)
    const tank = g.units.find(unit => unit.id === 900)
    if (!fast || !tank) break
    assert.ok(fast.x < tank.x + 4, 'the faster unit must not pass the banner')
  }
})

test('the formation advances once the Fanmarsch reaches a building', () => {
  let g = deploy(newGame([0]), 0, 30, 22)
  g.aiClock = 10000
  for (const key of ['bluePubOne', 'bluePubTwo', 'redPubOne', 'redPubTwo']) g.buildingCooldown[key] = 100
  const follower = g.units[0]
  Object.assign(follower, { x: 60, y: 22, routeIndex: 2, hp: 10000 })
  g.units.push({
    ...follower,
    id: 900,
    x: 78,
    y: 13,
    card: cards[20],
    hp: cards[20].hp,
    cooldown: 100,
    targetId: undefined,
  })
  g = tick(g, .05)
  assert.ok(g.units[0].x > 60.15, 'the follower should use its own speed after the tank stops')
})

test('smoke bomb heavily slows and lightly damages enemy troops', () => {
  let g = deploy(newGame([8]), 0, 70, 22)
  g.aiClock = 10000
  const enemy = { ...deploy(newGame([0]), 0, 30, 22).units[0], id: 900, side: 'red', x: 70, y: 22, hp: 1000, cooldown: 100 }
  g.units.push(enemy)
  const beforeX = enemy.x
  g = tick(g, .5)
  assert.ok(g.units[0].hp < 1000, 'smoke bomb deals light area damage')
  assert.ok(Math.abs(g.units[0].x - beforeX) < 1.5, 'smoke bomb strongly slows movement')
})

test('beer flies before damaging a unit, leaves a puddle and expires without repeated damage', () => {
  let g = deploy(fresh(), 2, 30, 45)
  g.aiClock = 10000
  for (const key of ['bluePubOne', 'bluePubTwo', 'redPubOne', 'redPubTwo']) g.buildingCooldown[key] = 100
  g.units.push({ ...g.units[0], id: 900, side: 'red', x: 35, cooldown: 100, card: { ...cards[0], speed: 0 }, hp: 430 })
  g = tick(g, .05)
  assert.equal(g.beers.length, 1)
  assert.equal(g.units[1].hp, 430)
  g.units[0].cooldown = 100
  const launched = g
  g = tick(g, BEER_FLIGHT / 2)
  assert.equal(g.units[1].hp, 430)
  assert.equal(g.puddles.length, 0)
  g = tick(g, BEER_FLIGHT / 2)
  assert.equal(g.beers.length, 0)
  assert.equal(g.units[1].hp, 430 - cards[2].damage)
  assert.equal(g.puddles.length, 1)
  assert.equal(launched.puddles.length, 0)
  g = tick(g, PUDDLE_LIFETIME - .1)
  assert.equal(g.puddles.length, 1)
  g = tick(g, .11)
  assert.equal(g.puddles.length, 0)
  assert.equal(g.units[1].hp, 430 - cards[2].damage)
})

test('beer also impacts buildings and safely lands if a unit target disappears', () => {
  let g = deploy(fresh(), 2, 30, 31)
  g.aiClock = 10000
  Object.assign(g.units[0], { x: 70, y: 13, routeIndex: 2 })
  g = tick(g, .05)
  assert.equal(g.beers[0].target, 'redPubOne')
  assert.equal(g.hp.redPubOne, 1200)
  g = tick(g, BEER_FLIGHT)
  assert.equal(g.hp.redPubOne, 1200 - cards[2].damage)
  assert.equal(g.puddles.length, 1)
  g.beers = [{ id: 999, fromX: 30, fromY: 30, x: 40, y: 40, target: 9999, age: 0, damage: 35 }]
  g = tick(g, BEER_FLIGHT)
  assert.ok(g.puddles.some(p => p.id === 999 && p.x === 40 && p.y === 40))
})

test('pyro throws before impact, applies enemy-only splash and leaves temporary ground fire', () => {
  let g = deploy(newGame([7, 0, 1, 2, 3, 4, 5, 6]), 0, 30, 45)
  g.aiClock = 10000
  for (const key of ['bluePubOne', 'bluePubTwo', 'redPubOne', 'redPubTwo']) g.buildingCooldown[key] = 100
  const stationary = { ...g.units[0], cooldown: 100, hp: 1000, card: { ...cards[0], speed: 0 } }
  g.units.push({ ...stationary, id: 900, side: 'red', x: 38, y: 45 })
  g.units.push({ ...stationary, id: 901, side: 'red', x: 39, y: 47 })
  g.units.push({ ...stationary, id: 902, side: 'blue', x: 38, y: 47 })
  g = tick(g, .05)
  assert.equal(g.torches.length, 1)
  assert.equal(g.units[1].hp, 1000)
  g.units[0].cooldown = 100
  const original = g
  g = tick(g, TORCH_FLIGHT / 2)
  assert.equal(g.fires.length, 0)
  assert.equal(g.units[1].hp, 1000)
  g = tick(g, TORCH_FLIGHT / 2)
  assert.equal(g.torches.length, 0)
  assert.equal(g.units[1].hp, 1000 - cards[7].damage)
  assert.equal(g.units[2].hp, 1000 - cards[7].damage * .6)
  assert.equal(g.units[3].hp, 1000)
  assert.equal(g.fires.length, 1)
  assert.equal(original.fires.length, 0)
  g = tick(g, FIRE_LIFETIME - .1)
  assert.equal(g.fires.length, 1)
  assert.equal(g.units[1].hp, 1000 - cards[7].damage, 'ground fire is a visual afterburn')
  g = tick(g, .11)
  assert.equal(g.fires.length, 0)
})

test('pyro torch hits buildings after flight and still lands if the thrower dies', () => {
  let g = deploy(newGame([7, 0, 1, 2, 3, 4, 5, 6]), 0, 30, 31)
  g.aiClock = 10000
  Object.assign(g.units[0], { x: 73, y: 13, routeIndex: 2 })
  g = tick(g, .05)
  assert.equal(g.torches[0].target, 'redPubOne')
  assert.equal(g.hp.redPubOne, 1200)
  g.units = []
  g = tick(g, TORCH_FLIGHT)
  assert.equal(g.hp.redPubOne, 1200 - cards[7].damage)
  assert.equal(g.fires.length, 1)
  assert.equal(g.fires[0].x, rectCenter(TILE_BUILDINGS.redPubOne).x)
  assert.equal(g.fires[0].y, rectCenter(TILE_BUILDINGS.redPubOne).y)
  assert.equal(newGame([0,1,2,3,4,5,6,7]).fires.length, 0)
})
