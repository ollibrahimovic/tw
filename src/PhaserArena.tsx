import { useEffect, useRef } from 'react'
import type PhaserType from 'phaser'
import { buildings, canDeploy } from './game'
import type { Card, Game, Side } from './game'

type PhaserArenaProps = {
  game: Game
  selectedCard: Card
  active: boolean
  perspective?: Side
  onPlace: (x: number, y: number, drop: boolean) => void
}

type ArenaScene = PhaserType.Scene & {
  create: () => void
  renderArena?: () => void
}

type Point = { x: number; y: number }

const BLUE = 0x64c9bd
const RED = 0xe9754e
const CREAM = 0xe7dfb4
const DARK = 0x101815

function cardColor(card: Card) {
  if (card.name === 'Flitzer') return 0xc58f72
  if (card.kind === 'building') return 0xc99b42
  if (card.kind === 'spell') return 0xd5a53b
  return 0xef8d32
}

/**
 * Phaser renderer, phase two of the migration.
 *
 * The game rules still live in game.ts. This layer only turns the current
 * state into pixels and owns pointer input, so it can eventually replace the
 * SVG arena without changing multiplayer or simulation code.
 */
export function PhaserArena({ game, selectedCard, active, perspective = 'blue', onPlace }: PhaserArenaProps) {
  const host = useRef<HTMLDivElement>(null)
  const gameRef = useRef(game)
  const selectedRef = useRef(selectedCard)
  const activeRef = useRef(active)
  const perspectiveRef = useRef(perspective)
  const onPlaceRef = useRef(onPlace)

  gameRef.current = game
  selectedRef.current = selectedCard
  activeRef.current = active
  perspectiveRef.current = perspective
  onPlaceRef.current = onPlace

  useEffect(() => {
    if (!host.current) return

    let instance: PhaserType.Game | undefined
    let disposed = false
    void import('phaser').then(({ default: Phaser }) => {
      if (disposed || !host.current) return

      const scene = new Phaser.Scene('TerraceWarsArena') as ArenaScene
      scene.create = function () {
        const graphics = this.add.graphics()
        const label = this.add.text(0, 0, '', {
          color: '#dfe7b0',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '12px',
        }).setDepth(20)
        let hover: Point | null = null
        let animationClock = 0

        const metrics = () => {
          const width = this.scale.width
          const height = this.scale.height
          const left = Math.max(18, width * .08)
          return { width, height, left, top: 18, pitchWidth: width - left * 2, pitchHeight: height - 36 }
        }

        const toScreen = (x: number, y: number): Point => {
          const m = metrics()
          const depth = perspectiveRef.current === 'red' ? 100 - x : x
          return {
            x: m.left + y / 100 * m.pitchWidth,
            y: m.top + (100 - depth) / 100 * m.pitchHeight,
          }
        }

        const fromPointer = (pointer: Phaser.Input.Pointer): Point => {
          const m = metrics()
          const lane = Phaser.Math.Clamp((pointer.x - m.left) / m.pitchWidth * 100, 0, 100)
          const depth = Phaser.Math.Clamp(100 - (pointer.y - m.top) / m.pitchHeight * 100, 0, 100)
          return { x: perspectiveRef.current === 'red' ? 100 - depth : depth, y: lane }
        }

        const line = (a: Point, b: Point, color: number, width: number, alpha = 1) => {
          graphics.lineStyle(width, color, alpha)
          graphics.lineBetween(a.x, a.y, b.x, b.y)
        }

        const polygon = (points: Point[], fill: number, alpha = 1, stroke = CREAM) => {
          graphics.fillStyle(fill, alpha)
          const vectors = points.map(point => new Phaser.Math.Vector2(point.x, point.y))
          graphics.fillPoints(vectors, true)
          graphics.lineStyle(1.5, stroke, .55)
          graphics.strokePoints(vectors, true)
        }

        const drawPitch = () => {
          const m = metrics()
          graphics.fillStyle(0x111a14, 1)
          graphics.fillRect(0, 0, m.width, m.height)
          graphics.fillStyle(0x465b3d, 1)
          graphics.fillRoundedRect(m.left, m.top, m.pitchWidth, m.pitchHeight, 8)
          graphics.lineStyle(2, CREAM, .7)
          graphics.strokeRoundedRect(m.left, m.top, m.pitchWidth, m.pitchHeight, 8)

          for (let i = 1; i < 12; i++) {
            const y = m.top + m.pitchHeight * i / 12
            line({ x: m.left, y }, { x: m.left + m.pitchWidth, y }, 0x17251b, 1, .22)
          }

          // Two shared Clash-style lanes. They start at the clubhouses, pass
          // through the pubs, bend toward the matching fence opening, and
          // continue symmetrically into the opponent's half.
          for (const lane of [0, 1]) {
            const pubY = lane === 0 ? 13 : 83
            const bridgeY = lane === 0 ? 22 : 74
            const points = [
              toScreen(5, 50),
              toScreen(14, 50),
              toScreen(24, pubY),
              toScreen(34, pubY),
              toScreen(44, bridgeY),
              toScreen(58, bridgeY),
              toScreen(68, pubY),
              toScreen(76, pubY),
              toScreen(86, pubY),
              toScreen(95, 50),
            ]
            line(points[0], points[1], 0x172018, 25, .95)
            for (let i = 1; i < points.length; i++) {
              line(points[i - 1], points[i], 0x172018, 25, .95)
              line(points[i - 1], points[i], lane === 0 ? 0x849d77 : 0x907964, 18, .9)
              line(points[i - 1], points[i], 0xd0c18e, 1.2, .8)
            }
          }

          const fenceY = m.top + m.pitchHeight * .5
          const openings = [22, 74].map(lane => m.left + m.pitchWidth * lane / 100)
          const openingWidth = Math.max(34, m.pitchWidth * .1)
          const fenceSegments: Array<[number, number]> = [
            [m.left, openings[0] - openingWidth / 2],
            [openings[0] + openingWidth / 2, openings[1] - openingWidth / 2],
            [openings[1] + openingWidth / 2, m.left + m.pitchWidth],
          ]
          for (const [from, to] of fenceSegments) {
            line({ x: from, y: fenceY }, { x: to, y: fenceY }, 0x101610, 10, .95)
            line({ x: from, y: fenceY - 5 }, { x: to, y: fenceY - 5 }, 0x87947b, 2, .85)
            line({ x: from, y: fenceY + 5 }, { x: to, y: fenceY + 5 }, 0x596b59, 2, .85)
            for (let x = from + 14; x < to; x += 22) line({ x, y: fenceY - 12 }, { x, y: fenceY + 12 }, 0x4c5b4b, 4, .9)
          }
          for (const opening of openings) {
            graphics.fillStyle(0x8e7047, 1)
            graphics.fillRect(opening - openingWidth / 2, fenceY - 10, openingWidth, 20)
            for (let x = opening - openingWidth / 2 + 6; x < opening + openingWidth / 2; x += 10) {
              line({ x, y: fenceY - 9 }, { x: x + 8, y: fenceY + 9 }, 0xd3b77d, 2, .75)
            }
          }

        }

        const drawBuilding = (building: typeof buildings[number]) => {
          const hp = gameRef.current.hp[building.key]
          if (hp <= 0) return
          const p = toScreen(building.x, building.y)
          const fortress = building.key.includes('Fortress')
          const width = fortress ? 48 : 36
          const height = fortress ? 34 : 28
          const color = building.side === 'blue' ? BLUE : RED
          const roofY = p.y - height / 2 - 10
          polygon([
            { x: p.x, y: roofY - 9 },
            { x: p.x + width / 2, y: roofY },
            { x: p.x, y: roofY + 9 },
            { x: p.x - width / 2, y: roofY },
          ], 0x252f2c, .98)
          polygon([
            { x: p.x - width / 2, y: p.y - height / 2 },
            { x: p.x, y: p.y - height / 2 + 9 },
            { x: p.x, y: p.y + height / 2 },
            { x: p.x - width / 2, y: p.y + height / 2 - 9 },
          ], 0x67665a, 1, 0x242d27)
          polygon([
            { x: p.x, y: p.y - height / 2 + 9 },
            { x: p.x + width / 2, y: p.y - height / 2 },
            { x: p.x + width / 2, y: p.y + height / 2 - 9 },
            { x: p.x, y: p.y + height / 2 },
          ], 0x414b43, 1, 0x242d27)
          graphics.fillStyle(color, 1)
          graphics.fillRect(p.x - width / 2 + 3, p.y - 3, width - 6, 7)
          graphics.lineStyle(1, 0x8a8d78, .45)
          for (let i = -1; i <= 1; i++) line({ x: p.x - width / 2 + 5, y: p.y + i * 7 }, { x: p.x + width / 2 - 5, y: p.y + i * 7 }, 0x242d27, 1, .45)
          graphics.fillStyle(0xc7a665, 1)
          graphics.fillRect(p.x - width / 2 + 5, p.y - 3, 7, 9)
          graphics.fillRect(p.x + width / 2 - 12, p.y - 4, 7, 10)
          if (!fortress) {
            graphics.fillStyle(building.side === 'blue' ? 0xd8c77e : 0xd08b50, 1)
            graphics.fillRect(p.x - 13, p.y - height / 2 - 15, 26, 10)
            graphics.fillStyle(DARK, .8)
            graphics.fillRect(p.x - 9, p.y - height / 2 - 12, 18, 2)
          }
          graphics.fillStyle(DARK, .8)
          graphics.fillRect(p.x - 18, p.y + height / 2 + 5, 36, 3)
          graphics.fillStyle(color, 1)
          graphics.fillRect(p.x - 18, p.y + height / 2 + 5, 36 * hp / building.max, 3)
          graphics.lineStyle(1.5, 0xa8a794, .9)
          line({ x: p.x, y: roofY - 8 }, { x: p.x, y: roofY - 29 }, 0xa8a794, 1.5, .9)
          graphics.fillStyle(color, 1)
          graphics.fillTriangle(p.x, roofY - 29, p.x + 14, roofY - 24, p.x, roofY - 19)
        }

        const drawUltra = (unit: Game['units'][number], ghost = false) => {
          const p = toScreen(unit.x, unit.y)
          const scale = .72
          const point = (x: number, y: number): Point => ({ x: p.x + x * scale, y: p.y + y * scale })
          const shape = (points: Array<[number, number]>, fill: number, alpha = 1, stroke = DARK) =>
            polygon(points.map(([x, y]) => point(x, y)), fill, alpha, stroke)
          const stroke = (a: [number, number], b: [number, number], color: number, width: number, alpha = 1) =>
            line(point(a[0], a[1]), point(b[0], b[1]), color, width * scale, alpha)
          const team = unit.side === 'blue' ? BLUE : RED
          const opacity = ghost ? .48 : 1
          const skin = unit.side === 'blue' ? 0xc39170 : 0xa9795d
          const jersey = 0x273134
          const scarf = unit.side === 'blue' ? 0x5baaa0 : 0xc46249
          const phase = animationClock * .012 + unit.id * .7
          const movement = unit.moving ? 1 : .22
          const legSwing = Math.sin(phase) * 11 * movement
          const armSwing = Math.sin(phase + Math.PI) * 6 * movement
          const distanceTo = (a: { x: number; y: number }, b: { x: number; y: number }) =>
            Math.hypot(a.x - b.x, a.y - b.y)
          const target = gameRef.current.units.find(other =>
            other.id === unit.targetId && other.side !== unit.side && other.hp > 0)
          const enemyStructureInRange = gameRef.current.structures.some(structure =>
            structure.side !== unit.side && structure.hp > 0 && distanceTo(unit, structure) <= unit.card.range + 1)
          const enemyBuildingInRange = buildings.some(building =>
            building.side !== unit.side &&
            gameRef.current.hp[building.key] > 0 &&
            distanceTo(unit, building) <= unit.card.range + 8)
          const punching = unit.card.range <= 4 && (
            (!!target && distanceTo(unit, target) <= unit.card.range + 1) ||
            enemyStructureInRange ||
            enemyBuildingInRange
          )
          const punch = punching ? Math.max(0, Math.sin(animationClock * .024 + unit.id)) : 0
          const focus = target ??
            gameRef.current.structures.find(structure => structure.side !== unit.side && structure.hp > 0) ??
            buildings.find(building => building.side !== unit.side && gameRef.current.hp[building.key] > 0)
          const focusScreen = focus ? toScreen(focus.x, focus.y) : undefined
          const forward = focusScreen && Math.abs(focusScreen.y - p.y) > 1
            ? (focusScreen.y < p.y ? -1 : 1)
            : (unit.side === 'blue' ? -1 : 1)
          const back = unit.facingBack || (unit.side === 'red' && unit.moving)

          // The Ultra is intentionally drawn as a chunky, readable game
          // silhouette rather than another circular unit marker.
          graphics.fillStyle(0x080d0c, .52 * opacity)
          graphics.fillEllipse(p.x, p.y + 13 * scale, 31 * scale, 8 * scale)
          shape([
            [-9, 5 + legSwing], [-4, 5 - legSwing], [-6, 16], [-13, 17], [-10, 12],
          ], 0x202626, opacity)
          shape([
            [3, 5 - legSwing], [9, 4 + legSwing], [13, 15], [7, 17], [1, 11],
          ], 0x202626, opacity)

          // Shoulders, raised arms and clenched fists.
          shape([
            [-12, -19], [-21, -12 + armSwing], [-23, -3 + armSwing],
            [-18, -1 + armSwing], [-11, -10],
          ], skin, opacity)
          shape([
            [12, -19], [18 + punch * 5, -12 - armSwing + forward * punch * 9],
            [20 + punch * 8, -3 - armSwing + forward * punch * 15],
            [16 + punch * 6, -1 - armSwing + forward * punch * 13], [11, -10],
          ], skin, opacity)
          stroke([-17, -7 + armSwing], [-20, -2 + armSwing], 0x8b5948, 1.2, opacity)
          stroke([17 + punch * 4, -7 - armSwing + forward * punch * 8],
            [20 + punch * 8, -2 - armSwing + forward * punch * 13], 0x8b5948, 1.2, opacity)
          graphics.fillStyle(skin, opacity)
          const leftFist = point(-19, -2 + armSwing)
          const rightFist = point(19 + punch * 8, -2 - armSwing + forward * punch * 15)
          graphics.fillCircle(leftFist.x, leftFist.y, 4 * scale)
          graphics.fillCircle(rightFist.x, rightFist.y, 4 * scale)

          // Athletic sleeveless vest with broad shoulders and a narrow waist.
          shape([
            [-13, -19], [-8, -25], [8, -25], [13, -19],
            [9, 7], [0, 11], [-10, 7],
          ], jersey, opacity)
          if (!back) {
            stroke([-9, -19], [-6, -12], skin, 2.2, opacity)
            stroke([9, -19], [6, -12], skin, 2.2, opacity)
            graphics.fillStyle(scarf, opacity)
            graphics.fillRect(p.x - 11 * scale, p.y - 13 * scale, 22 * scale, 6 * scale)
            graphics.fillStyle(0xd0c18e, .8 * opacity)
            graphics.fillRect(p.x - 8 * scale, p.y - 12 * scale, 3 * scale, 4 * scale)
            graphics.fillRect(p.x + 5 * scale, p.y - 12 * scale, 3 * scale, 4 * scale)
            stroke([-7, -4], [7, -4], 0x93958a, 1, .65 * opacity)
            stroke([0, -7], [0, 7], 0x93958a, 1, .55 * opacity)
          }

          // Short black hair and a scarred front. The back stays clean and
          // only shows the rear of the head and hair.
          graphics.fillStyle(skin, opacity)
          graphics.fillCircle(p.x, p.y - 31 * scale, 13 * scale)
          graphics.lineStyle(1.5 * scale, DARK, opacity)
          graphics.strokeCircle(p.x, p.y - 31 * scale, 13 * scale)
          shape([
            [-11, -34], [-10, -41], [-5, -45], [3, -45], [10, -41],
            [11, -34], [10, -28], [6, -26], [-5, -26], [-10, -29],
          ], 0x15191a, opacity, DARK)
          if (!back) {
            stroke([-7, -41], [-4, -45], 0x3d4540, 1, .8 * opacity)
            stroke([0, -43], [3, -45], 0x3d4540, 1, .8 * opacity)
          }
          if (back) {
            shape([
              [-11, -35], [-10, -29], [-8, -24], [-4, -26], [-3, -35],
              [4, -35], [5, -26], [9, -24], [11, -30], [11, -35],
            ], 0x15191a, opacity, DARK)
          } else {
            const leftEye = point(-5, -30)
            const rightEye = point(5, -30)
            graphics.fillStyle(0xf1dfbd, opacity)
            graphics.fillCircle(leftEye.x, leftEye.y, 2.1 * scale)
            graphics.fillCircle(rightEye.x, rightEye.y, 2.1 * scale)
            graphics.fillStyle(DARK, opacity)
            graphics.fillCircle(leftEye.x, leftEye.y, .9 * scale)
            graphics.fillCircle(rightEye.x, rightEye.y, .9 * scale)
            stroke([-7, -33], [-2, -35], 0x070f12, 1.8, opacity)
            stroke([2, -35], [7, -33], 0x070f12, 1.8, opacity)
            stroke([-6, -25], [6, -25], 0x070f12, 2.8, opacity)
            stroke([-3, -24], [0, -22], 0xd04a3f, 1.4, opacity)
            stroke([-8, -39], [-2, -42], 0xe3b18f, 1.2, .6 * opacity)
            stroke([2, -42], [8, -39], 0xe3b18f, 1.1, .5 * opacity)
            stroke([-10, -31], [-6, -27], 0x794936, 2.1, opacity)
            stroke([8, -29], [5, -24], 0x794936, 1.9, opacity)
          }
        }

        const drawUnit = (unit: Game['units'][number], ghost = false) => {
          const p = toScreen(unit.x, unit.y)
          const color = unit.side === 'blue' ? BLUE : RED
          const radius = unit.card.name === 'Flitzer' ? 11 : 8
          if (unit.card.name === 'Der Ultra') drawUltra(unit, ghost)
          else {
            graphics.fillStyle(0x080d0c, .5)
            graphics.fillEllipse(p.x, p.y + 8, radius * 2.7, 7)
            graphics.fillStyle(cardColor(unit.card), ghost ? .45 : 1)
            graphics.fillCircle(p.x, p.y, radius)
            graphics.fillStyle(color, ghost ? .45 : 1)
            graphics.fillCircle(p.x, p.y - radius * .65, radius * .58)
            graphics.lineStyle(1.5, DARK, .9)
            graphics.strokeCircle(p.x, p.y, radius)
          }
          graphics.fillStyle(DARK, .8)
          const barWidth = unit.card.name === 'Der Ultra' ? 24 : 20
          const barY = unit.card.name === 'Der Ultra' ? 17 : 20
          graphics.fillRect(p.x - barWidth / 2, p.y + barY, barWidth, 3)
          graphics.fillStyle(color, ghost ? .5 : 1)
          graphics.fillRect(p.x - barWidth / 2, p.y + barY, barWidth * Math.max(0, unit.hp / unit.card.hp), 3)
        }

        const drawEffects = () => {
          const current = gameRef.current
          for (const stain of current.bloodStains) {
            const p = toScreen(stain.x, stain.y)
            const fade = Math.max(0, 1 - stain.age / 3.2)
            graphics.fillStyle(0x651f25, .62 * fade)
            graphics.fillEllipse(p.x, p.y + 4, 17 + stain.age * 3, 7 + stain.age * 1.2)
            graphics.fillStyle(0xa83a35, .45 * fade)
            graphics.fillCircle(p.x - 3, p.y + 2, 3)
            graphics.fillCircle(p.x + 4, p.y + 3, 2)
          }
          for (const blood of current.blood) {
            const p = toScreen(blood.x, blood.y)
            const fade = Math.max(0, 1 - blood.age / .58)
            for (let i = 0; i < 5; i++) {
              const angle = -Math.PI * (.22 + i * .14)
              const distance = 8 + blood.age * (22 + i * 3)
              const particle = {
                x: p.x + Math.cos(angle) * distance + Math.sin(i * 4.2) * 3,
                y: p.y + Math.sin(angle) * distance - blood.age * blood.age * 18,
              }
              graphics.fillStyle(i % 2 ? 0x8f282d : 0xd14b3f, fade)
              graphics.fillCircle(particle.x, particle.y, Math.max(1, 2.6 - blood.age * 2))
            }
          }
          for (const flare of current.flares) {
            const source = buildings.find(building => building.key === flare.source)
            if (!source) continue
            const start = toScreen(source.x, source.y)
            const end = toScreen(flare.x, flare.y)
            const progress = Phaser.Math.Clamp(flare.age / .65, 0, 1)
            const p = {
              x: start.x + (end.x - start.x) * progress,
              y: start.y + (end.y - start.y) * progress - 28 * Math.sin(Math.PI * progress),
            }
            graphics.fillStyle(0xffbd62, 1)
            graphics.fillCircle(p.x, p.y, 5)
            line({ x: p.x - 10, y: p.y + 6 }, p, 0xe89b64, 2, .65)
          }
          for (const impact of current.impacts) {
            const p = toScreen(impact.x, impact.y)
            const radius = 8 + impact.age * 38
            graphics.lineStyle(2, 0xffcf80, Math.max(0, 1 - impact.age / .45))
            graphics.strokeCircle(p.x, p.y, radius)
          }
        }

        const drawPlacement = () => {
          if (!activeRef.current || !hover) return
          const allowed = canDeploy(gameRef.current, selectedRef.current, hover.x, hover.y, perspectiveRef.current)
          const p = toScreen(hover.x, hover.y)
          graphics.fillStyle(allowed ? 0x82f4c0 : 0xef6354, .22)
          graphics.fillRect(p.x - 16, p.y - 16, 32, 32)
          graphics.lineStyle(2, allowed ? 0xdfffe8 : 0xff9b8e, .8)
          graphics.strokeRect(p.x - 16, p.y - 16, 32, 32)
          const ghost = { x: hover.x, y: hover.y } as Game['units'][number]
          ghost.card = selectedRef.current
          ghost.side = perspectiveRef.current
          ghost.hp = selectedRef.current.hp
          drawUnit(ghost, true)
        }

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
          hover = fromPointer(pointer)
        })
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (!activeRef.current) return
          const target = fromPointer(pointer)
          if (canDeploy(gameRef.current, selectedRef.current, target.x, target.y, perspectiveRef.current)) {
            onPlaceRef.current(target.x, target.y, false)
          }
        })

        scene.renderArena = () => {
          graphics.clear()
          drawPitch()
          for (const building of buildings) drawBuilding(building)
          for (const unit of gameRef.current.units) if (unit.hp > 0) drawUnit(unit)
          drawEffects()
          drawPlacement()
          label.setPosition(10, 8).setText(`PHASER · ${gameRef.current.units.length} Einheiten · ${gameRef.current.time.toFixed(1)}s`)
        }
        this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) => {
          animationClock += delta
          scene.renderArena?.()
        })
      }

      instance = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: 800,
        height: 900,
        backgroundColor: '#18251b',
        render: { antialias: true, roundPixels: true },
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene,
      })
    })

    return () => {
      disposed = true
      instance?.destroy(true)
    }
  }, [])

  return <div ref={host} className="phaser-arena-host" aria-label="Phaser-Testarena" />
}
