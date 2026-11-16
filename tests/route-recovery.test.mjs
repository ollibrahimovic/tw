import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cards, deploy, newGame, tick } from '../src/game.ts'
import { toTile } from '../src/grid.ts'

test('a unit does not retreat to an old lane waypoint after defeating a pursuer', () => {
  let game = deploy(newGame([0]), 0, 30, 31)
  game.aiClock = 10000
  const unit = game.units[0]
  unit.x = 73
  unit.y = 25
  unit.routeIndex = 2
  unit.hp = 10000
  game.units.push({
    ...unit,
    id: 900,
    side: 'red',
    x: 74,
    y: 25,
    hp: 1,
    cooldown: 100,
    card: { ...cards[0], speed: 0, damage: 0 },
  })
  let maximumDepth = toTile(unit).y
  let sawKill = false
  for (let i = 0; i < 40; i++) {
    game = tick(game, .05)
    const current = game.units.find(u => u.id === unit.id)
    if (!current) break
    const depth = toTile(current).y
    if (game.units.every(u => u.id !== 900)) sawKill = true
    if (sawKill) assert.ok(depth <= maximumDepth + .05, 'unit must not move back toward its own goal')
    maximumDepth = Math.min(maximumDepth, depth)
  }
  assert.equal(sawKill, true)
})
