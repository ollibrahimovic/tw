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
          const team = unit.side === 'blue' ? BLUE : RED
          const opacity = ghost ? .48 : 1
          const skin = unit.side === 'blue' ? 0xc39170 : 0xa9795d
          const jersey = 0x273134
          const scarf = unit.side === 'blue' ? 0x5baaa0 : 0xc46249

          // The Ultra is intentionally drawn as a chunky, readable game
          // silhouette rather than another circular unit marker.
          graphics.fillStyle(0x080d0c, .52 * opacity)
          graphics.fillEllipse(p.x, p.y + 13, 31, 8)
          polygon([
            { x: p.x - 9, y: p.y + 5 },
            { x: p.x - 4, y: p.y + 5 },
            { x: p.x - 6, y: p.y + 16 },
            { x: p.x - 13, y: p.y + 17 },
            { x: p.x - 10, y: p.y + 12 },
          ], 0x202626, opacity, DARK)
          polygon([
            { x: p.x + 3, y: p.y + 5 },
            { x: p.x + 9, y: p.y + 4 },
            { x: p.x + 13, y: p.y + 15 },
            { x: p.x + 7, y: p.y + 17 },
            { x: p.x + 1, y: p.y + 11 },
          ], 0x202626, opacity, DARK)

          // Shoulders, raised arms and clenched fists.
          polygon([
            { x: p.x - 10, y: p.y - 18 },
            { x: p.x - 18, y: p.y - 12 },
            { x: p.x - 21, y: p.y - 3 },
            { x: p.x - 16, y: p.y - 1 },
            { x: p.x - 10, y: p.y - 10 },
          ], 0x343d3c, opacity, DARK)
          polygon([
            { x: p.x + 10, y: p.y - 18 },
            { x: p.x + 18, y: p.y - 12 },
            { x: p.x + 21, y: p.y - 3 },
            { x: p.x + 16, y: p.y - 1 },
            { x: p.x + 10, y: p.y - 10 },
          ], 0x343d3c, opacity, DARK)
          graphics.fillStyle(skin, opacity)
          graphics.fillCircle(p.x - 19, p.y - 2, 4)
          graphics.fillCircle(p.x + 19, p.y - 2, 4)

          // Dark fan jacket with the team scarf across the chest.
          polygon([
            { x: p.x - 12, y: p.y - 19 },
            { x: p.x - 7, y: p.y - 24 },
            { x: p.x + 7, y: p.y - 24 },
            { x: p.x + 12, y: p.y - 18 },
            { x: p.x + 10, y: p.y + 6 },
            { x: p.x, y: p.y + 10 },
            { x: p.x - 11, y: p.y + 6 },
          ], jersey, opacity, DARK)
          graphics.fillStyle(scarf, opacity)
          graphics.fillRect(p.x - 11, p.y - 13, 22, 6)
          graphics.fillStyle(0xd0c18e, .8 * opacity)
          graphics.fillRect(p.x - 8, p.y - 12, 3, 4)
          graphics.fillRect(p.x + 5, p.y - 12, 3, 4)
          line({ x: p.x - 7, y: p.y - 4 }, { x: p.x + 7, y: p.y - 4 }, 0x93958a, 1, .65 * opacity)
          line({ x: p.x, y: p.y - 7 }, { x: p.x, y: p.y + 7 }, 0x93958a, 1, .55 * opacity)

          // Hood/balaclava and the exposed eyes make the character readable
          // even when several Ultras are deployed together.
          graphics.fillStyle(0x182226, opacity)
          graphics.fillCircle(p.x, p.y - 31, 13)
          graphics.fillStyle(skin, opacity)
          graphics.fillRoundedRect(p.x - 10, p.y - 32, 20, 9, 3)
          graphics.fillStyle(DARK, opacity)
          graphics.fillRect(p.x - 7, p.y - 30, 4, 2)
          graphics.fillRect(p.x + 3, p.y - 30, 4, 2)
          line({ x: p.x - 6, y: p.y - 25 }, { x: p.x + 6, y: p.y - 25 }, 0x070f12, 2.5, opacity)
          line({ x: p.x - 8, y: p.y - 38 }, { x: p.x + 8, y: p.y - 38 }, scarf, 2, opacity)
          line({ x: p.x - 10, y: p.y - 36 }, { x: p.x - 13, y: p.y - 27 }, scarf, 2, opacity)
          line({ x: p.x + 10, y: p.y - 36 }, { x: p.x + 13, y: p.y - 27 }, scarf, 2, opacity)
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
          const barWidth = unit.card.name === 'Der Ultra' ? 28 : 20
          graphics.fillRect(p.x - barWidth / 2, p.y + 20, barWidth, 3)
          graphics.fillStyle(color, ghost ? .5 : 1)
          graphics.fillRect(p.x - barWidth / 2, p.y + 20, barWidth * Math.max(0, unit.hp / unit.card.hp), 3)
        }

        const drawEffects = () => {
          const current = gameRef.current
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
        this.events.on(Phaser.Scenes.Events.UPDATE, () => scene.renderArena?.())
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
