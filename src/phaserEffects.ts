import type Phaser from 'phaser'
import { buildings, BEER_FLIGHT, TORCH_FLIGHT, FLARE_FLIGHT, FIRE_LIFETIME, PUDDLE_LIFETIME, SPELL_FLIGHT } from './game'
import type { Game } from './game'

type Point = { x: number; y: number }

export function createArenaEffects(scene: Phaser.Scene, project: (x: number, y: number) => Point) {
  const ground = scene.add.graphics().setDepth(.5)
  const air = scene.add.graphics().setDepth(5)
  const stroke = (a: Point, b: Point, color: number, width: number, alpha = 1) =>
    air.lineStyle(width, color, alpha).lineBetween(a.x, a.y, b.x, b.y)
  const flame = (p: Point, size: number, time: number, seed: number, alpha = 1) => {
    const sway = Math.sin(time * 19 + seed) * size * .25
    air.fillStyle(0xff6b25, alpha * .15).fillCircle(p.x, p.y - size * .5, size * 1.2)
    air.fillStyle(0xf65522, alpha).fillTriangle(p.x - size * .55, p.y, p.x + sway, p.y - size * 2, p.x + size * .55, p.y)
    air.fillStyle(0xffbd4e, alpha).fillTriangle(p.x - size * .3, p.y, p.x - sway * .4, p.y - size * 1.4, p.x + size * .35, p.y)
    air.fillStyle(0xfff0bc, alpha).fillEllipse(p.x, p.y - size * .2, size * .4, size * .7)
  }
  const arc = (start: Point, end: Point, lift: number, t: number) => ({
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t - Math.sin(Math.PI * t) * lift,
  })
  const smoke = (p: Point, age: number, seed: number, alpha: number) => {
    air.fillStyle(0xa5a396, alpha).fillCircle(p.x + Math.sin(seed) * age * 8, p.y - age * 24, 2 + age * 7)
  }
  const spray = (p: Point, t: number, color: number) => {
    if (t < 0 || t > 1) return
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.399
      air.fillStyle(i % 3 ? color : 0xffe6ab, 1 - t)
        .fillCircle(p.x + Math.cos(angle) * t * 26,
          p.y + Math.sin(angle) * t * 10 - 24 * Math.sin(Math.PI * t), 1.8 * (1 - t) + .5)
    }
  }
  return (game: Game, extraAge: number, time: number) => {
    ground.clear()
    air.clear()
    for (const puddle of game.puddles) {
      const age = puddle.age + extraAge
      const fade = Math.max(0, Math.min(1, (PUDDLE_LIFETIME - age) / .8))
      const p = project(puddle.x, puddle.y)
      const spread = .5 + Math.min(1, age / .25) * .5
      ground.fillStyle(0xbd852d, .6 * fade).fillEllipse(p.x, p.y, 32 * spread, 12 * spread)
      ground.lineStyle(1, 0xffe9ae, .6 * fade).strokeEllipse(p.x, p.y, 29 * spread, 10 * spread)
      for (let i = 0; i < 6; i++) {
        ground.fillStyle(0xffefcb, .7 * fade).fillCircle(p.x + Math.sin(i * 3) * 11 * spread, p.y + Math.cos(i * 2) * 4, 1.2)
      }
      spray(p, age / .4, 0xe9b348)
    }
    for (const fire of game.fires) {
      const age = fire.age + extraAge
      const fade = Math.max(0, Math.min(1, (FIRE_LIFETIME - age) / .7))
      const p = project(fire.x, fire.y)
      ground.fillStyle(0x25170e, .6 * fade).fillEllipse(p.x, p.y, 28, 11)
      ground.fillStyle(0xf77c25, .25 * fade).fillEllipse(p.x, p.y, 24, 9)
      for (let i = 0; i < 5; i++) {
        const at = { x: p.x + Math.sin(i * 4) * 10, y: p.y + Math.cos(i * 3) * 3 }
        flame(at, 4 + (i % 3), time, fire.id + i, fade)
        smoke(at, (time * .65 + i * .23) % 1.4, i, .22 * fade)
      }
    }
    for (const beer of game.beers) {
      const start = project(beer.fromX, beer.fromY)
      start.x += 11
      start.y -= 18
      const end = project(beer.x, beer.y)
      const t = Math.min(1, (beer.age + extraAge) / BEER_FLIGHT)
      const p = arc(start, end, 35, t)
      // Rotate the cup and foam together around their flight position.
      air.save().translateCanvas(p.x, p.y).rotateCanvas(t * 4.5 * (end.x >= start.x ? 1 : -1))
      air.fillStyle(0xe8e6c9, .95).fillTriangle(-4, -5, 4, -5, 0, 6)
      air.fillStyle(0xd89b27, 1).fillRect(-2.5, -2, 5, 5)
      air.fillStyle(0xfff2d7, 1).fillEllipse(0, -5, 9, 3)
      air.restore()
      for (let i = 1; i <= 3; i++) {
        const tail = arc(start, end, 35, Math.max(0, t - i * .045))
        air.fillStyle(0xffd78b, .7 - i * .15).fillCircle(tail.x, tail.y + i * 2, 1.2)
      }
    }
    for (const torch of game.torches) {
      const start = project(torch.fromX, torch.fromY)
      start.x += 13
      start.y -= 28
      const end = project(torch.x, torch.y)
      const t = Math.min(1, (torch.age + extraAge) / TORCH_FLIGHT)
      const p = arc(start, end, 38, t)
      for (let i = 1; i <= 5; i++) {
        if (t < i * .045) continue
        smoke(arc(start, end, 38, t - i * .045), i * .09, i, .25 - i * .035)
      }
      const angle = t * 5.5
      const tip = { x: p.x + Math.sin(angle) * 5, y: p.y - Math.cos(angle) * 5 }
      stroke({ x: p.x - Math.sin(angle) * 5, y: p.y + Math.cos(angle) * 5 }, tip, 0xbda177, 3)
      flame(tip, 4.5, time, torch.id)
    }
    for (const flare of game.flares) {
      const building = buildings.find(b => b.key === flare.source)
      if (!building) continue
      const gatling = building.key.includes('Fortress')
      const start = project(building.x, building.y)
      start.x += (gatling ? 2.64 : 18) * .56
      start.y -= (gatling ? 109.7712 : 85) * .56
      const end = project(flare.x, flare.y)
      end.y -= 12
      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      if (gatling) {
        start.x += Math.cos(angle) * 18.6
        start.y += Math.sin(angle) * 18.6
      }
      const age = flare.age + extraAge
      const t = Math.min(1, age / FLARE_FLIGHT)
      const p = arc(start, end, gatling ? 0 : 41, t)
      for (let i = 1; i <= 5; i++) {
        if (t < i * .05) continue
        smoke(arc(start, end, gatling ? 0 : 41, t - i * .05), i * .08, i, .22 - i * .03)
      }
      if (gatling) {
        stroke(arc(start, end, 0, Math.max(0, t - .13)), p, 0xff952c, 3, .7)
        stroke({ x: p.x - Math.cos(angle) * 7, y: p.y - Math.sin(angle) * 7 }, p, 0xffe0a4, 3)
        if (age < .12) {
          air.fillStyle(0xffdb7b, 1 - age / .12).fillCircle(start.x, start.y, 7)
          flame(start, 6, time, flare.id, 1 - age / .12)
        }
      } else flame(p, 5, time, flare.id)
    }
    for (const spell of game.spells) {
      const target = project(spell.x, spell.y)
      const start = project(spell.fromX, spell.fromY)
      const raw = Math.min(1, (spell.age + extraAge) / SPELL_FLIGHT)
      const flight = 1 - Math.pow(1 - raw, 1.65)
      const flying = (spell.type === 'signal' || spell.type === 'salvo') && raw < 1
      if (spell.type === 'smoke') {
        const life = Math.max(0, 1 - spell.age / 7.5)
        const pulse = 1 + Math.sin(time * 2.5 + spell.id) * .08
        air.fillStyle(0x111b19, .32 * life).fillEllipse(target.x, target.y + 4, 85 * pulse, 35 * pulse)
        for (let i = 0; i < 9; i++) {
          const angle = i * 2.399 + spell.id
          const cloud = {
            x: target.x + Math.cos(angle) * (30 + (i % 3) * 12) * pulse,
            y: target.y - 5 + Math.sin(angle) * (14 + (i % 2) * 7) * pulse - (time * 9 + i * 8) % 18,
          }
          air.fillStyle(i % 2 ? 0x5b655e : 0x788078, (.18 + (i % 3) * .035) * life)
            .fillCircle(cloud.x, cloud.y, (14 + (i % 4) * 4) * pulse)
        }
        continue
      }
      const rockets = spell.type === 'salvo' ? 3 : 1
      for (let i = 0; i < rockets; i++) {
        const offset = spell.type === 'salvo' ? (i - 1) * 9 : 0
        const from = { x: start.x, y: start.y + offset }
        const to = { x: target.x, y: target.y + offset }
        const p = arc(from, to, 62 + Math.abs(offset), flight)
        const tangent = {
          x: (to.x - from.x) - Math.cos(Math.PI * flight) * 62,
          y: (to.y - from.y) - Math.cos(Math.PI * flight) * 62,
        }
        const angle = Math.atan2(tangent.y, tangent.x)
        if (flying) {
          for (let trail = 1; trail <= 4; trail++) {
            const tail = arc(from, to, 62 + Math.abs(offset), Math.max(0, flight - trail * .045))
            air.fillStyle(trail % 2 ? 0x9b9c8d : 0xd1b77d, .55 - trail * .1)
              .fillCircle(tail.x, tail.y, 3.5 - trail * .5)
          }
          air.save().translateCanvas(p.x, p.y).rotateCanvas(angle)
          air.fillStyle(0xd7d0ad, .95).fillTriangle(-9, -3, 7, -3, 12, 0)
          air.fillStyle(0x73746a, .9).fillRect(-9, -3, 8, 6)
          air.fillStyle(0xff7b2b, 1).fillTriangle(-9, 0, -23, -6, -19, 0)
          air.fillStyle(0xffd269, 1).fillTriangle(-9, 0, -19, 0, -23, 6)
          air.restore()
        } else {
          const age = Math.max(0, spell.age - SPELL_FLIGHT)
          const fade = Math.max(0, 1 - age / (spell.type === 'salvo' ? 2.5 : 1.9))
          const impact = { x: target.x + offset, y: target.y + offset }
          air.fillStyle(spell.type === 'salvo' ? 0xff6b25 : 0xffbf48, .2 * fade)
            .fillCircle(impact.x, impact.y, (42 + age * 8) * fade)
          flame(impact, spell.type === 'salvo' ? 8 : 6, time + i, spell.id + i, fade)
          for (let spark = 0; spark < 7; spark++) {
            const a = spark * Math.PI / 3.5
            stroke(impact, {
              x: impact.x + Math.cos(a) * (12 + age * 20),
              y: impact.y + Math.sin(a) * (8 + age * 14),
            }, 0xffce68, 1.5, fade)
          }
        }
      }
    }
    for (const impact of game.impacts) {
      const age = impact.age + extraAge
      const p = project(impact.x, impact.y)
      spray(p, age / .45, 0xff9136)
      air.lineStyle(2, 0xffcc77, Math.max(0, 1 - age / .45))
        .strokeEllipse(p.x, p.y, 10 + age * 55, 5 + age * 25)
    }
  }
}
