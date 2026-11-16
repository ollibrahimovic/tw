import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromTile, toTile, tileDistance, validTile, walkablePoint, TILE_BUILDINGS, insideRect } from '../src/grid.ts'
import { newGame, deploy, canDeploy, cards, buildings, tick } from '../src/game.ts'

test('arena contains exactly 556 symmetric tiles including partial end rows', () => {
  let count = 0
  for (let y = -1; y <= 32; y++) for (let x = 0; x <= 19; x++) {
    const valid = validTile(x, y)
    assert.equal(valid, validTile(19 - x, 31 - y))
    if (valid) {
      count++
      const roundTrip = toTile(fromTile({ x, y }))
      assert.ok(Math.abs(roundTrip.x - x) < 1e-10 && Math.abs(roundTrip.y - y) < 1e-10)
    }
  }
  assert.equal(count, 556)
})

test('distances are isotropic tiles, not stretched renderer coordinates', () => {
  const p = fromTile({ x: 8, y: 20 })
  assert.ok(Math.abs(tileDistance(p, fromTile({ x: 9, y: 20 })) - 1) < 1e-10)
  assert.ok(Math.abs(tileDistance(p, fromTile({ x: 8, y: 21 })) - 1) < 1e-10)
  assert.equal(tileDistance(p, fromTile({ x: 11, y: 24 })), 5)
})

test('building rectangles have exact footprints and do not overlap', () => {
  const occupied = new Set()
  for (const [key, rect] of Object.entries(TILE_BUILDINGS)) {
    const size = key.includes('Fortress') ? 4 : 3
    assert.equal(rect.right - rect.left + 1, size)
    assert.equal(rect.bottom - rect.top + 1, size)
    assert.ok(insideRect(buildings.find(b => b.key === key), rect))
    for (let y = rect.top; y <= rect.bottom; y++) for (let x = rect.left; x <= rect.right; x++) {
      const id = `${x},${y}`
      assert.ok(!occupied.has(id))
      occupied.add(id)
    }
  }
})

test('middle barrier is only passable on the two 3x2 bridges', () => {
  for (let y = 15; y <= 16; y++) for (let x = 1; x <= 18; x++) {
    assert.equal(walkablePoint(fromTile({ x, y })), (x >= 3 && x <= 5) || (x >= 14 && x <= 16))
  }
})

test('deployment snaps to tiles but subsequent movement remains continuous', () => {
  const p = fromTile({ x: 7.2, y: 20.1 })
  let game = deploy(newGame([0]), 0, p.x, p.y)
  const initial = toTile(game.units[0])
  assert.ok(Math.abs(initial.x - 7) < 1e-10 && Math.abs(initial.y - 20) < 1e-10)
  game.aiClock = 10000
  game = tick(game, .05)
  const moved = toTile(game.units[0])
  assert.ok(Math.abs(moved.y - Math.round(moved.y)) > .001)
})

test('end rows, occupied buildings and central barrier constrain deployment', () => {
  const g = newGame([0])
  for (let x = 1; x <= 18; x++) {
    const p = fromTile({ x, y: 31 })
    assert.equal(canDeploy(g, cards[0], p.x, p.y), x >= 6 && x <= 13)
  }
  for (const y of [15, 16]) {
    const p = fromTile({ x: 4, y })
    assert.equal(canDeploy(g, cards[0], p.x, p.y), false)
  }
  const pub = fromTile({ x: 4, y: 25 })
  assert.equal(canDeploy(g, cards[0], pub.x, pub.y), false)
})
